# accounts-server-node

Manage accounts using PAM

## Requirements

- Node.js 22.12 or later (`oidc-provider` 9 and `mongoose` 9 no longer support Node.js 20)
- MongoDB (web sessions and OIDC provider state)
- A C compiler and the PAM development files, to build the PAM helper:
  - Debian/Ubuntu: `apt install build-essential libpam0g-dev`
  - Fedora/RHEL: `dnf install gcc pam-devel`

## Building

```sh
npm ci            # also compiles the PAM helper (build/pam-auth) through the postinstall hook
npm run build     # TypeScript -> dist/
npm audit
```

`npm install --ignore-scripts` skips the helper build (for example on a development
machine without the PAM headers); build it later with `npm run build:pam-auth`.
The server cannot authenticate anybody until `build/pam-auth` exists.

## PAM helper

Password checks go through `build/pam-auth`, a small standalone C program
(`native/pam-auth.c`) that the privileged parent process spawns for every login
(`pam-auth <service> <username>`, password on stdin, exit status 0 on success).
It replaces the former `node-linux-pam` native addon. Being a separate executable
rather than a Node.js addon, it does not depend on the Node.js ABI, N-API,
node-gyp or node-pre-gyp, so upgrading Node.js cannot break the PAM layer.
The PAM service name comes from `PAM_SERVICE_NAME` (default `login`).

## Dependency policy

`.npmrc` sets `min-release-age=21`: npm releases that support the setting
(recent npm 11 and npm 12) only resolve package versions published at least
21 days earlier. Keep `package-lock.json` committed and deploy with `npm ci`.

`mongodb` is listed as a direct dependency only so that `connect-mongo` and
`mongoose` share a single copy of the driver; keep its range equal to the
`mongodb` range declared by the installed `mongoose` version.

## License

Apache-2.0.
