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

import mongoose, { Schema } from "mongoose";

/**
 * Failed login attempts per client address bucket (IPv4 /32 or IPv6 /64), used to
 * raise the size of the login puzzle. Documents expire LOGIN_FAILURE_WINDOW_SECONDS
 * after the last failure.
 */
const LoginFailureSchema = new Schema({
  bucket: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});

LoginFailureSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

export const LoginFailure = mongoose.model("LoginFailure", LoginFailureSchema);
