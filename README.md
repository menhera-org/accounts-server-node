# accounts-server-node

Manage accounts using PAM

## Building

Use a supported Node.js release. Building the native PAM binding on Debian or
Ubuntu requires Python 3, `build-essential`, and `libpam0g-dev`.

```sh
npm ci
npm run typecheck
npm run build
npm audit
```

There is no automated application test suite yet. Validate PAM login, MongoDB
sessions, and OIDC authorization/token flows in a configured staging environment
before deployment.

## Dependency overrides

The dependency refresh retains the existing application dependency major versions.
The following overrides are needed until their parent packages update:

- `node-linux-pam` pins an old native build toolchain. Override
  `@mapbox/node-pre-gyp` to 2.x to remove its vulnerable tar dependency, and
  `node-addon-api` to 8.x so the binding compiles with Node.js 24 headers.
- `http-cache-semantics` 4.3.0 fixes GHSA-ch52-4w7c-c8xp in the OIDC provider's
  HTTP cache dependency. This release, published on 2026-10-04, is an explicit
  security exception to the 21-day minimum release age for this refresh.

The refresh used a 2026-10-01 dependency publication cutoff except for that
security fix. Keep the lockfile committed and install with `npm ci`; npm versions
that do not support `min-release-age` will warn and ignore that setting.

## License

Apache-2.0.
