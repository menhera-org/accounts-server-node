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

import * as crypto from 'node:crypto';
import { Express, Request, Response } from 'express';
import { pamAuthenticatePromise } from './pam-auth-client.js';
import { Aliases } from '../lib/Aliases.js';
import { urlencodedParser } from './middlewares.js';
import { STATIC_DIR } from '../base-path.js';
import { userExists, userInGroup, validateAliasName, getAliases, updateAliases, userIsAdmin, callChangePassword, userIsInternal } from './system.js';
import { ADMIN_GROUP, ALL_LISTS_USER, INTERNAL_GROUP } from '../defs.js';
import Provider from 'oidc-provider';
import { generatePrimeQuiz } from './auth-quiz-factorization.js';
import { generateQuiz } from './auth-quiz.js';
import { getGroups } from '../lib/unix-users.js';

const staticDir = STATIC_DIR;

export const defineRoutes = async (app: Express, provider: Provider) => {
  const getContext = (req: Request, res: Response) => {
    return provider.app.createContext(req, res);
  };

  app.get('/', urlencodedParser, (req, res) => {
    const session = req.session;
    if (!session.username) {
      res.redirect('/login');
      return;
    }
    const message = req.query.message ?? '';
    userIsInternal(session.username).then((isInternal) => {
      if (!isInternal) {
        res.render('index-external', {
          username: session.username,
          title: 'Accout management',
          message,
        });
      } else {
        res.render('index', {
          username: session.username,
          title: 'Accout management',
          message,
        });
      }
    }).catch((e) => {
      console.error(e);
      res.redirect('/login');
    });
  });

  app.get('/email-aliases', (req, res) => {
    const session = req.session;
    if (!session.username) {
      res.redirect('/login');
      return;
    }
    userIsInternal(session.username).then((isInternal) => {
      if (!isInternal) {
        res.redirect('/');
        return;
      }
      res.render('email-aliases', {
        username: session.username,
        title: 'Email aliases',
      });
    }).catch((e) => {
      console.error(e);
      res.redirect('/');
    });
  });

  app.get('/login', urlencodedParser, (req, res) => {
    if (req.session.username) {
      res.redirect('/');
      return;
    }
    const loginToken = crypto.randomUUID();
    const quiz = generatePrimeQuiz();
    const {p, q, n} = quiz;
    const answer1 = p;
    const answer2 = q;
    req.session.loginToken = loginToken;
    req.session.quizAnswer1 = answer1;
    req.session.quizAnswer2 = answer2;
    const passwordId = `password-${crypto.randomUUID()}`;
    req.session.passwordFieldName = passwordId;
    const message = req.query.message ?? '';
    const error = req.query.error ?? '';
    res.render('login', {
      title: 'Log in',
      loginToken: loginToken,
      passwordId,
      message,
      error,
      quizFactorization: n,
    });
  });

  app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
        res.redirect('/login?error=logout-failed');
        return;
      }
      res.redirect('/login');
    });
  });

  app.get('/change-password', (req, res) => {
    const session = req.session;
    if (!session.username) {
      res.redirect('/login');
      return;
    }
    const message = req.query.message ?? '';
    const error = req.query.error ?? '';
    res.render('change-password', {
      username: session.username,
      title: 'Change password',
      message,
      error,
    });
  });

  app.get('/mailing-lists', (req, res) => {
    const session = req.session;
    if (!session.username) {
      res.redirect('/login');
      return;
    }
    userIsInternal(session.username).then((isInternal) => {
      if (!isInternal) {
        res.redirect('/');
        return;
      }
      res.render('list/lists', {
        username: session.username,
        title: 'Mailing lists',
      });
    }).catch((e) => {
      console.error(e);
      res.redirect('/');
    });
  });

  app.get('/mailing-list', urlencodedParser, (req, res) => {
    const session = req.session;
    if (!session.username) {
      res.redirect('/login');
      return;
    }
    const listName = req.query.list;
    userIsInternal(session.username).then((isInternal) => {
      if (!isInternal) {
        res.redirect('/');
        return;
      }
      res.render('list/list', {
        username: session.username,
        title: 'Mailing list',
        listName,
      });
    }).catch((e) => {
      console.error(e);
      res.redirect('/');
    });
  });

  app.get('/get-username', (req, res) => {
    if (!req.session.username) {
      res.json({
        logged_in: false,
        username: null,
      });
      return;
    }
    const username = req.session.username;
    getGroups(username).then((groups) => {
      const isInternal = groups.includes(INTERNAL_GROUP);
      const isAdmin = isInternal && groups.includes(ADMIN_GROUP);
      res.json({
        logged_in: true,
        username,
        is_internal: isInternal,
        is_admin: isAdmin,
        groups,
      });
    }).catch((e) => {
      console.error(e);
      res.json({
        logged_in: false,
        username: null,
      });
    });
  });

  app.post('/change-password', urlencodedParser, async (req, res) => {
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
    try {
      await callChangePassword(username, currentPassword, newPassword1);
      res.redirect('/?message=' + encodeURIComponent('Password changed successfully.'));
      return;
    } catch (e: any) {
      const errorStr = String(e?.message ?? e);
      res.redirect('/change-password?error=change-password-error&message=' + encodeURIComponent(errorStr));
      return;
    }
  });

  app.post('/auth', urlencodedParser, (req, res, next) => {
    try {
      const loginReturnTo = req.session.loginReturnTo || '/';
      if (!loginReturnTo.startsWith('/') || loginReturnTo.startsWith('//')) {
        next(new Error('invalid loginReturnTo'));
        return;
      }
      if (req.session.username) {
        req.session.loginReturnTo = '';
        res.redirect(loginReturnTo);
        return;
      }
      const recordLoginFailure = () => {
        if (req.session.loginDisabledUntil && req.session.loginDisabledUntil > Date.now()) {
          req.session.loginDisabledUntil = Date.now() + 600 * 1000;
          return;
        }
        if (!req.session.loginFailureCount) {
          req.session.loginFailureCount = 1;
        } else {
          req.session.loginFailureCount = Number(req.session.loginFailureCount) + 1;
        }
        const count = Number(req.session.loginFailureCount);
        if (count > 2) {
          req.session.loginDisabledUntil = Date.now() + 600 * 1000;
          req.session.loginFailureCount = 0;
        }
      };
      const passwordId = req.session.passwordFieldName;
      if (!passwordId) {
        console.log('invalid login id');
        res.redirect('/login?error=auth-error');
        return;
      }
      const username = req.body.username;
      const password = req.body[passwordId];
      const dummyPassword = req.body.password;
      const answersStr = req.body.quizFactorizationAnswer as string;
      const token = req.body.token;
      const loginToken = req.session.loginToken;
      const answer1 = req.session.quizAnswer1;
      const answer2 = req.session.quizAnswer2;
      if (!token || token != loginToken || !answer1 || !answer2 || !answersStr) {
        console.log('Invalid answer');
        recordLoginFailure();
        res.redirect('/login?error=auth-error');
        return;
      }
      if (req.session.loginDisabledUntil && req.session.loginDisabledUntil > Date.now()) {
        console.log('login disabled');
        recordLoginFailure();
        res.redirect('/login?error=too-many-failures');
        return;
      }
      const realAnswers = [answer1, answer2].sort() as [string, string];
      const answers = answersStr.split(',').sort() as [string, string];
      if (dummyPassword || answers[0] != realAnswers[0] || answers[1] != realAnswers[1]) {
        console.log('invalid answer');
        recordLoginFailure();
        res.redirect('/login?error=auth-error');
        return;
      }
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

            req.session.loginReturnTo = '';
            res.redirect(loginReturnTo);
          });
        });

      }).catch((e) => {
        recordLoginFailure();
        console.log('pam auth failed');
        res.redirect('/login?error=auth-error');
        return;
      });
    } catch (e) {
      next(e);
    }
  });

  app.post('/add-alias', urlencodedParser, async (req, res) => {
    try {
      if (!req.session.username || !await userIsInternal(req.session.username)) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const aliasName = String(req.body.aliasName).toLowerCase();
      if (!validateAliasName(aliasName)) {
        res.status(400).json({
          error: 'invalid-alias-name',
        });
        return;
      }
      if (await userExists(aliasName)) {
        res.status(400).json({
          error: 'user-exists',
        });
        return;
      }
      const username = req.session.username;
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      aliases.addPersonalAlias(username, aliasName);
      await updateAliases(aliases.toString());
      const userAliases = aliases.getPersonalAliases(username);
      res.json({
        error: null,
        aliases: userAliases,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.post('/remove-alias', urlencodedParser, async (req, res) => {
    try {
      if (!req.session.username || !await userIsInternal(req.session.username)) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const aliasName = req.body.aliasName;
      const username = req.session.username;
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      aliases.removePersonalAlias(username, aliasName);
      await updateAliases(aliases.toString());
      const userAliases = aliases.getPersonalAliases(username);
      res.json({
        error: null,
        aliases: userAliases,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.get('/get-aliases', async (req, res) => {
    try {
      if (!req.session.username || !await userIsInternal(req.session.username)) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const username = req.session.username;
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      const userAliases = aliases.getPersonalAliases(username);
      res.json({
        error: null,
        aliases: userAliases,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.post('/create-list', urlencodedParser, async (req, res) => {
    try {
      if (!req.session.username) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const username = req.session.username;
      const isAdmin = await userIsAdmin(username);
      if (!isAdmin) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const listName = String(req.body.listName).toLowerCase();
      if (!validateAliasName(listName)) {
        res.status(400).json({
          error: 'invalid-list-name',
        });
        return;
      }
      const usersStr = req.body.users as string;
      const users = usersStr.split(',').map((user) => user.trim()).filter((user) => user != '');
      if (!users.includes(ALL_LISTS_USER)) {
        users.push(ALL_LISTS_USER);
      }
      if (users.length < 2) {
        res.status(400).json({
          error: 'invalid-users-count',
        });
        return;
      }
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      for (const user in users) {
        if (aliases.aliasExists(user)) {
          continue;
        }
        if (!await userExists(user)) {
          res.status(400).json({
            error: 'user-not-found',
            user,
          });
          return;
        }
      }
      aliases.createMailingList(listName, users);
      await updateAliases(aliases.toString());
      const lists = aliases.getMailingLists();
      res.json({
        error: null,
        listName,
        users,
        lists,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.get('/get-lists', async (req, res) => {
    try {
      if (!req.session.username || !await userIsInternal(req.session.username)) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      const lists = aliases.getMailingLists();
      res.json({
        error: null,
        lists,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.get('/get-list-members', urlencodedParser, async (req, res) => {
    try {
      if (!req.session.username || !await userIsInternal(req.session.username)) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const listName = req.query.listName as string;
      if (!listName) {
        res.status(400).json({
          error: 'invalid-list-name',
        });
        return;
      }
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      if (!aliases.mailingListExists(listName)) {
        res.status(400).json({
          error: 'list-not-found',
        });
        return;
      }
      const users = aliases.getMailingListMembers(listName).filter((user) => user != ALL_LISTS_USER);
      res.json({
        error: null,
        listName,
        users,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.post('/list-remove-user', urlencodedParser, async (req, res) => {
    try {
      if (!req.session.username) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const username = req.session.username;
      const isAdmin = await userIsAdmin(username);
      if (!isAdmin) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const listName = String(req.body.listName).toLowerCase();
      const removeUsername = String(req.body.removeUsername).toLowerCase();
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      const members = aliases.getMailingListMembers(listName);
      if (!members.includes(removeUsername)) {
        res.status(400).json({
          error: 'user-not-found',
        });
        return;
      }
      let listRemoved = false;
      if (members.length <= 2) {
        aliases.removeMailingList(listName);
        listRemoved = true;
      } else {
        aliases.removeMailingListMember(listName, removeUsername);
      }
      await updateAliases(aliases.toString());
      let users: string[] = [];
      try {
        users = aliases.getMailingListMembers(listName).filter((user) => user != ALL_LISTS_USER);
      } catch (e) {
        // ignore
      }
      const lists = aliases.getMailingLists();
      res.json({
        error: null,
        listName,
        listRemoved,
        users,
        lists,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });

  app.post('/list-add-user', urlencodedParser, async (req, res) => {
    try {
      if (!req.session.username) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const username = req.session.username;
      const isAdmin = await userIsAdmin(username);
      if (!isAdmin) {
        res.status(401).json({
          error: 'unauthorized',
        });
        return;
      }
      const listName = String(req.body.listName).toLowerCase();
      const addUsername = String(req.body.addUsername).toLowerCase();
      const aliasesStr = await getAliases();
      const aliases = new Aliases(aliasesStr);
      if (!aliases.aliasExists(addUsername) && !await userExists(addUsername)) {
        res.status(400).json({
          error: 'user-not-found',
        });
        return;
      }
      const members = aliases.getMailingListMembers(listName);
      if (members.includes(addUsername)) {
        res.status(400).json({
          error: 'user-already-added',
        });
        return;
      }
      aliases.addMailingListMember(listName, addUsername);
      await updateAliases(aliases.toString());
      let users: string[] = [];
      try {
        users = aliases.getMailingListMembers(listName).filter((user) => user != ALL_LISTS_USER);
      } catch (e) {
        // ignore
      }
      const lists = aliases.getMailingLists();
      res.json({
        error: null,
        listName,
        users,
        lists,
      });
    } catch (e) {
      res.status(500).json({
        error: 'internal-error',
      });
      return;
    }
  });
};
