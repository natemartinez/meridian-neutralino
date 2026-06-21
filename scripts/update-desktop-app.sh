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
#
# NOTE: macOS .app bundles launched from Finder have a restricted CWD
# environment where process.cwd() fails with EPERM. We work around this
# by using a Node.js wrapper that changes to PROJECT_DIR before invoking neu.
#
# NOTE: macOS may run universal binaries under Rosetta (x86_64) when
# launched from a .app bundle. We force arm64 architecture to ensure
# native Node.js native bindings (like rolldown) are found.
#
# IMPORTANT: This script MUST exit quickly to avoid macOS Dock marking the
# app as "not responding." macOS monitors the main process of .app bundles
# and expects it to create a window. Since this is a bash script (not a
# native binary), we fork the actual launch into a background process and
# exit immediately. The background process handles everything.

PROJECT_DIR="$HOME/Documents/dev-projects/meridian-neutralino"
LOCK_FILE="/tmp/meridian-neu-run.lock"
VITE_PORT=5173
DEV_URL="http://localhost:$VITE_PORT"
LOG_FILE="/tmp/meridian-launcher.log"

# ── Fork into background immediately ──
# macOS Dock monitors the main process of .app bundles. If the main process
# doesn't create a window within a few seconds, macOS shows "not responding."
# Since this is a bash script, we fork to background and exit the parent
# immediately. The background child process handles the actual launch.
if [ "$1" != "--forked" ]; then
  # Re-launch self in background with --forked flag
  nohup "$0" --forked > /dev/null 2>&1 &
  exit 0
fi

# ── From here on, we're the background forked process ──

# Redirect all output to log file (no terminal since we're backgrounded)
exec >> "$LOG_FILE" 2>&1

echo "$(date): === Meridian Launcher Started (forked) ==="

# ── Detect launch source ──
LAUNCH_SOURCE="unknown"
if [ -n "$_LAUNCHD_SESSION" ]; then
  LAUNCH_SOURCE="launchd"
fi
if [ -n "$LSREGISTER_FORCE" ]; then
  LAUNCH_SOURCE="lsregister"
fi
echo "Launch source: $LAUNCH_SOURCE"
echo "PWD=$(pwd)"
echo "SHELL=$SHELL"
echo "USER=$USER"
echo "HOME=$HOME"

# macOS .app bundles launched from Finder have minimal/empty PATH.
# We must set it explicitly so that node, npx, vite, etc. are found.
export PATH="$PROJECT_DIR/node_modules/.bin:/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin"

# Resolve the actual nvm current node bin directory (if nvm is available)
if [ -d "$HOME/.nvm" ] && command -v node &>/dev/null; then
  NODE_BIN="$(dirname "$(command -v node)")"
  export PATH="$NODE_BIN:$PATH"
  echo "Resolved node from: $NODE_BIN"
fi

echo "Resolved PATH=$PATH"
echo "node=$(command -v node) ($(node --version))"

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
  arch -arm64 "$binary" --load-dir-res --path="$PROJECT_DIR" --url="$DEV_URL" --export-auth-info --neu-dev-extension &
  return 0
}

# --- Helper: start full 'npx neu run' (Vite + Neutralino) ---
# Uses a Node.js wrapper to work around macOS .app bundle CWD restrictions.
# Forces arm64 architecture to ensure native bindings are found.
start_neu_run() {
  echo "=== Starting Meridian via 'npx neu run' ==="
  echo "CWD before chdir: $(pwd)"
  echo "PROJECT_DIR=$PROJECT_DIR"
  echo $$ > "$LOCK_FILE"

  local neu_bin="$PROJECT_DIR/node_modules/.bin/neu"

  if [ -x "$neu_bin" ]; then
    echo "Using local neu from $neu_bin"
    # Wrap in node -e to chdir first, avoiding process.cwd() EPERM from .app bundle.
    # We set process.argv so the neu CLI parses 'run' as the command.
    # Force arm64 architecture to ensure native bindings (rolldown) are found.
    arch -arm64 node -e "
      process.chdir('$PROJECT_DIR');
      console.log('Node.js wrapper: CWD after chdir = ' + process.cwd());
      process.argv = ['node', 'neu', 'run'];
      require('$PROJECT_DIR/node_modules/@neutralinojs/neu/bin/neu');
    " 2>&1
    EXIT_CODE=$?
    echo "neu run exited with code $EXIT_CODE"
    echo "Lock file PID: $$ (current shell), lock file contents: $(cat "$LOCK_FILE" 2>/dev/null || echo 'MISSING')"
    exit $EXIT_CODE
  else
    echo "Local neu not found, using npx --yes neu run"
    cd "$PROJECT_DIR" || { echo "ERROR: Project directory not found at $PROJECT_DIR"; exit 1; }
    echo "CWD after cd: $(pwd)"
    arch -arm64 npx --yes neu run 2>&1
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
    echo "Launching Neutralino window directly (instant) — connected to existing dev server."
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
  echo "Launching Neutralino window directly (instant) — connected to existing dev server."
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

# ── Re-register with macOS Launch Services ──
# This ensures the Dock and Finder pick up the updated launch script.
# Without this, the Dock may cache an old registration and fail to launch.
echo "=== Re-registering with Launch Services ==="
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" 2>/dev/null || true
touch "$APP"

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
