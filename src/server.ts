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

// import 'dotenv/config'; // not needed because envs are inherited from parent process

import { createApp } from './server/app.js';
import { PORT } from './defs.js';
import { defineRoutes } from './server/basic-routes.js';
import { getProvider } from './server/get-provider.js';
import { defineOidcRoutes } from './server/oidc-routes.js';
import { sendMessage } from './server/child-channel.js';
import { ServerConfiguration } from './lib/ServerConfiguration.js';
import { Express, NextFunction, Request, Response } from 'express';
import { UserError } from './lib/UserError.js';

declare module 'express-session' {
  interface SessionData {
    username: string;
    loginToken: string;
    quizAnswer1: string;
    quizAnswer2: string;
    loginFailureCount: number;
    loginDisabledUntil: number;
    passwordFieldName: string;
    loginReturnTo: string;
  }
}

process.title = 'accounts-server-http';

createApp().then(async (app: Express) => {
  const config = await sendMessage('server_config_get', null) as ServerConfiguration;
  const provider = await getProvider(config);
  app.use('/oidc', provider.callback());

  defineRoutes(app, provider);
  defineOidcRoutes(app, provider);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof UserError) {
      console.log('Request error in: ', req.url, err);
      res.status(400);
      res.render('error', {
        message: String(err?.message || err),
      });
      return;
    }
    console.error('Request error in: ', req.url, err);
    res.status(500);
    res.render('error', {
      message: String(err?.message || err),
    });
  });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
