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

import { randomUUID } from "node:crypto";
import { ChildProcess } from "node:child_process";
import { PromiseInfo, createPromise } from "./promises.js";

export type MessageCallback = (message: any) => Promise<any | void>;

interface Message {
  type: 'request' | 'response';
  id: string;
  data: any;
  isError: boolean;
}

interface MessageInfo {
  id: string;
  sentTime: number;
  promiseInfo: PromiseInfo<any>;
}

export class MessageChannel {
  public static RESPONSE_TIMEOUT = 10000;

  private callback: MessageCallback;
  private childProcess?: ChildProcess;
  private messageStates = new Map<string, MessageInfo>();

  public readonly mode: 'parent' | 'child';

  public constructor(callback: MessageCallback, childProcess?: ChildProcess) {
    this.callback = callback;
    if (childProcess) {
      this.mode = 'parent';
      this.childProcess = childProcess;
      childProcess.on('message', (message: Message) => {
        this.processMessage(message);
      });
    } else {
      this.mode = 'child';
      if (!process.send) {
        throw new Error('process.send is not defined');
      }
      process.on('message', (message: Message) => {
        this.processMessage(message);
      });
    }

    setInterval(() => {
      const now = Date.now();
      for (const [id, messageInfo] of this.messageStates) {
        if (now - messageInfo.sentTime > MessageChannel.RESPONSE_TIMEOUT) {
          messageInfo.promiseInfo.reject(new Error('Response timeout'));
          this.messageStates.delete(id);
        }
      }
    }, MessageChannel.RESPONSE_TIMEOUT);
  }

  private sendMessage(message: Message): void {
    if (this.mode === 'parent') {
      if (!this.childProcess) {
        throw new Error('Child process is not defined');
      }
      this.childProcess.send(message);
    } else {
      if (!process.send) {
        throw new Error('process.send is not defined');
      }
      process.send(message);
    }
  }

  private processMessage(message: Message): void {
    if (message.type == 'request') {
      this.callback(message.data).then((result) => {
        const messageData: Message = {
          type: 'response',
          id: message.id,
          data: result,
          isError: false,
        };
        this.sendMessage(messageData);
      }).catch((e) => {
        const messageData: Message = {
          type: 'response',
          id: message.id,
          data: String(e?.message ?? e),
          isError: true,
        };
        this.sendMessage(messageData);
      })
    } else {
      const id = message.id;
      const messageInfo = this.messageStates.get(id);
      this.messageStates.delete(id);
      if (!messageInfo) {
        console.warn(`Message ${id} is not found`);
        return;
      }
      if (message.isError) {
        messageInfo.promiseInfo.reject(new Error(message.data));
      } else {
        messageInfo.promiseInfo.resolve(message.data);
      }
    }
  }

  public send(message: any): Promise<any> {
    const id = randomUUID();
    const messageInfo = {
      id,
      sentTime: Date.now(),
      promiseInfo: createPromise<any>(),
    };
    this.messageStates.set(id, messageInfo);
    const messageData: Message = {
      type: 'request',
      id,
      data: message,
      isError: false,
    };
    this.sendMessage(messageData);
    return messageInfo.promiseInfo.promise;
  }
}
