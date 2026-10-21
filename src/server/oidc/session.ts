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

import Provider from 'oidc-provider';
import { Request, Response } from 'express';

/**
 * Loads the oidc-provider (SSO) session referenced by the request's cookies.
 * When the browser has no valid SSO session, a fresh unsaved session is returned
 * (its `accountId` is undefined).
 */
export const getProviderSession = async (provider: Provider, req: Request, res: Response) => {
  const ctx = provider.createContext(req, res);
  return provider.Session.get(ctx);
};

/**
 * Ends the oidc-provider (SSO) session referenced by the request's cookies, if any,
 * and clears its cookie.
 *
 * This must not be called while an interaction that references the session is in
 * progress: oidc-provider refuses to resume an interaction whose session changed.
 *
 * @returns the accountId of the destroyed session, if there was one
 */
export const destroyProviderSession = async (provider: Provider, req: Request, res: Response): Promise<string | undefined> => {
  const ctx = provider.createContext(req, res);
  const session = await provider.Session.get(ctx);
  const accountId = session.accountId;
  // Only sessions loaded from the store carry an expiry.
  if ('number' == typeof session.exp) {
    await session.destroy();
  }
  ctx.cookies.set(provider.cookieName('session'), null, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return accountId;
};
