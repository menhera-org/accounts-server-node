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

## Login proof-of-work

Before a password is accepted, the browser must factor a balanced RSA-style
semiprime issued by the server (`src/server/auth-quiz-factorization.ts`). The
factorization runs in the browser with [rusqsieve](https://github.com/metastable-void/rusqsieve),
a quadratic sieve compiled to WebAssembly, vendored under
`assets/factorization/rusqsieve/` by `scripts/vendor-rusqsieve.sh` (the release
tarball is checksum-verified; see `VENDORED.md` there). `factorize.js` drives
rusqsieve's coordinator and sieve workers from the login page.

Sizes are configured in bits (even numbers):

- `LOGIN_QUIZ_BITS` (default 240): size of the first puzzle.
- `LOGIN_QUIZ_STEP_BITS` (default 16) and `LOGIN_QUIZ_MAX_BITS` (default 288):
  every failed login attempt raises the next puzzle by one step, up to the
  maximum, so the default escalation is 240, 256, 272, 288 bits.
- Failures are counted per session and per client address bucket (IPv4 host,
  IPv6 /64) in MongoDB; a bucket's count expires `LOGIN_FAILURE_WINDOW_SECONDS`
  (default 3600) after its last failure. The client address is taken from the
  `X-Real-IP` header when the connection comes from a trusted proxy (the
  `trust proxy` setting: loopback and unique-local addresses), otherwise from
  `req.ip`.

Each solved puzzle is valid for a single password attempt.

## Reverse proxy

The server expects to sit behind a TLS-terminating reverse proxy (Nginx). The
proxy must send `X-Forwarded-Proto` (the session cookie is `Secure` and the
OIDC provider derives its URLs from it) and the client address as `X-Real-IP`
or `X-Forwarded-For`. Those headers are honoured only from the addresses listed
in `TRUSTED_PROXIES` (default `loopback,uniquelocal`: the local host and
private RFC 1918 / ULA addresses). When the proxy runs on another host with a
public or global address, list that address or subnet, for example
`TRUSTED_PROXIES=loopback,2001:db8:10::5`.

## Dependency policy

`.npmrc` sets `min-release-age=21`: npm releases that support the setting
(recent npm 11 and npm 12) only resolve package versions published at least
21 days earlier. Keep `package-lock.json` committed and deploy with `npm ci`.

`mongodb` is listed as a direct dependency only so that `connect-mongo` and
`mongoose` share a single copy of the driver; keep its range equal to the
`mongodb` range declared by the installed `mongoose` version.

## License

Apache-2.0.
