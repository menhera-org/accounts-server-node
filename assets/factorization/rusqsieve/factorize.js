/* -*- indent-tabs-mode: nil; tab-width: 2; -*- */
/* vim: set ts=2 sw=2 et ai : */
/**
  Copyright (C) 2026 Menhera.org

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  @license
*/

// Browser driver for the login proof-of-work: factors the challenge with rusqsieve, a
// self-initializing quadratic sieve compiled to WebAssembly, across a pool of Web Workers.
//
// This is the orchestration of rusqsieve's demo page (web/index.js, v0.5.0) without its UI and
// without the deep Pollard-rho and ECM worker pools: the challenge is always a balanced semiprime
// inside the sieve's range, which is exactly the shape those stages never run for. The worker
// protocol, scheduling and validation are kept as upstream wrote them.

import { loadModule, bytesToBigInt } from './abi.js';
import { trialDivide, isPrime, perfectPower, pollardBrent, bitLength } from './numtheory.js';

const SIMD_WASM_URL = new URL('./rusqsieve-simd.wasm', import.meta.url);
const SCALAR_WASM_URL = new URL('./rusqsieve.wasm', import.meta.url);
const COORDINATOR_URL = new URL('./coordinator.js', import.meta.url);
const WORKER_URL = new URL('./worker.js', import.meta.url);

const ABI_VERSION = 6;
// Families per sieve job; two was consistently best from 192 through 256 bits upstream.
const BATCH = 2;
const BOOT_TIMEOUT_MS = 30_000;
// Give up only when the whole pool has been silent this long while the page is visible.
const STALL_TIMEOUT_MS = 10 * 60_000;
// A watchdog callback delayed this much means the browser was suspended, not that workers hung.
const WATCHDOG_LATE_GRACE_MS = 30_000;
const MAX_WORKERS = 16;

let generation = 0;

export const defaultWorkerCount = () =>
  Math.max(1, Math.min(MAX_WORKERS, globalThis.navigator?.hardwareConcurrency || 4));

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const withTimeout = (promise, milliseconds, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const waitForWorkerReady = (worker, module, requireAbi, signal) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('worker initialization timed out')), BOOT_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onMessageError);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(data);
    };
    const onMessage = ({ data }) => {
      if (data?.type === 'error') {
        finish(new Error(data.error || 'worker initialization failed'));
      } else if (data?.type === 'ready') {
        if (requireAbi && data.abi !== ABI_VERSION) {
          finish(new Error(`unsupported rusqsieve wasm ABI ${String(data.abi)}`));
        } else {
          finish(null, data);
        }
      }
    };
    const onError = (event) => {
      event.preventDefault?.();
      finish(new Error(event.message || 'worker failed during initialization'));
    };
    const onMessageError = () => finish(new Error('worker initialization message was invalid'));
    const onAbort = () => finish(new Error('worker initialization cancelled'));
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    try {
      worker.postMessage({ cmd: 'init', module });
    } catch (error) {
      finish(error);
    }
  });

// Compiles the wasm module (SIMD first, portable build as the fallback) and starts the
// coordinator and the sieve worker pool, each with its own wasm instance.
const boot = async (workerCount) => {
  let module;
  let flavor;
  try {
    module = await withTimeout(loadModule(SIMD_WASM_URL), BOOT_TIMEOUT_MS, 'SIMD wasm load');
    flavor = 'simd';
  } catch {
    module = await withTimeout(loadModule(SCALAR_WASM_URL), BOOT_TIMEOUT_MS, 'scalar wasm load');
    flavor = 'scalar';
  }
  const coord = new Worker(COORDINATOR_URL, { type: 'module' });
  const workers = Array.from({ length: workerCount }, () => new Worker(WORKER_URL, { type: 'module' }));
  const abort = new AbortController();
  try {
    const [ready] = await Promise.all([
      waitForWorkerReady(coord, module, true, abort.signal),
      ...workers.map((worker) => waitForWorkerReady(worker, module, false, abort.signal)),
    ]);
    const maxSiqsBits = Number.isInteger(ready.maxSiqsBits) && ready.maxSiqsBits > 0 ? ready.maxSiqsBits : 400;
    return { module, flavor, coord, workers, maxSiqsBits };
  } catch (error) {
    abort.abort();
    coord.terminate();
    for (const worker of workers) worker.terminate();
    throw error;
  }
};

const shutdown = (runtime) => {
  runtime.coord.terminate();
  for (const worker of runtime.workers) worker.terminate();
};

