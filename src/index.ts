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

import 'dotenv/config';
import { SERVER_USER } from './defs.js';
import { BASE_PATH } from './base-path.js';
import { fork } from 'node:child_process';
import * as path from 'node:path';
import { getUserIds } from './lib/unix-users.js';
import { MessageChannel } from './lib/MessageChannel.js';
import { Message } from './lib/Message.js';
import { getAliases, updateAliases } from './parent/postaliases.js';
import { execPamAuth } from './parent/exec-pam-auth.js';
import { getServerConfiguration } from './parent/get-configuration.js';
import { changePassword } from './parent/chpasswd.js';

const SERVER_SCRIPT_PATH = path.resolve(BASE_PATH, 'dist/server.js');

process.title = 'accounts-server';

const startServer = async (): Promise<void> => {
  const { uid, gid } = await getUserIds(SERVER_USER);
  const child = fork(SERVER_SCRIPT_PATH, [], {
    detached: false,
    uid,
    gid,
  });
  const channel = new MessageChannel(async (message: Message) => {
    switch (message.type) {
      case 'server_config_get': {
        return await getServerConfiguration();
      }

      case 'postaliases_get': {
        return await getAliases();
      }

      case 'postaliases_update': {
        if ('string' != typeof message.data) {
          throw new Error('postaliases_update: invalid data type');
        }
        await updateAliases(message.data);
        return;
      }

      case 'pam_auth': {
        if ('object' != typeof message.data || null === message.data) {
          throw new Error('pam_auth: invalid data type');
        }
        if (!('username' in message.data) || 'string' != typeof message.data.username) {
          throw new Error('pam_auth: invalid username');
        }
        if (!('password' in message.data) || 'string' != typeof message.data.password) {
          throw new Error('pam_auth: invalid password');
        }
        const  { username, password } = message.data;
        return execPamAuth({ username, password });
      }

      case 'change_password': {
        if ('object' != typeof message.data || null === message.data) {
          throw new Error('change_password: invalid data type');
        }
        if (!('username' in message.data) || 'string' != typeof message.data.username) {
          throw new Error('change_password: invalid username');
        }
        if (!('oldPassword' in message.data) || 'string' != typeof message.data.oldPassword) {
          throw new Error('change_password: invalid oldPassword');
        }
        if (!('newPassword' in message.data) || 'string' != typeof message.data.newPassword) {
          throw new Error('change_password: invalid newPassword');
        }
        const { username, oldPassword, newPassword } = message.data;
        await changePassword(username, oldPassword, newPassword);
        return;
      }
    }
  }, child);

  child.on('exit', (code, signal) => {
    console.error(`Child process exited with code ${code} and signal ${signal}`);
    process.exit(1);
  });
};

startServer().catch((e) => {
  console.error(e);
  process.exit(1);
});
