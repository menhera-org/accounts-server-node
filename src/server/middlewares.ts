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

import express from 'express';

export const urlencodedParser = express.urlencoded({ extended: false });

export const setNoCache = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export const setAllowCache = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.set('Cache-Control', 'public, must-revalidate, max-age=3600');
  next();
};

export const setIsolation = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
};
