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

import { execFile } from 'node:child_process';
import { ADMIN_GROUP } from '../defs.js';
import { sendMessage } from './child-channel.js';

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
      const output = stdout.trim();
      const groupsMatches = output.match(/groups=([0-9]+\(.*?\)(?:,[0-9]+\(.*?\))*)/);
      const groups: string[] = [];
      if (groupsMatches && groupsMatches[1]) {
        const groupStrings = groupsMatches[1].split(',');
        for (const groupString of groupStrings) {
          const matches = groupString.match(/([0-9]+)\((.*?)\)/);
          if (!matches) {
            continue;
          }
          const groupName = matches[2] as string;
          groups.push(groupName);
        }
      }
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

export const getAliases = async (): Promise<string> => {
  return sendMessage('postaliases_get', null);
};

export const updateAliases = async (aliases: string): Promise<void> => {
  await sendMessage('postaliases_update', aliases);
};

export const callChangePassword = async (username: string, oldPassword: string, newPassword: string): Promise<void> => {
  await sendMessage('change_password', { username, oldPassword, newPassword });
};
