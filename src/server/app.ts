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

import helmet from 'helmet';
import session from 'express-session';
import express, { Express } from 'express';
import { setNoCache, setAllowCache, setIsolation } from './middlewares.js';
import { ASSETS_DIR } from '../base-path.js';
import { SECRET, SESSION_MAX_AGE } from '../defs.js';
import { connect, getNativeClient } from './db.js';
import MongoStore from 'connect-mongo';

export const createApp = async (): Promise<Express> => {
  await connect();
  const client = getNativeClient();
  const sessionStore = MongoStore.create({
    client,
    collectionName: 'express-sessions',
  });
  const app = express();
  app.set('trust proxy', ['loopback', 'uniquelocal']);
  app.set('view engine', 'ejs');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        formAction: ["https:"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
      },
      reportOnly: false,
    }
  }));
  app.use(setNoCache);
  app.use(setIsolation);
  app.use('/assets', setAllowCache, express.static(ASSETS_DIR));

  app.use(session({
    name: 'menhera.sid',
    secret: SECRET as string,
    saveUninitialized: true,
    cookie: {
      maxAge: SESSION_MAX_AGE,
      secure: true,
      sameSite: 'lax',
    },
    resave: false,
    rolling: true,
    store: sessionStore,
  }));
  return app;
};
