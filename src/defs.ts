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

export const ADMIN_GROUP = process.env.ADMIN_GROUP || 'sudo';
export const INTERNAL_GROUP = process.env.INTERNAL_GROUP || 'internal';
export const ALIASES_PATH = process.env.ALIASES_PATH || '/etc/aliases';
export const ALL_LISTS_USER = process.env.ALL_LISTS_USER || 'root';
export const OIDC_ISSUER = process.env.OIDC_ISSUER || 'http://localhost:3000';
export const USER_EMAIL_DOMAIN = process.env.USER_EMAIL_DOMAIN || 'menhera.org';
export const SERVER_USER = process.env.SERVER_USER || 'nobody';
export const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/accounts';

export const SESSION_MAX_AGE = 1000 * 60 * 60 * 24; // 1 day

// Login proof-of-work: the browser factors a balanced RSA-style semiprime of LOGIN_QUIZ_BITS bits.
// Every failed login attempt in a session raises the size by LOGIN_QUIZ_STEP_BITS, up to
// LOGIN_QUIZ_MAX_BITS (240 -> 256 -> 272 -> 288 by default).
const parseQuizBits = (name: string, fallback: number, minimum: number): number => {
  const raw = (process.env[name] ?? '').trim();
  const value = raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > 400 || value % 2 !== 0) {
    throw new Error(`${name} must be an even integer between ${minimum} and 400`);
  }
  return value;
};
export const LOGIN_QUIZ_BITS = parseQuizBits('LOGIN_QUIZ_BITS', 240, 64);
export const LOGIN_QUIZ_STEP_BITS = parseQuizBits('LOGIN_QUIZ_STEP_BITS', 16, 0);
export const LOGIN_QUIZ_MAX_BITS = parseQuizBits('LOGIN_QUIZ_MAX_BITS', 288, 64);
if (LOGIN_QUIZ_MAX_BITS < LOGIN_QUIZ_BITS) {
  throw new Error('LOGIN_QUIZ_MAX_BITS must not be smaller than LOGIN_QUIZ_BITS');
}

// Failed login attempts are also counted per client address (IPv4 /32, IPv6 /64), so that a
// fresh session does not reset the puzzle size. A bucket's count expires this long after its
// last failure.
export const LOGIN_FAILURE_WINDOW_SECONDS = parseInt(process.env.LOGIN_FAILURE_WINDOW_SECONDS || '3600', 10);
if (!Number.isInteger(LOGIN_FAILURE_WINDOW_SECONDS) || LOGIN_FAILURE_WINDOW_SECONDS < 1) {
  throw new Error('LOGIN_FAILURE_WINDOW_SECONDS must be a positive integer');
}

export const PORT = parseInt(process.env.PORT || '3000', 10);
const SECRET = (process.env.SECRET ?? '').trim();
if (!SECRET) {
  throw new Error('SECRET is not set');
}

export { SECRET };
