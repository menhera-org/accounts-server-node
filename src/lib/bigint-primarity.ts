/* -*- indent-tabs-mode: nil; tab-width: 2; -*- */
/* vim: set ts=2 sw=2 et ai : */
/**
  Copyright (C) 2023 Menhera.org

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

import * as crypto from 'node:crypto';

function power(x: bigint, y: bigint, p: bigint): bigint {
  let res = 1n;
  x = x % p;
  while (y > 0n) {
    if (y & 1n)
      res = (res * x) % p;
    y = y >> 1n;
    x = (x * x) % p;
  }
  return res;
}

const getBitLength = (n: bigint): number => {
  let i = 0;
  while (n != 0n) {
    n >>= 1n;
    i++;
  }
  return i;
};

function getRandomBigInt(max: bigint): bigint {
  const bl = getBitLength(max) + 1;
  const bytes = Math.ceil(bl / 8);
  const r = bl % 8;
  const arr = new Uint8Array(bytes);
  let n = 0n;
  do {
    crypto.randomFillSync(arr);
    n = 0n;
    for (let i = 0; i < bytes; i++) {
      n <<= 8n;
      n |= BigInt(arr[i] as number);
    }
    const newBl = getBitLength(n);
    if (newBl > bl) {
      n >>= BigInt(newBl - bl);
    }
  } while (n > max);
  return n;
}

function miillerTest(d: bigint, n: bigint) {
  let a = 2n + getRandomBigInt(n - 4n);
  let x = power(a, d, n);

  if (x == 1n || x == (n - 1n))
    return true;

  while (d != (n - 1n)) {
    x = (x * x) % n;
    d *= 2n;

    if (x == 1n)
      return false;
    if (x == (n - 1n))
        return true;
  }
  return false;
}

export function isPrime(n: bigint, k = 50) {
  if (n <= 1n || n == 4n) return false;
  if (n <= 3n) return true;

  let d = n - 1n;
  while (d % 2n == 0n)
    d /= 2n;

  for (let i = 0; i < k; i++)
    if (!miillerTest(d, n))
      return false;

  return true;
}
