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

import { isIPv4, isIPv6 } from 'node:net';

const IPV4_MAPPED = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
const DOTTED_TAIL = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

/**
 * Expands an IPv6 address (already validated by net.isIPv6, zone id removed) into its
 * eight 16-bit groups, or returns null if it cannot be parsed.
 */
const expandIPv6 = (address: string): number[] | null => {
  let text = address.toLowerCase();
  let suffix: number[] = [];
  const dotted = text.match(DOTTED_TAIL);
  if (dotted) {
    const octets = dotted[2]!.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet > 255)) {
      return null;
    }
    suffix = [(octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!];
    text = dotted[1]!;
    if (!text.endsWith('::')) {
      text = text.slice(0, -1);
    }
  }
  const halves = text.split('::');
  if (halves.length > 2) {
    return null;
  }
  const parseGroups = (part: string | undefined): number[] | null => {
    if (!part) {
      return [];
    }
    const groups = part.split(':').map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
    return groups.some((group) => Number.isNaN(group)) ? null : groups;
  };
  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
  if (head === null || tail === null) {
    return null;
  }
  const explicit = head.length + tail.length + suffix.length;
  if (halves.length === 2) {
    const fill = 8 - explicit;
    if (fill < 1) {
      return null;
    }
    return [...head, ...new Array<number>(fill).fill(0), ...tail, ...suffix];
  }
  if (explicit !== 8) {
    return null;
  }
  return [...head, ...suffix];
};

/**
 * Maps a client address to the bucket that login failures are counted in:
 * the host itself for IPv4 (/32) and the /64 prefix for IPv6. IPv4-mapped IPv6
 * addresses count as IPv4. Returns null for anything that is not an IP address.
 *
 * Examples: "203.0.113.5" -> "203.0.113.5/32", "2001:db8:1:2:aaaa::1" -> "2001:db8:1:2::/64".
 */
export const ipBucket = (ip: string | undefined | null): string | null => {
  if ('string' != typeof ip) {
    return null;
  }
  let address = ip.trim();
  const zone = address.indexOf('%');
  if (zone >= 0) {
    address = address.slice(0, zone);
  }
  if (isIPv4(address)) {
    return `${address}/32`;
  }
  if (!isIPv6(address)) {
    return null;
  }
  const mapped = address.match(IPV4_MAPPED);
  if (mapped && isIPv4(mapped[1]!)) {
    return `${mapped[1]}/32`;
  }
  const groups = expandIPv6(address);
  if (!groups) {
    return null;
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(':')}::/64`;
};
