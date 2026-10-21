#!/bin/sh
# Vendors the browser (wasm32-unknown-unknown) release of rusqsieve, the quadratic-sieve
# factorizer used by the login proof-of-work, into assets/factorization/rusqsieve/.
# Bump VERSION and SHA256 together; the tarball checksum is verified before anything is copied.
set -eu

VERSION=0.5.0
SHA256=0aa848640ecdecdd5f58c5e56276c9648b60033dfe43bd13ded1f821da5b9e24
URL="https://github.com/metastable-void/rusqsieve/releases/download/v${VERSION}/rusqsieve-${VERSION}-wasm32-unknown-unknown.tar.gz"

root=$(cd "$(dirname "$0")/.." && pwd)
dest="$root/assets/factorization/rusqsieve"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsSL -o "$tmp/release.tar.gz" "$URL"
echo "$SHA256  $tmp/release.tar.gz" | sha256sum -c -
tar -xzf "$tmp/release.tar.gz" -C "$tmp"
src="$tmp/rusqsieve-${VERSION}-wasm32-unknown-unknown"

mkdir -p "$dest"
for f in abi.js coordinator.js worker.js numtheory.js rusqsieve.wasm rusqsieve-simd.wasm; do
  cp "$src/web/$f" "$dest/$f"
done
cat > "$dest/VENDORED.md" <<NOTICE
# rusqsieve ${VERSION} (vendored)

Browser build of [rusqsieve](https://github.com/metastable-void/rusqsieve) by
metastable-void, licensed under Apache-2.0 OR MPL-2.0, used here under the
Apache License 2.0. Files other than \`factorize.js\` are unmodified copies of
\`web/\` from the \`rusqsieve-${VERSION}-wasm32-unknown-unknown\` release tarball
(SHA-256 \`${SHA256}\`); \`factorize.js\` is this project's driver.

To update, bump VERSION and SHA256 in \`scripts/vendor-rusqsieve.sh\` and run it.
NOTICE
(cd "$dest" && sha256sum abi.js coordinator.js worker.js numtheory.js rusqsieve.wasm rusqsieve-simd.wasm > SHA256SUMS)
echo "vendored rusqsieve ${VERSION} into $dest"
