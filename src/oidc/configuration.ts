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

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Configuration, AccountClaims } from "oidc-provider";
import { userExists } from "../system.js";
import { BASE_PATH } from "../base-path.js";
import { USER_EMAIL_DOMAIN } from '../defs.js';

const ORIG_JWKS_PATH = process.env.JWKS_PATH || 'jwks.json';
const JWKS_PATH = path.resolve(BASE_PATH, ORIG_JWKS_PATH);

const ORIG_CLIENTS_PATH = process.env.CLIENTS_PATH || 'clients.json';
const CLIENTS_PATH = path.resolve(BASE_PATH, ORIG_CLIENTS_PATH);

const ORIG_COOKIES_KEYS_PATH = process.env.COOKIES_KEYS_PATH || 'cookies-keys.json';
const COOKIES_KEYS_PATH = path.resolve(BASE_PATH, ORIG_COOKIES_KEYS_PATH);

const getJson = async (path: string): Promise<any> => {
  const json = await fs.readFile(path, 'utf-8');
  return JSON.parse(json);
};

export const getConfiguration = async (): Promise<Configuration> => {
  const clients = await getJson(CLIENTS_PATH);
  const jwks = await getJson(JWKS_PATH);
  const cookiesKeys = await getJson(COOKIES_KEYS_PATH);
  return {
    clients,
    jwks,
    features: {
      devInteractions: { enabled: false },
      clientCredentials: { enabled: true },
    },
    cookies: {
      keys: cookiesKeys,
    },
    scopes: [
      "openid",
      "offline_access",
      "email",
      "profile",
    ],
    clientBasedCORS(ctx, origin, client) {
      return true;
    },
    async findAccount(ctx, id) {
      if (await userExists(id)) {
        return {
          accountId: id,
          async claims(_use, scope) {
            const email = {
              email: `${id}@${USER_EMAIL_DOMAIN}`,
              email_verified: true,
            };
            const profile = {
              name: id,
            };
            const accountInfo: AccountClaims = {
              sub: id,
            };
            const scopes = scope.split(" ");
            if (scopes.includes('email')) {
              Object.assign(accountInfo, email);
            }
            if (scopes.includes('profile')) {
              Object.assign(accountInfo, profile);
            }
            return accountInfo;
          },
        }
      }
      return undefined;
    },
    pkce: {
      methods: ["S256"],
      required: () => false,
    },
    claims: {
      email: ["email", "email_verified"],
      profile: ["name"],
    },
    interactions: {
      url(ctx, interaction) {
        return `/interaction/${interaction.uid}`;
      },
    },
    ttl: {
      AccessToken: 60 * 60 * 24 * 7, // 1 week
      AuthorizationCode: 60 * 10, // 10 minutes
      BackchannelAuthenticationRequest: 60 * 60, // 1 hour
      ClientCredentials: 60 * 10, // 10 minutes
      DeviceCode: 60 * 10, // 10 minutes
      Grant: 60 * 60 * 24 * 14, // 2 weeks
      IdToken: 60 * 60 * 24 * 7, // 1 week
      Interaction: 60 * 60, // 1 hour
      RefreshToken: 60 * 60 * 24 * 14, // 2 weeks
      Session: 60 * 60 * 24 * 14, // 2 weeks
    },
  };
};
