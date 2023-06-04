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
import { ALIASES_PATH, ADMIN_GROUP } from './defs.js';

const aliasesPath = ALIASES_PATH;

export const executePostalias = async (aliasesPath: string) => {
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

export const userExists = async (username: string) => {
  return new Promise<boolean>((resolve, reject) => {
    execFile('id', [username], (error) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
};

export const userInGroup = async (username: string, group: string) => {
  return new Promise<boolean>((resolve, reject) => {
    execFile('id', [username], (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      const groups = stdout.match(/groups=[0-9]+\((.*?)\)(?:,[0-9]+\((.*?)\))/)?.slice(1) ?? [];
      resolve(groups.includes(group));
    });
  });
};

export const validateAliasName = (aliasName: string) => {
  return !!aliasName.match(/^[a-z][a-z0-9.-]{0,31}$/);
};

export const userIsAdmin = async (username: string) => {
  return userInGroup(username, ADMIN_GROUP);
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
