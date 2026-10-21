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

import { LOGIN_FAILURE_WINDOW_SECONDS } from '../defs.js';
import { LoginFailure } from './mongodb/LoginFailure.js';

/**
 * Records one failed login attempt for a client bucket and returns the number of
 * failures counted in the current window. The window restarts with every failure.
 */
export const recordLoginFailure = async (bucket: string): Promise<number> => {
  const now = Date.now();
  // The TTL monitor removes expired documents with a delay; do not continue a stale count.
  await LoginFailure.deleteOne({ bucket, expiresAt: { $lte: new Date(now) } });
  const doc = await LoginFailure.findOneAndUpdate(
    { bucket },
    {
      $inc: { count: 1 },
      $set: { expiresAt: new Date(now + LOGIN_FAILURE_WINDOW_SECONDS * 1000) },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return doc?.count ?? 1;
};

/**
 * Number of failed login attempts counted for a client bucket in the current window.
 */
export const getLoginFailureCount = async (bucket: string): Promise<number> => {
  const doc = await LoginFailure.findOne({ bucket }).lean();
  if (!doc || doc.expiresAt.getTime() <= Date.now()) {
    return 0;
  }
  return doc.count;
};
