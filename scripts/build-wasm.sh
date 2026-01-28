#!/bin/bash
# Build WASM for beeclock-wasm crate

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CRATE_DIR="$ROOT_DIR/crates/beeclock-wasm"
OUT_DIR="$ROOT_DIR/web/pkg"
NGCLOCK_PUBLIC="$ROOT_DIR/ngclock/public/assets/wasm"

echo "Building beeclock-wasm..."

# Build with wasm-pack
cd "$CRATE_DIR"
wasm-pack build --target web --out-dir "$OUT_DIR"

# Copy to ngclock public assets (served at /assets/wasm/)
mkdir -p "$NGCLOCK_PUBLIC"
cp "$OUT_DIR/beeclock_wasm.js" "$NGCLOCK_PUBLIC/"
cp "$OUT_DIR/beeclock_wasm_bg.wasm" "$NGCLOCK_PUBLIC/"

echo "WASM build complete!"
echo "  Output: $OUT_DIR"
echo "  Copied to: $NGCLOCK_PUBLIC"
