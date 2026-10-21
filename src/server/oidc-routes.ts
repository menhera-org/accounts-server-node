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

import { Express, Request, Response } from "express";
import { urlencodedParser } from "./middlewares.js";
import Provider, { InteractionResults } from "oidc-provider";
import { UserError } from "../lib/UserError.js";
import { ServerConfiguration } from "../lib/ServerConfiguration.js";
import { getGroups } from "../lib/unix-users.js";
import { INTERNAL_GROUP } from "../defs.js";

const getInteraction = async (provider: Provider, req: Request, res: Response) => {
  try {
    return await provider.interactionDetails(req, res);
  } catch (e) {
    return null;
  }
};

/**
 * Clients listed in restricted-clients.json may only be used by internal users.
 * Throws a UserError otherwise.
 */
const assertClientAllowed = async (serverConfig: ServerConfiguration, clientId: string, accountId: string): Promise<void> => {
  if (!serverConfig.restrictedClientIds.includes(clientId)) {
    return;
  }
  const userGroups = await getGroups(accountId);
  if (!userGroups.includes(INTERNAL_GROUP)) {
    throw new UserError('Unauthorized access');
  }
};

export const defineOidcRoutes = (app: Express, provider: Provider, serverConfig: ServerConfiguration) => {
  app.get('/interaction/:uid', async (req, res, next) => {
    try {
      const details = await getInteraction(provider, req, res);
      if (!details) {
        next(new UserError('interaction session not found'));
        return;
      }
      const { uid, prompt: { name }, params } = details;
      const clientId = String(params.client_id ?? '');

      if (name == 'login') {
        const username = req.session.username;
        if (!username) {
          // Come back here once the user has logged in to this application.
          req.session.loginReturnTo = `/interaction/${uid}`;
          res.redirect('/login');
          return;
        }
        await assertClientAllowed(serverConfig, clientId, username);
        const result: InteractionResults = {
          login: {
            accountId: username,
          },
        };
        await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        return;
      }

      if (name == 'consent') {
        // Consent is only ever requested for an authenticated SSO session, and
        // the tokens will be issued for that session's account.
        const accountId = details.session?.accountId;
        if (!accountId) {
          next(new UserError('invalid interaction'));
          return;
        }
        await assertClientAllowed(serverConfig, clientId, accountId);
        res.render('interaction-consent', {
          title: `Log in to ${clientId}`,
          username: accountId,
          clientId,
          uid,
        });
        return;
      }

      next(new UserError('invalid interaction'));
    } catch (e) {
      next(e);
    }
  });

  // Sessions created before this route was retired may still return here after a login.
  app.get('/interaction/:uid/login', (req, res) => {
    res.redirect(`/interaction/${encodeURIComponent(req.params.uid)}`);
  });

  app.post('/interaction/:uid/confirm', urlencodedParser, async (req, res, next) => {
    try {
      const details = await getInteraction(provider, req, res);
      if (!details) {
        next(new UserError('interaction session not found'));
        return;
      }
      const { prompt: { name, details: promptDetails }, params } = details;
      if ('consent' !== name) {
        next(new UserError('invalid interaction'));
        return;
      }
      const accountId = details.session?.accountId;
      if (!accountId) {
        next(new UserError('invalid interaction'));
        return;
      }
      const clientId = String(params.client_id ?? '');
      await assertClientAllowed(serverConfig, clientId, accountId);

      let { grantId } = details;
      let grant;
      if (grantId) {
        // modifying an existing grant in an existing session
        grant = await provider.Grant.find(grantId);
      } else {
        // establishing a new grant
        grant = new provider.Grant({
          accountId,
          clientId,
        });
      }

      if (!grant) {
        next(new UserError('invalid interaction'));
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
      if (!details.grantId) {
        result.consent!.grantId = grantId;
      }

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
    } catch (e) {
      next(e);
    }
  });
};
