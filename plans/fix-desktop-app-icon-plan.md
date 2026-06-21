# Plan: Fix Desktop App Icon Launch

## Root Cause Analysis

The `Meridian.app` on the Desktop crashes immediately with a **Segmentation fault** (exit code 139).

### Evidence from `/tmp/meridian-launcher.log`

```
Neutralino binary: .../neutralino-mac_arm64 (Mach-O 64-bit executable arm64)
Starting Neutralino (production binary)...
INFO ... Auth info was exported to .../.tmp/auth_info.json
... line 68: 19332 Segmentation fault: 11 arch -arm64 "$NEU_BINARY" ...
Neutralino exited with code 139
```

The crash happens **every time** the production-mode launcher runs. The segfault occurs in the Neutralino binary itself (`neutralino-mac_arm64`) immediately after exporting auth info, before it even loads the frontend.

### Two Problems Identified

1. **The launcher script** (`Meridian.app/Contents/MacOS/Meridian`) currently runs in **production mode** — it executes the Neutralino binary directly from the bundle's `Resources/` directory using `arch -arm64 "$NEU_BINARY" --load-dir-res ...`

2. **The bundled Neutralino binary** (`Resources/neutralino-mac_arm64`) is **broken/corrupted** — it segfaults immediately. This binary was likely downloaded by a previous `npx neu build` and either:
   - Is incompatible with the current macOS version
   - Was corrupted during download
   - Has a version mismatch with the Neutralino CLI

### Why Dev Mode Works

The earlier log entries show that when the launcher used **dev mode** (starting Vite + `npx neu run`), Vite started successfully on port 5173. The dev mode uses the Neutralino CLI (`node_modules/.bin/neu`) which manages its own Neutralino binary download and lifecycle, avoiding the broken bundled binary entirely.

## Solution: Revert to Dev Mode Launcher

The simplest and most reliable fix is to **revert the launcher to dev mode** (`npx neu run`), which:
- Uses the project's local `node_modules/.bin/neu` CLI
- Starts Vite dev server + Neutralino together via `npx neu run`
- Avoids the broken bundled binary entirely
- Matches what works when running from terminal (`npm start` or `npx neu run`)

## Steps

### Step 1: Overwrite the launcher script

The current `scripts/update-desktop-app.sh` already contains the correct **dev-mode** launcher script. Running this script will:
- Overwrite `Meridian.app/Contents/MacOS/Meridian` with the dev-mode launcher
- Make it executable (`chmod +x`)
- Remove quarantine attribute (`xattr -dr`)

**Command:** `bash scripts/update-desktop-app.sh`

### Step 2: Clean up stale production artifacts (optional but recommended)

Remove the broken production binary and stale resources from the bundle to avoid confusion:
- `Meridian.app/Contents/Resources/neutralino-mac_arm64` — the broken binary
- `Meridian.app/Contents/Resources/resources.neu` — stale frontend build
- `Meridian.app/Contents/Resources/.tmp/` — stale auth info

These aren't needed in dev mode and keeping them could cause issues if someone accidentally runs the production launcher.

### Step 3: Test

Double-click `Meridian.app` on the Desktop to verify it launches correctly.

## Cleanup Considerations

- The `scripts/update-desktop-app.sh` script is already in the correct state (dev mode) — no changes needed to the script itself
- No code changes are needed in the React app — the issue is purely in the .app bundle configuration
- The `neutralino.config.json` in the project root is correct and doesn't need changes
