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

import { spawn } from "node:child_process";

export const changePassword = async (username: string, oldPassword: string, newPassword: string): Promise<void> => {
  let stdout = '';
  let stderr = '';
  try {
    const proc = spawn('sudo', ['-H', '-u', username, 'passwd']);
    proc.stdin.write(`${oldPassword}\n`);
    proc.stdin.write(`${newPassword}\n`);
    proc.stdin.write(`${newPassword}\n`);
    proc.stdin.end();
    proc.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
      stdout += data;
    });
    proc.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
      stderr += data;
    });
    const code = await new Promise<number>((resolve, reject) => {
      proc.on('exit', (code) => {
        resolve(code ?? 1);
      });
      proc.on('error', (err) => {
        reject(err);
      });
    });
    if (code != 0) {
      throw new Error('passwd failed');
    }
  } catch (e) {
    console.error(e);
    const stderrLines = stderr.split('\n').map((line) => line.trim()).filter((line) => line != '');
    const lastStderrLine = stderrLines[stderrLines.length - 1] ?? '';
    throw new Error(`Error: ${stdout.trim()} (${lastStderrLine})`);
  }
};
