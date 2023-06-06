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
import { execFile } from 'node:child_process';
import { ALIASES_PATH } from '../defs.js';

const aliasesPath = ALIASES_PATH;

const executePostalias = async (aliasesPath: string) => {
  return new Promise<void>((resolve, reject) => {
    execFile('postalias', [aliasesPath], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

export const getAliases = async () => {
  if (!aliasesPath) {
    throw new Error('ALIASES_PATH is not set');
  }
  return fs.readFile(aliasesPath, 'utf-8');
};

export const updateAliases = async (aliases: string) => {
  if (!aliasesPath) {
    throw new Error('ALIASES_PATH is not set');
  }
  await fs.writeFile(aliasesPath, aliases);
  await executePostalias(aliasesPath);
};
