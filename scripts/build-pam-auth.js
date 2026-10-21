// Builds the standalone PAM helper: native/pam-auth.c -> build/pam-auth
// Honors CC, CFLAGS and LDFLAGS from the environment.

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'native', 'pam-auth.c');
const outputDir = path.join(root, 'build');
const output = path.join(outputDir, 'pam-auth');

const splitFlags = (value) => (value ?? '').split(/\s+/).filter((flag) => flag !== '');

const cc = process.env.CC || 'cc';
const args = [
  ...splitFlags(process.env.CFLAGS ?? '-O2'),
  '-Wall',
  '-Wextra',
  '-o', output,
  source,
  ...splitFlags(process.env.LDFLAGS),
  '-lpam',
];

mkdirSync(outputDir, { recursive: true });
console.log(`> ${cc} ${args.join(' ')}`);
const result = spawnSync(cc, args, { stdio: 'inherit' });
if (result.error || result.status !== 0) {
  if (result.error) {
    console.error(result.error.message);
  }
  console.error(`
Failed to build the PAM helper (${output}).
A C compiler and the PAM development files are required, for example:
  Debian/Ubuntu: apt install build-essential libpam0g-dev
  Fedora/RHEL:   dnf install gcc pam-devel
To install without building it (the server cannot authenticate users until it is built), run:
  npm install --ignore-scripts
and build it later with: npm run build:pam-auth
`);
  process.exit(1);
}
console.log(`Built ${output}`);
