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
import { isPrime } from '../lib/bigint-primarity.js';

export interface FactorizationQuiz {
  p: string;
  q: string;
  n: string;
}

const PRIME_BITS = 48;

const getBitLength = (n: bigint): number => {
  let i = 0;
  while (n != 0n) {
    n >>= 1n;
    i++;
  }
  return i;
};

const generateRandomNumber = (bitLength: number): bigint => {
  if (bitLength > 64) {
    throw new Error("generateRandomNumber: bitLength > 64");
  }
  const arr = new BigUint64Array(1);
  let bl = 0;
  do {
    crypto.randomFillSync(arr);
    bl = getBitLength(arr[0] as bigint);
  } while (bl < bitLength);
  const n = (arr[0] as bigint) >> BigInt(bl - bitLength);
  return n;
};

const generateRandomPrime = (bitLength: number): bigint => {
  let n = 0n;
  do {
    n = generateRandomNumber(bitLength);
  } while (!isPrime(n));
  return n;
};

export const generatePrimeQuiz = (): FactorizationQuiz => {
  const p = generateRandomPrime(PRIME_BITS);
  const q = generateRandomPrime(PRIME_BITS);
  return {
    p: String(p),
    q: String(q),
    n: String(p * q),
  };
};
