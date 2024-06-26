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
import { BASE_PATH } from "../base-path.js";
import { ServerConfiguration } from '../lib/ServerConfiguration.js';

const ORIG_JWKS_PATH = process.env.JWKS_PATH || 'jwks.json';
const JWKS_PATH = path.resolve(BASE_PATH, ORIG_JWKS_PATH);

const ORIG_CLIENTS_PATH = process.env.CLIENTS_PATH || 'clients.json';
const CLIENTS_PATH = path.resolve(BASE_PATH, ORIG_CLIENTS_PATH);

const ORIG_COOKIES_KEYS_PATH = process.env.COOKIES_KEYS_PATH || 'cookies-keys.json';
const COOKIES_KEYS_PATH = path.resolve(BASE_PATH, ORIG_COOKIES_KEYS_PATH);

const ORIG_RESTRICTED_CLIENTS_PATH = process.env.RESTRICTED_CLIENTS_PATH || 'restricted-clients.json';
const RESTRICTED_CLIENTS_PATH = path.resolve(BASE_PATH, ORIG_RESTRICTED_CLIENTS_PATH);

const getJson = async (path: string): Promise<any> => {
  const json = await fs.readFile(path, 'utf-8');
  return JSON.parse(json);
};

export const getServerConfiguration = async (): Promise<ServerConfiguration> => {
  const clients = await getJson(CLIENTS_PATH);
  const jwks = await getJson(JWKS_PATH);
  const cookieKeys = await getJson(COOKIES_KEYS_PATH);
  const restrictedClients = await getJson(RESTRICTED_CLIENTS_PATH);
  return {
    clients,
    jwks,
    cookieKeys,
    restrictedClientIds: restrictedClients,
  };
};
