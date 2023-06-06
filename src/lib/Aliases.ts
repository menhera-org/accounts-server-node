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

export class Aliases {
  private contents: string;

  private aliases: Record<string, string[]> = {};
  private userAlternativeNames: Record<string, string[]> = {};

  public constructor(contents: string) {
    this.contents = contents;
    this.parse();
  }

  private parse() {
    const lines = this.contents.split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      return (!line.match(/^\s*#/)) && line != '';
    });
    const logicalLines: string[] = [];
    for (const line of lines) {
      if (line.match(/^\s+/)) {
        if (logicalLines[logicalLines.length - 1]) {
          logicalLines[logicalLines.length - 1] += line;
        } else {
          throw new Error('Invalid line');
        }
      } else {
        logicalLines.push(line);
      }
    }
    const aliases: Record<string, string[]> = {};
    for (const line of logicalLines) {
      const parts = line.split(':');
      if (parts.length != 2) {
        throw new Error('Invalid line');
      }
      const [alias, usersStr] = parts as [string, string];
      const aliasName = alias.trim();
      const users = usersStr.split(/\s+/).map((user) => user.trim()).filter((user) => user != '');
      if (users.length == 0) {
        continue;
      } else if (users.length == 1) {
        const user = users[0] as string;
        const altNames = this.userAlternativeNames[user] ?? [];
        altNames.push(aliasName);
        this.userAlternativeNames[user] = altNames;
      }
      aliases[aliasName] = users;
    }
    this.aliases = aliases;
  }

  private encode() {
    const lines: string[] = [];
    for (const alias in this.aliases) {
      const users = this.aliases[alias] ?? [];
      lines.push(`${alias}: ${users.join(' ')}`);
    }
    lines.push('');
    this.contents = lines.join('\n');
  }

  /**
   * You should ensure that no such user exists before calling this method.
   */
  public addPersonalAlias(user: string, alias: string) {
    if (alias in this.aliases) {
      throw new Error('Alias already exists');
    }
    this.aliases[alias] = [user];
    const altNames = this.userAlternativeNames[user] ?? [];
    altNames.push(alias);
    this.userAlternativeNames[user] = altNames;
  }

  public removePersonalAlias(user: string, alias: string) {
    if (!(alias in this.aliases)) {
      return;
    }
    const users = this.aliases[alias] ?? [];
    if (users.length != 1 || users[0] != user) {
      throw new Error('Alias is not owned by user');
    }
    delete this.aliases[alias];
    const altNames = this.userAlternativeNames[user] ?? [];
    const index = altNames.indexOf(alias);
    if (index >= 0) {
      altNames.splice(index, 1);
    }
    this.userAlternativeNames[user] = altNames;
  }

  public getPersonalAliases(user: string): string[] {
    return this.userAlternativeNames[user] ?? [];
  }

  public createMailingList(alias: string, users: string[]) {
    if (alias in this.aliases) {
      throw new Error('Alias already exists');
    }
    if (users.length < 2) {
      throw new Error('Mailing list must have at least two members');
    }
    this.aliases[alias] = users;
  }

  public getMailingLists(): string[] {
    const lists: string[] = [];
    for (const alias in this.aliases) {
      const users = this.aliases[alias] ?? [];
      if (users.length >= 2) {
        lists.push(alias);
      }
    }
    return lists;
  }

  public getMailingListMembers(alias: string): string[] {
    const users = this.aliases[alias] ?? [];
    if (users.length < 2) {
      throw new Error('Alias is not a mailing list');
    }
    return users;
  }

  public removeMailingListMember(alias: string, user: string) {
    const users = this.aliases[alias] ?? [];
    if (users.length < 2) {
      throw new Error('Alias is not a mailing list');
    }
    const index = users.indexOf(user);
    if (index < 0) {
      throw new Error('User is not a member of the mailing list');
    }
    users.splice(index, 1);
    if (users.length < 2) {
      delete this.aliases[alias];
      return;
    }
    this.aliases[alias] = users;
  }

  public addMailingListMember(alias: string, user: string) {
    const users = this.aliases[alias] ?? [];
    if (users.length < 2) {
      throw new Error('Alias is not a mailing list');
    }
    if (users.indexOf(user) >= 0) {
      throw new Error('User is already a member of the mailing list');
    }
    users.push(user);
    this.aliases[alias] = users;
  }

  public removeMailingList(alias: string) {
    const users = this.aliases[alias] ?? [];
    if (users.length < 2) {
      throw new Error('Alias is not a mailing list');
    }
    delete this.aliases[alias];
  }

  public mailingListExists(alias: string): boolean {
    const users = this.aliases[alias] ?? [];
    return users.length >= 2;
  }

  public aliasExists(alias: string): boolean {
    return alias in this.aliases;
  }

  public toString() {
    this.encode();
    return this.contents;
  }
}