// Parallel quadratic sieve for one hard composite; resolves to a nontrivial factor.
const siqsParallel = (runtime, decimal, bits, report) =>
  new Promise((resolve, reject) => {
    const { coord, workers } = runtime;
    const myGen = ++generation;
    const sieveStarted = performance.now();
    let target = 0;
    let relations = 0;
    let nextFamily = 0;
    let familyBudget = 0;
    let activeJobs = 0;
    let pendingSubmissions = 0;
    let preparedWorkers = 0;
    let finished = false;
    const workerBusy = new Array(workers.length).fill(false);
    const workerPrepared = new Array(workers.length).fill(false);
    let stallTimer = null;
    let lastActivity = performance.now();
    const doc = globalThis.document;
    const hidden = () => Boolean(doc?.hidden);

    const clearStallTimer = () => {
      if (stallTimer !== null) clearTimeout(stallTimer);
      stallTimer = null;
    };
    const armStallWatchdog = () => {
      clearStallTimer();
      if (finished || hidden()) return;
      const remaining = Math.max(0, STALL_TIMEOUT_MS - (performance.now() - lastActivity));
      const deadline = performance.now() + remaining;
      stallTimer = setTimeout(() => {
        const now = performance.now();
        if (now - deadline > WATCHDOG_LATE_GRACE_MS) {
          lastActivity = now;
          armStallWatchdog();
          return;
        }
        if (!finished && !hidden() && now - lastActivity >= STALL_TIMEOUT_MS) {
          fail(new Error('factorization stalled: no worker activity for 10 minutes'));
        } else {
          armStallWatchdog();
        }
      }, remaining);
    };
    const noteActivity = () => {
      lastActivity = performance.now();
      armStallWatchdog();
    };
    const onVisibilityChange = () => {
      if (hidden()) clearStallTimer();
      else noteActivity();
    };

    const cleanup = () => {
      clearStallTimer();
      doc?.removeEventListener('visibilitychange', onVisibilityChange);
      coord.onmessage = null;
      coord.onerror = null;
      coord.onmessageerror = null;
      for (const worker of workers) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
      }
    };
    const fail = (error) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const succeed = (factor) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(factor);
    };
    const maybeExhausted = () => {
      if (
        !finished &&
        familyBudget > 0 &&
        nextFamily >= familyBudget &&
        activeJobs === 0 &&
        pendingSubmissions === 0 &&
        preparedWorkers === workers.length
      ) {
        fail(new Error(`relation budget exhausted after ${familyBudget} families (${relations}/${target} relations)`));
      }
    };
    const dispatch = (worker, workerIndex) => {
      if (finished || workerBusy[workerIndex]) return false;
      if (familyBudget <= 0 || nextFamily >= familyBudget) {
        maybeExhausted();
        return false;
      }
      const family = nextFamily;
      const count = Math.min(BATCH, familyBudget - nextFamily);
      nextFamily += count;
      workerBusy[workerIndex] = true;
      activeJobs++;
      try {
        worker.postMessage({ cmd: 'sieve', family, count, gen: myGen });
      } catch (error) {
        workerBusy[workerIndex] = false;
        activeJobs--;
        fail(error);
        return false;
      }
      return true;
    };
    const finishJob = (workerIndex) => {
      if (!workerBusy[workerIndex]) {
        fail(new Error(`unexpected response from idle sieve worker ${workerIndex + 1}`));
        return false;
      }
      workerBusy[workerIndex] = false;
      activeJobs--;
      return true;
    };

    coord.onmessage = ({ data }) => {
      if (data?.gen !== myGen) return;
      noteActivity();
      if (data.type === 'error') {
        fail(new Error(data.error || 'coordinator failed'));
      } else if (data.type === 'session') {
        if (!Number.isInteger(data.target) || data.target <= 0) {
          fail(new Error('coordinator returned an invalid relation target'));
          return;
        }
        if (!Number.isInteger(data.familyBudget) || data.familyBudget <= 0) {
          fail(new Error('coordinator returned an invalid family budget'));
          return;
        }
        target = data.target;
        familyBudget = data.familyBudget;
        try {
          for (const worker of workers) {
            worker.postMessage({ cmd: 'prepare', n: decimal, gen: myGen });
          }
        } catch (error) {
          fail(error);
        }
      } else if (data.type === 'submitted') {
        if (pendingSubmissions <= 0) {
          fail(new Error('coordinator acknowledged an unknown submission'));
          return;
        }
        pendingSubmissions--;
        if (
          !Number.isInteger(data.worker) ||
          data.worker < 0 ||
          data.worker >= workers.length ||
          !Number.isInteger(data.relations) ||
          data.relations < relations ||
          !Number.isInteger(data.target) ||
          data.target <= 0
        ) {
          fail(new Error('coordinator returned invalid progress'));
          return;
        }
        relations = data.relations;
        target = data.target;
        report({
          phase: 'sieving',
          bits,
          relations,
          target,
          workers: workers.length,
          elapsedSeconds: (performance.now() - sieveStarted) / 1000,
        });
        if (!finished) {
          dispatch(workers[data.worker], data.worker);
          maybeExhausted();
        }
      } else if (data.type === 'linalg') {
        report({ phase: 'linalg', bits });
      } else if (data.type === 'factor') {
        if (!(data.factor instanceof Uint8Array)) {
          fail(new Error('coordinator returned a malformed factor'));
          return;
        }
        const factor = bytesToBigInt(data.factor);
        const composite = BigInt(decimal);
        if (factor <= 1n || factor >= composite || composite % factor !== 0n) {
          fail(new Error('coordinator returned an invalid factor'));
          return;
        }
        succeed(factor);
      } else {
        fail(new Error(`unknown coordinator response: ${String(data.type)}`));
      }
    };
    coord.onerror = (event) => {
      event.preventDefault?.();
      fail(new Error(event.message || 'coordinator worker crashed'));
    };
    coord.onmessageerror = () => fail(new Error('coordinator returned an invalid message'));

    workers.forEach((worker, workerIndex) => {
      worker.onmessage = ({ data }) => {
        // Every run response, including errors, is generation-scoped.
        if (data?.gen !== myGen) return;
        noteActivity();
        if (data.type === 'error') {
          fail(new Error(data.error || `sieve worker ${workerIndex + 1} failed`));
          return;
        }
        if (finished) return;
        if (data.type === 'prepared') {
          if (workerPrepared[workerIndex]) {
            fail(new Error(`sieve worker ${workerIndex + 1} prepared twice`));
            return;
          }
          if (!data.ok) {
            fail(new Error(`sieve worker ${workerIndex + 1} could not build a sieve`));
            return;
          }
          workerPrepared[workerIndex] = true;
          preparedWorkers++;
          dispatch(worker, workerIndex);
        } else if (data.type === 'relations') {
          if (!finishJob(workerIndex)) return;
          if (data.payload) {
            if (!(data.payload instanceof Uint8Array)) {
              fail(new Error(`sieve worker ${workerIndex + 1} returned invalid relations`));
              return;
            }
            pendingSubmissions++;
            try {
              coord.postMessage({ cmd: 'submit', payload: data.payload, worker: workerIndex, gen: myGen }, [data.payload.buffer]);
            } catch (error) {
              pendingSubmissions--;
              fail(error);
            }
            return;
          }
          fail(new Error(`sieve worker ${workerIndex + 1} could not serialize relations`));
        } else {
          fail(new Error(`unknown sieve-worker response: ${String(data.type)}`));
        }
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        fail(new Error(event.message || `sieve worker ${workerIndex + 1} crashed`));
      };
      worker.onmessageerror = () => fail(new Error(`sieve worker ${workerIndex + 1} returned an invalid message`));
    });
    doc?.addEventListener('visibilitychange', onVisibilityChange);
    armStallWatchdog();
    try {
      coord.postMessage({ cmd: 'new', n: decimal, gen: myGen });
    } catch (error) {
      fail(error);
    }
  });

