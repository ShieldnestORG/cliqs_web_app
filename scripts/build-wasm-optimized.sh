#!/usr/bin/env bash
#
# Build optimized CW3/CW4 WASM binaries using cosmwasm/optimizer.
#
# This produces binaries WITHOUT bulk-memory opcodes, safe for ALL chains
# including Coreum (wasmd v0.54, no bulk-memory support).
#
# Requirements:
#   - Docker (running)
#   - ~2-5 GB disk for the optimizer image + build cache
#   - ~5-10 min on first build (downloads crates + compiles)
#
# Usage:
#   ./scripts/build-wasm-optimized.sh                      # build all
#   ./scripts/build-wasm-optimized.sh cw3_fixed_multisig   # build one
#
set -euo pipefail

OPTIMIZER_IMAGE="cosmwasm/optimizer:0.16.1"
CW_PLUS_VERSION="${CW_PLUS_VERSION:-v0.16.0}"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/wasm"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)/.wasm-build"

CONTRACTS=("${@:-cw3_fixed_multisig cw3_flex_multisig cw4_group}")
if [ "$#" -eq 0 ]; then
  CONTRACTS=(cw3_fixed_multisig cw3_flex_multisig cw4_group)
fi

# Verify Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running."
  echo "Start Docker Desktop and try again."
  exit 1
fi

echo "==> Building optimized WASM with ${OPTIMIZER_IMAGE}"
echo "    cw-plus version: ${CW_PLUS_VERSION}"
echo ""

# Clone cw-plus if not already present
if [ ! -d "$BUILD_DIR/cw-plus" ]; then
  echo "==> Cloning CosmWasm/cw-plus ${CW_PLUS_VERSION}..."
  mkdir -p "$BUILD_DIR"
  git clone --depth 1 --branch "$CW_PLUS_VERSION" \
    https://github.com/CosmWasm/cw-plus.git "$BUILD_DIR/cw-plus"
else
  echo "==> Using existing cw-plus checkout at $BUILD_DIR/cw-plus"
  echo "    (delete $BUILD_DIR to force re-clone)"
fi

cd "$BUILD_DIR/cw-plus"

# Run the optimizer
echo ""
echo "==> Running cosmwasm/optimizer (this may take 5-10 minutes on first run)..."
docker run --rm \
  -v "$(pwd)":/code \
  --mount type=volume,source=cw_plus_cache,target=/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  "$OPTIMIZER_IMAGE"

echo ""
echo "==> Copying optimized binaries..."

mkdir -p "$OUT_DIR"

for contract in "${CONTRACTS[@]}"; do
  src="artifacts/${contract}.wasm"
  dest="$OUT_DIR/${contract}.wasm"

  if [ ! -f "$src" ]; then
    echo "  [warn] $src not found in artifacts — skipping"
    continue
  fi

  cp "$src" "$dest"
  size=$(wc -c < "$dest" | tr -d ' ')
  echo "  [ok] ${contract}.wasm (${size} bytes / $((size / 1024)) KB)"

  # Verify no bulk-memory opcodes
  if python3 -c "
data = open('$dest', 'rb').read()
found = False
for b2, name in [(0x08,'memory.init'),(0x09,'data.drop'),(0x0a,'memory.copy'),(0x0b,'memory.fill')]:
    c = sum(1 for i in range(len(data)-1) if data[i]==0xfc and data[i+1]==b2)
    if c: print(f'  WARNING: {name} x{c}'); found=True
if not found: print('  [safe] No bulk-memory opcodes')
" 2>/dev/null; then
    true
  else
    echo "  [skip] Python3 not available for bulk-memory check"
  fi
done

echo ""
echo "==> Done! Optimized WASM files are in $OUT_DIR/"
echo ""
echo "These binaries are safe for ALL chains including Coreum."
echo "To verify: python3 -c \"data=open('file.wasm','rb').read(); print('bulk-mem' if b'\\xfc\\x0b' in data else 'clean')\""
