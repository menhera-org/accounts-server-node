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

interface AuthQuiz {
  a: string;
  b: string;
  gcdAnswer: string;
  sumAnswer: string;
}

export const bigIntGcd = (a: bigint, b: bigint): bigint => {
  if (a <= 0n || b <= 0n) {
    throw new Error("bigIntGcd: nonpositive");
  }
  while (b !== 0n) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
};

const generateRandomInteger = (): bigint => {
  const arr = new BigUint64Array(1);
  crypto.randomFillSync(arr);
  return (arr[0] as bigint) + (1n << 63n);
};

export const generateQuiz = (): AuthQuiz => {
  const a = generateRandomInteger();
  const b = generateRandomInteger();
  const answer = bigIntGcd(a, b);
  return {
    a: String(a),
    b: String(b),
    gcdAnswer: String(answer),
    sumAnswer: String(a + b),
  };
};
