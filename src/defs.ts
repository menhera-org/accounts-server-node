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
export const ALIASES_PATH = process.env.ALIASES_PATH || '/etc/aliases';
export const ALL_LISTS_USER = process.env.ALL_LISTS_USER || 'root';
export const OIDC_ISSUER = process.env.OIDC_ISSUER || 'http://localhost:3000';
export const USER_EMAIL_DOMAIN = process.env.USER_EMAIL_DOMAIN || 'menhera.org';

export const SESSION_MAX_AGE = 1000 * 60 * 60 * 24; // 1 day

export const PORT = parseInt(process.env.PORT || '3000', 10);
const SECRET = process.env.SECRET;
if (!SECRET) {
  throw new Error('SECRET is not set');
}

export { SECRET };
