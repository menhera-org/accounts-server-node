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
import Provider, { InteractionResults } from "oidc-provider";

export const defineOidcRoutes = (app: Express, provider: Provider) => {
  app.get('/interaction/:uid', async (req, res, next) => {
    try {
      const details = await provider.interactionDetails(req, res);
      const { uid, prompt: { name, details: promptDetails }, params } = details;
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
        req.session.loginReturnTo = `/interaction/${uid}/login`;
        res.redirect('/login');
        return;
      } else if (name == 'consent') {
        const clientId = params.client_id;
        res.render('interaction-consent', {
          title: `Log in to ${clientId}`,
          clientId,
          uid,
        });
        return;
      }

      next(new Error('invalid interaction'));
    } catch (e) {
      next(e);
    }
  });

  app.get('/interaction/:uid/login', urlencodedParser, async (req, res, next) => {
    try {
      if (req.session.username) {
        const result = {
          login: {
            accountId: req.session.username,
          },
        };
        await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }

      const result = {
        error: 'not_authenticated',
        error_description: 'Invalid request',
      };
      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
      return;
    } catch (e) {
      next(e);
    }
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
