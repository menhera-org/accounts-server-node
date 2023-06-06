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
import { BASE_PATH } from "./base-path";

const AUTH_SCRIPT_PATH = path.resolve(BASE_PATH, 'dist/pam-auth.js');

export const pamAuthenticatePromise = async ({username, password}: {username: string, password: string}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = execFile('node', [AUTH_SCRIPT_PATH, username], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.stdin?.write(password);
    child.stdin?.end();
  });
};
