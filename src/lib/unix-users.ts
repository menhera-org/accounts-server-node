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

export interface UserIds {
  uid: number;
  gid: number;
}

export const getUid = async (user: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const child = execFile('id', ['-u', user], (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      const uid = parseInt(stdout.trim(), 10);
      if (isNaN(uid)) {
        reject(new Error(`Invalid uid: ${stdout}`));
        return;
      }
      resolve(uid);
    });
    child.stderr?.pipe(process.stderr);
    child.stdin?.end();
  });
};

export const getPrimaryGid = async (user: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const child = execFile('id', ['-g', user], (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      const uid = parseInt(stdout.trim(), 10);
      if (isNaN(uid)) {
        reject(new Error(`Invalid gid: ${stdout}`));
        return;
      }
      resolve(uid);
    });
    child.stderr?.pipe(process.stderr);
    child.stdin?.end();
  });
};

export const getUserIds = async (user: string): Promise<UserIds> => {
  const [uid, gid] = await Promise.all([
    getUid(user),
    getPrimaryGid(user),
  ]);
  return { uid, gid };
};
