#!/bin/bash
# scripts/validate-config.sh
# Validates that the Neutralino binary has the dispatch_sync → dispatch_async fix
# applied, which prevents the libdispatch SIGTRAP abort on window close.
#
# With the patched binary, exitProcessOnClose: true is safe.
# Without the patched binary, exitProcessOnClose must be false.
#
# This script uses a SHA256 checksum of the known-good patched binary to
# deterministically verify the binary is the correct patched version.
#
# In CI environments (GitHub Actions, etc.), the binary checks are skipped
# because CI builds fresh binaries via `npx neu build` rather than using the
# locally-patched binary in bin/. The config validation still runs.
#
# Usage: bash scripts/validate-config.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="neutralino.config.json"
CONFIG_PATH="$PROJECT_DIR/$CONFIG_FILE"
BINARY_PATH="$PROJECT_DIR/bin/neutralino-mac_arm64"

# SHA256 hash of the known-good patched binary (dispatch_sync → main-thread check fix)
# Generated from the cmake build on 2026-06-22 from neutralinojs v6.8.0 source.
# If the binary is rebuilt (e.g., after a Neutralino version upgrade), this hash
# must be updated to match the new patched binary.
EXPECTED_HASH="e8e2da54b0f8c51d5d815b20c3a9175be2eb5dfa4e000029dcfdd68f5a37a30f"

# Detect CI environment — skip binary checks in CI since the patched binary
# in bin/ is not checked into version control. CI builds fresh binaries via
# `npx neu build` which produces its own Neutralino binary in dist/meridian/.
if [ "${CI:-}" = "true" ]; then
  echo "CI environment detected — skipping binary validation (CI builds its own binaries via neu build)"
else
  # Check 1: Binary exists
  if [ ! -f "$BINARY_PATH" ]; then
    echo "ERROR: Neutralino binary not found at $BINARY_PATH"
    echo ""
    echo "  The patched Neutralino binary is required for local development."
    echo "  Build it from source with the dispatch_async patch:"
    echo ""
    echo "    cd /tmp && git clone --depth 1 --branch v6.8.0 https://github.com/neutralinojs/neutralinojs.git"
    echo "    # Apply the main-thread check fix to api/window/window.cpp:_close()"
    echo "    cd neutralinojs && mkdir -p build && cd build"
    echo "    python3 -m cmake .. -DCMAKE_OSX_ARCHITECTURES=\"arm64\""
    echo "    python3 -m cmake --build . -j\$(sysctl -n hw.ncpu)"
    echo "    cp bin/neutralino-mac_arm64 $BINARY_PATH"
    exit 1
  fi

  # Check 2: Verify the binary is the patched version via SHA256 checksum
  # This is a deterministic check — the hash either matches or it doesn't.
  ACTUAL_HASH=$(shasum -a 256 "$BINARY_PATH" | cut -d' ' -f1)

  if [ "$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
    echo "✓ Patched binary verified (SHA256: ${ACTUAL_HASH:0:16}...)"
  else
    echo "✖ SAFETY VIOLATION: Unpatched Neutralino binary detected!"
    echo ""
    echo "  Expected SHA256: $EXPECTED_HASH"
    echo "  Actual SHA256:   $ACTUAL_HASH"
    echo ""
    echo "  The binary at $BINARY_PATH does not match the known-good patched version."
    echo "  If exitProcessOnClose is true, clicking the close button will trigger a"
    echo "  SIGTRAP abort (libdispatch dispatch_sync bug)."
    echo ""
    echo "  Fix: Rebuild the binary from source with the dispatch_async patch, then"
    echo "  update the EXPECTED_HASH in this script to match the new binary."
    echo ""
    echo "  Rebuild instructions:"
    echo "    cd /tmp && git clone --depth 1 --branch v6.8.0 https://github.com/neutralinojs/neutralinojs.git"
    echo "    # Apply the main-thread check fix to api/window/window.cpp:_close()"
    echo "    cd neutralinojs && mkdir -p build && cd build"
    echo "    python3 -m cmake .. -DCMAKE_OSX_ARCHITECTURES=\"arm64\""
    echo "    python3 -m cmake --build . -j\$(sysctl -n hw.ncpu)"
    echo "    cp bin/neutralino-mac_arm64 $BINARY_PATH"
    echo "    shasum -a 256 $BINARY_PATH  # Update EXPECTED_HASH with this output"
    exit 1
  fi
fi

# Check 3: Config file exists (runs in all environments)
if [ ! -f "$CONFIG_PATH" ]; then
  echo "ERROR: $CONFIG_FILE not found at $CONFIG_PATH"
  exit 1
fi

# Check 4: Verify exitProcessOnClose is true (recommended with patched binary)
# This check runs in all environments since the config is always available.
node -e "
const config = require('$CONFIG_PATH');
const exitOnClose = config?.modes?.window?.exitProcessOnClose;
if (exitOnClose === true) {
  console.log('✓ exitProcessOnClose is true — patched binary handles close directly');
  process.exit(0);
} else if (exitOnClose === false) {
  console.log('⚠ exitProcessOnClose is false — JS event handler will be used');
  console.log('  (Consider setting to true for more reliable close behavior with patched binary)');
  process.exit(0);
} else {
  console.error('✖ exitProcessOnClose is ' + JSON.stringify(exitOnClose) + ' — expected true or false');
  process.exit(1);
}
"
