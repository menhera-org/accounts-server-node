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

import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { BASE_PATH } from "../base-path.js";

// Standalone PAM helper built from native/pam-auth.c by scripts/build-pam-auth.js.
// It is a separate executable rather than a Node.js addon, so it does not depend
// on the Node.js ABI and keeps working across Node.js upgrades.
const PAM_AUTH_HELPER_PATH = path.resolve(BASE_PATH, 'build/pam-auth');

const PAM_SERVICE_NAME = process.env.PAM_SERVICE_NAME || 'login';

// Upper bound for a single PAM conversation (PAM modules may sleep on failures).
const PAM_AUTH_TIMEOUT = 60 * 1000;

export const execPamAuth = async ({username, password}: {username: string, password: string}): Promise<void> => {
  if ('string' != typeof username || username == '' || username.includes('\0')) {
    throw new Error('execPamAuth: invalid username');
  }
  if ('string' != typeof password || password.includes('\0')) {
    throw new Error('execPamAuth: invalid password');
  }
  return new Promise((resolve, reject) => {
    const child = execFile(PAM_AUTH_HELPER_PATH, [PAM_SERVICE_NAME, username], { timeout: PAM_AUTH_TIMEOUT }, (err) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code == 'ENOENT') {
          reject(new Error(`PAM helper not found at ${PAM_AUTH_HELPER_PATH} (run "npm run build:pam-auth")`));
          return;
        }
        reject(err);
        return;
      }
      resolve();
    });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    // The helper may exit before consuming stdin (e.g. usage error); the exit status is reported above.
    child.stdin?.on('error', () => {});
    child.stdin?.end(password);
  });
};
