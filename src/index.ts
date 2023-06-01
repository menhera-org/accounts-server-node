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

import path from 'node:path';
import * as url from 'node:url';
import { spawn } from 'node:child_process';
import express from 'express';
import 'dotenv/config';
import session from 'express-session';
import { pamAuthenticatePromise, pamErrors, PamError } from 'node-linux-pam';

declare module 'express-session' {
  interface SessionData {
    username: string;
  }
}

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const app = express();

const SESSION_MAX_AGE = 1000 * 60 * 60 * 24; // 1 day

const PORT = parseInt(process.env.PORT || '3000', 10);
const SECRET = process.env.SECRET;
if (!SECRET) {
  throw new Error('SECRET is not set');
}

const staticDir = path.join(__dirname, '../static');
const assetsDir = path.join(__dirname, '../assets');

app.use(express.urlencoded({ extended: true }));

app.use('/assets', express.static(assetsDir));

app.use(session({
  secret: SECRET,
  saveUninitialized: true,
  cookie: {
    maxAge: SESSION_MAX_AGE,
    secure: false,
  },
  resave: false,
}));

app.get('/', (req, res) => {
  const session = req.session;
  if (!session.username) {
    res.redirect('/login');
  }
  res.sendFile('index.html', { root: staticDir });
});

app.get('/login', (req, res) => {
  if (req.session.username) {
    res.redirect('/');
    return;
  }
  res.sendFile('login.html', { root: staticDir });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/login');
  });
});

app.get('/change-password', (req, res) => {
  res.sendFile('change-password.html', { root: staticDir });
});

app.get('/get-username', (req, res) => {
  if (!req.session.username) {
    res.json({
      logged_in: false,
      username: null,
    });
    return;
  }
  res.json({
    logged_in: true,
    username: req.session.username,
  });
});

app.post('/change-password', async (req, res) => {
  if (!req.session.username) {
    res.redirect('/login');
    return;
  }
  const username = req.session.username;
  const currentPassword = req.body.currentPassword;
  const newPassword1 = req.body.newPassword1;
  const newPassword2 = req.body.newPassword2;
  try {
    await pamAuthenticatePromise({
      username,
      password: currentPassword,
    });
  } catch (e) {
    res.redirect('/change-password?error=auth-error');
    return;
  }
  if (newPassword1 !== newPassword2 || newPassword1.includes('\r') || newPassword1.includes('\n') || newPassword1.includes('\t')) {
    res.redirect('/change-password?error=invalid-password');
    return;
  }
  if (username.includes(':')) {
    res.redirect('/change-password?error=invalid-username');
    return;
  }
  let stdout = '';
  try {
    const proc = spawn('sudo', ['-H', '-u', username, 'passwd']);
    proc.stdin.write(`${currentPassword}\n`);
    proc.stdin.write(`${newPassword1}\n`);
    proc.stdin.write(`${newPassword2}\n`);
    proc.stdin.end();
    proc.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
      stdout += data;
    });
    proc.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
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
    res.redirect('/');
    return;
  } catch (e) {
    console.error(e);
    const message = encodeURIComponent(stdout);
    res.redirect('/change-password?error=change-password-error&message=' + message);
    return;
  }
});

app.post('/auth', (req, res) => {
  if (req.session.username) {
    res.redirect('/');
    return;
  }
  const username = req.body.username;
  const password = req.body.password;
  pamAuthenticatePromise({
    username,
    password,
  }).then(() => {
    req.session.regenerate(function (err) {
      if (err) {
        console.error(err);
        res.redirect('/login?error=internal-error');
        return;
      }

      req.session.username = username;

      // save the session before redirection to ensure page
      // load does not happen before session is saved
      req.session.save(function (err) {
        if (err) {
          console.error(err);
          res.redirect('/login?error=internal-error');
          return;
        }
        res.redirect('/');
      });
    });

  }).catch((e) => {
    res.redirect('/login?error=auth-error');
    return;
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
