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

import { Express } from "express";
import { urlencodedParser } from "./middlewares.js";
import { pamAuthenticatePromise } from "node-linux-pam";
import Provider, { InteractionResults } from "oidc-provider";

export const defineOidcRoutes = (app: Express, provider: Provider) => {
  app.get('/interaction/:uid', async (req, res, next) => {
    const details = await provider.interactionDetails(req, res);
    const { uid, prompt: { name, details: promptDetails } } = details;
    if (name == 'login') {
      if (req.session.username) {
        const result = {
          login: {
            accountId: req.session.username,
          },
        };
        await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }
      res.render('interaction-login', {
        uid,
      });
      return;
    } else if (name == 'consent') {
      res.render('interaction-consent', {
        uid,
      });
      return;
    }

    next(new Error('invalid interaction'));
  });

  app.post('/interaction/:uid/login', urlencodedParser, (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    pamAuthenticatePromise({
      username,
      password,
    }).then(() => {
      req.session.regenerate(function (err) {
        if (err) {
          throw err;
        }

        req.session.username = username;

        // save the session before redirection to ensure page
        // load does not happen before session is saved
        req.session.save(function (err) {
          if (err) {
            console.error(err);
            res.redirect('/login?error=internal-error');
            return;
          }
          const result = {
            login: {
              accountId: username,
            },
          };
          provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        });
      });

    }).catch((e) => {
      res.status(401);
      const result = {
        error: 'not_authenticated',
        error_description: 'The username or password is incorrect',
      };
      provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
      return;
    });
  });

  app.post('/interaction/:uid/confirm', urlencodedParser, async (req, res, next) => {
    try {
      const interactionDetails = await provider.interactionDetails(req, res);
      const { prompt: { name, details: promptDetails } } = interactionDetails;
      if ('consent' !== name) {
        next(new Error('invalid interaction'));
        return;
      }

      let { grantId } = interactionDetails;
      let grant;
      if (grantId) {
        grant = await provider.Grant.find(grantId);
      } else {
        grant = new provider.Grant({
          accountId: req.session.username,
          clientId: interactionDetails.params.client_id as string,
        });
      }

      if (!grant) {
        next(new Error('invalid interaction'));
        return;
      }

      if (promptDetails.missingOIDCScope) {
        grant.addOIDCScope((promptDetails.missingOIDCScope as string[]).join(' '));
      }

      if (promptDetails.missingOIDCClaims) {
        grant.addOIDCClaims(promptDetails.missingOIDCClaims as string []);
      }

      if (promptDetails.missingResourceScopes) {
        for (const [indicator, scopes] of Object.entries(promptDetails.missingResourceScopes)) {
          grant.addResourceScope(indicator, (scopes as string[]).join(' '));
        }
      }

      grantId = await grant.save();

      const result: InteractionResults = { consent: {} };
      if (!interactionDetails.grantId) {
        result.consent!.grantId = grantId;
      }

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
    } catch (e) {
      next(e);
    }
  });
};