// Peels what BigInt arithmetic can take cheaply, then sieves every hard composite.
const factorizeWith = async (runtime, N, report) => {
  const primes = [];
  const stack = [N];
  while (stack.length) {
    let c = stack.pop();
    report({ phase: 'trial', n: c });
    await tick();
    c = trialDivide(c, primes);
    if (c === 1n) continue;
    report({ phase: 'primality', n: c });
    await tick();
    if (isPrime(c)) {
      primes.push(c);
      continue;
    }
    const pp = perfectPower(c);
    if (pp) {
      for (let i = 0; i < pp.k; i++) stack.push(pp.base);
      continue;
    }
    report({ phase: 'pollard', n: c });
    await tick();
    const d = pollardBrent(c, 1 << 15);
    if (d && d > 1n && d < c) {
      stack.push(d, c / d);
      continue;
    }
    const compositeBits = bitLength(c);
    if (compositeBits > runtime.maxSiqsBits) {
      throw new Error(`a ${compositeBits}-bit composite is above the ${runtime.maxSiqsBits}-bit sieve limit`);
    }
    const factor = await siqsParallel(runtime, c.toString(), compositeBits, report);
    if (factor <= 1n || factor >= c || c % factor !== 0n) {
      throw new Error('quadratic sieve returned an invalid factor');
    }
    stack.push(factor, c / factor);
  }
  primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return primes;
};

/**
 * Factors a positive integer into primes (ascending, with repetition).
 * `report` receives progress objects: { phase: 'boot' | 'trial' | 'primality' | 'pollard' |
 * 'sieving' | 'linalg', ... } with relations/target/elapsedSeconds while sieving.
 */
export const factorize = async (n, { report = () => {}, workers = defaultWorkerCount() } = {}) => {
  const N = BigInt(n);
  if (N < 1n) throw new RangeError('input must be a positive integer');
  if (N === 1n) return [];
  const workerCount = Math.max(1, Math.min(MAX_WORKERS, Math.floor(workers) || 1));
  report({ phase: 'boot', workers: workerCount });
  const runtime = await boot(workerCount);
  try {
    return await factorizeWith(runtime, N, report);
  } finally {
    shutdown(runtime);
  }
};
