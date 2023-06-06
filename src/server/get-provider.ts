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

import { getConfiguration } from "./oidc/configuration.js";
import { OIDC_ISSUER } from "../defs.js";
import { oidc } from "./oidc/provider.js";
import Provider from "oidc-provider";
import { ServerConfiguration } from "../lib/ServerConfiguration.js";

export const getProvider = async (config: ServerConfiguration): Promise<Provider> => {
  const configuration = await getConfiguration(config);
  const provider = oidc(OIDC_ISSUER, configuration);
  return provider;
};
