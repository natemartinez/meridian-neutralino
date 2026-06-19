#!/bin/bash
# Ensures the desktop .app icon launches 'npx neu run' (dev mode).
# Run this from the project root after making code changes.
#
# Since the desktop app now runs 'npx neu run' instead of the production
# binary, there is no production build step needed. This script simply
# ensures the launch script is up to date and the app is accessible.

set -e

APP="$HOME/Desktop/Meridian.app"
LAUNCH_SCRIPT="$APP/Contents/MacOS/Meridian"

echo "=== Ensuring launch script is executable ==="
chmod +x "$LAUNCH_SCRIPT"

echo "=== Removing quarantine attribute ==="
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo ""
echo "=== Done! Double-click Meridian.app on your desktop to launch ==="
echo ""
echo "NOTE: The desktop app now runs 'npx neu run' (dev mode) to ensure"
echo "feature parity with the terminal-launched version."
echo ""
echo "If you need to rebuild the production bundle for distribution,"
echo "run: npx neu build"
