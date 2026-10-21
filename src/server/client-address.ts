/* -*- indent-tabs-mode: nil; tab-width: 2; -*- */
/* vim: set ts=2 sw=2 et ai : */
/**
  Copyright (C) 2026 Menhera.org

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

import { isIP } from 'node:net';
import { Request } from 'express';

/**
 * The client's IP address as seen through the reverse proxy.
 *
 * Express derives req.ip from X-Forwarded-For only; the Nginx in front of this
 * server sends X-Real-IP. That header is used when the connection itself comes
 * from a trusted proxy (the "trust proxy" setting), so a direct client cannot
 * choose its own address. Otherwise req.ip is used, which is the socket address
 * for untrusted peers.
 */
export const getClientAddress = (req: Request): string | undefined => {
  const trust = req.app.get('trust proxy fn') as ((address: string, index: number) => boolean) | undefined;
  const peer = req.socket.remoteAddress;
  if (peer && trust?.(peer, 0)) {
    const realIp = req.get('x-real-ip')?.trim();
    if (realIp && isIP(realIp)) {
      return realIp;
    }
  }
  return req.ip;
};
