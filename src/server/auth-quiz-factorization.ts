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
import { LOGIN_QUIZ_BITS, LOGIN_QUIZ_MAX_BITS, LOGIN_QUIZ_STEP_BITS } from '../defs.js';

export interface FactorizationQuiz {
  p: string;
  q: string;
  n: string;
  bits: number;
}

/**
 * Size of the login puzzle for a session that has already failed `level` login attempts:
 * the base size, raised by one step per failure, capped at the maximum.
 */
export const quizBitsForLevel = (level: number): number => {
  const failures = Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  return Math.min(LOGIN_QUIZ_MAX_BITS, LOGIN_QUIZ_BITS + LOGIN_QUIZ_STEP_BITS * failures);
};

/**
 * Generates a balanced RSA-style semiprime n = p * q of exactly `bits` bits, with p and q
 * distinct primes of `bits / 2` bits each. The browser factors n with the quadratic sieve
 * (see assets/factorization/rusqsieve/) as the login proof-of-work.
 */
export const generatePrimeQuiz = (bits: number = LOGIN_QUIZ_BITS): FactorizationQuiz => {
  if (!Number.isInteger(bits) || bits < 16 || bits % 2 !== 0) {
    throw new RangeError(`invalid quiz size: ${bits}`);
  }
  const half = bits / 2;
  for (;;) {
    // OpenSSL sets the top two bits of the primes it generates, so p * q normally has
    // exactly `bits` bits; the check below keeps that a guarantee rather than an assumption.
    const p = crypto.generatePrimeSync(half, { bigint: true });
    const q = crypto.generatePrimeSync(half, { bigint: true });
    if (p === q) {
      continue;
    }
    const n = p * q;
    if (n.toString(2).length !== bits) {
      continue;
    }
    return {
      p: String(p),
      q: String(q),
      n: String(n),
      bits,
    };
  }
};
