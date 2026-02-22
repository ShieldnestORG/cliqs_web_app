#!/usr/bin/env bash
#
# Download pre-compiled CW3/CW4 WASM binaries from CosmWasm/cw-plus releases.
# These are the optimized builds produced by cosmwasm/optimizer.
#
# Usage:
#   ./scripts/download-wasm.sh [version]
#   ./scripts/download-wasm.sh          # defaults to v0.16.0
#   ./scripts/download-wasm.sh v0.16.0
#
set -euo pipefail

VERSION="${1:-v0.16.0}"
BASE_URL="https://github.com/CosmWasm/cw-plus/releases/download/${VERSION}"
OUT_DIR="$(dirname "$0")/../public/wasm"

CONTRACTS=(
  "cw3_fixed_multisig"
  "cw3_flex_multisig"
  "cw4_group"
)

mkdir -p "$OUT_DIR"

for contract in "${CONTRACTS[@]}"; do
  url="${BASE_URL}/${contract}.wasm"
  dest="${OUT_DIR}/${contract}.wasm"

  if [ -f "$dest" ]; then
    echo "  [skip] ${contract}.wasm already exists"
    continue
  fi

  echo "  [download] ${contract}.wasm from ${VERSION}..."
  if curl -fSL --retry 3 --retry-delay 2 -o "$dest" "$url"; then
    size=$(wc -c < "$dest" | tr -d ' ')
    echo "  [ok] ${contract}.wasm (${size} bytes)"
  else
    echo "  [error] Failed to download ${contract}.wasm"
    rm -f "$dest"
    exit 1
  fi
done

echo ""
echo "All WASM binaries downloaded to ${OUT_DIR}/"
ls -lh "$OUT_DIR"/*.wasm 2>/dev/null || true
