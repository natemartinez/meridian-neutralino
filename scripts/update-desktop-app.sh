#!/bin/bash
# Ensures the desktop .app icon launches Meridian (dev mode).
# Run this from the project root after making code changes.
#
# The desktop app runs 'npx neu run' (dev mode) for full feature parity
# with the terminal-launched version.
#
# Usage: bash scripts/update-desktop-app.sh

set -e

APP="$HOME/Desktop/Meridian.app"
LAUNCH_SCRIPT="$APP/Contents/MacOS/Meridian"
PROJECT_DIR="$HOME/Documents/dev-projects/meridian-neutralino"

echo "=== Writing launch script ==="
cat > "$LAUNCH_SCRIPT" << 'LAUNCH_SCRIPT_EOF'
#!/bin/bash
# Meridian launcher — macOS .app bundle entry point
#
# Launches Meridian via 'npx neu run' (dev mode) for full feature parity
# with the terminal-launched version.
#
# If the Vite dev server is already running (e.g., from a previous launch
# or from the terminal), this script will just open a new Neutralino window
# connected to the existing server instead of starting a duplicate.

PROJECT_DIR="$HOME/Documents/dev-projects/meridian-neutralino"
LOCK_FILE="/tmp/meridian-neu-run.lock"
VITE_PORT=5173
DEV_URL="http://localhost:$VITE_PORT"
LOG_FILE="/tmp/meridian-launcher.log"

# Redirect all output to log file AND terminal for debugging
exec > >(tee -a "$LOG_FILE") 2>&1

echo "$(date): === Meridian Launcher Started ==="

# --- Helper: check if Vite dev server is already running ---
is_vite_running() {
  curl -sf "$DEV_URL" > /dev/null 2>&1
}

# --- Helper: launch Neutralino binary directly (connects to existing Vite server) ---
launch_neutralino() {
  local binary="$PROJECT_DIR/bin/neutralino-mac_arm64"
  if [ ! -x "$binary" ]; then
    echo "ERROR: Neutralino binary not found at $binary"
    return 1
  fi
  echo "Opening Neutralino window connected to existing dev server at $DEV_URL..."
  "$binary" --load-dir-res --path="$PROJECT_DIR" --url="$DEV_URL" --export-auth-info --neu-dev-extension &
  return 0
}

# --- Helper: start full 'npx neu run' (Vite + Neutralino) ---
start_neu_run() {
  echo "=== Starting Meridian via 'npx neu run' ==="
  cd "$PROJECT_DIR" || { echo "ERROR: Project directory not found at $PROJECT_DIR"; exit 1; }
  echo $$ > "$LOCK_FILE"

  # Use local neu from node_modules to avoid npx download delays
  if [ -x "node_modules/.bin/neu" ]; then
    echo "Using local neu from node_modules/.bin/neu"
    ./node_modules/.bin/neu run
    EXIT_CODE=$?
    echo "neu run exited with code $EXIT_CODE"
    exit $EXIT_CODE
  else
    echo "Local neu not found, using npx --yes neu run"
    npx --yes neu run
    EXIT_CODE=$?
    echo "npx neu run exited with code $EXIT_CODE"
    exit $EXIT_CODE
  fi
}

# --- Main logic ---

# 1) Check lock file first
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "Meridian dev server is already running (PID $LOCK_PID via lock file)."
    launch_neutralino
    exit $?
  else
    echo "Removing stale lock file (PID $LOCK_PID is not running)"
    rm -f "$LOCK_FILE"
  fi
fi

# 2) Check if Vite is already running (from terminal or orphaned from previous launch)
if is_vite_running; then
  echo "Vite dev server is already running on port $VITE_PORT."
  # Write a lock file so future launches can detect us
  NEU_PID=$(pgrep -f "npx.*neu run" 2>/dev/null | head -1)
  if [ -n "$NEU_PID" ]; then
    echo "$NEU_PID" > "$LOCK_FILE"
  fi
  launch_neutralino
  exit $?
fi

# 3) Check for orphaned 'npx neu run' process (Vite might have died but neu CLI is still running)
NEU_PID=$(pgrep -f "npx.*neu run" 2>/dev/null | head -1)
if [ -n "$NEU_PID" ]; then
  echo "Found orphaned 'npx neu run' process (PID $NEU_PID) — Vite is not responding."
  echo "Killing stale process and starting fresh..."
  kill "$NEU_PID" 2>/dev/null
  sleep 1
  rm -f "$LOCK_FILE"
fi

# 4) Start fresh
start_neu_run
LAUNCH_SCRIPT_EOF

echo "=== Making launch script executable ==="
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
echo ""
echo "If the app doesn't start, check the log: cat /tmp/meridian-launcher.log"
