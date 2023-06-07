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

import * as crypto from 'node:crypto';
import { Express } from "express";
import { urlencodedParser } from "./middlewares.js";
import { pamAuthenticatePromise } from "./pam-auth-client.js";
import Provider, { InteractionResults } from "oidc-provider";
import { generatePrimeQuiz } from './auth-quiz-factorization.js';

export const defineOidcRoutes = (app: Express, provider: Provider) => {
  app.get('/interaction/:uid', async (req, res, next) => {
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
      const uuid = crypto.randomUUID();
      const quiz = generatePrimeQuiz();
      const {p, q, n} = quiz;
      const answer1 = p;
      const answer2 = q;
      req.session.loginToken = uuid;
      req.session.quizAnswer1 = answer1;
      req.session.quizAnswer2 = answer2;
      res.render('interaction-login', {
        title: 'Log in',
        uid,
        loginToken: uuid,
        quizFactorization: n,
      });
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
  });

  app.post('/interaction/:uid/login', urlencodedParser, (req, res, next) => {
    try {
      const recordLoginFailure = () => {
        if (req.session.loginDisabledUntil && req.session.loginDisabledUntil > Date.now()) {
          req.session.loginDisabledUntil = Date.now() + 600 * 1000;
          return;
        }
        if (!req.session.loginFailureCount) {
          req.session.loginFailureCount = 1;
        } else {
          req.session.loginFailureCount = Number(req.session.loginFailureCount) + 1;
        }
        const count = Number(req.session.loginFailureCount);
        if (count > 2) {
          req.session.loginDisabledUntil = Date.now() + 600 * 1000;
          req.session.loginFailureCount = 0;
        }
      };
      const username = req.body.username;
      const password = req.body.password2;
      const dummyPassword = req.body.password;
      const answersStr = req.body.quizFactorizationAnswer as string;
      const token = req.body.token;
      const loginToken = req.session.loginToken;
      const answer1 = req.session.quizAnswer1;
      const answer2 = req.session.quizAnswer2;
      if (!token || token !== loginToken || !answer1 || !answer2 || !answersStr) {
        recordLoginFailure();
        res.status(400);
        const result = {
          error: 'not_authenticated',
          error_description: 'Invalid request',
        };
        provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }
      if (req.session.loginDisabledUntil && req.session.loginDisabledUntil > Date.now()) {
        recordLoginFailure();
        res.status(400);
        const result = {
          error: 'not_authenticated',
          error_description: 'Too many login failures',
        };
        provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }
      const realAnswers = [answer1, answer2].sort() as [string, string];
      const answers = answersStr.split(',').sort() as [string, string];
      if (dummyPassword || answers[0] != realAnswers[0] || answers[1] != realAnswers[1]) {
        recordLoginFailure();
        res.status(400);
        const result = {
          error: 'not_authenticated',
          error_description: 'Invalid request',
        };
        provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }
      pamAuthenticatePromise({
        username,
        password,
      }).then(() => {
        req.session.regenerate(function (err) {
          if (err) {
            console.error(err);
            next(err);
            return;
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
        recordLoginFailure();
        res.status(401);
        const result = {
          error: 'not_authenticated',
          error_description: 'The username or password is incorrect',
        };
        provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }).catch((e) => {
        next(e);
      });
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
