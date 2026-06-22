# Neutralino Close Button Fix — `dispatch_sync` SIGTRAP Abort

## Problem

Clicking the close button (red X) on the Meridian Neutralino macOS desktop app causes a **"Quit Unexpectedly"** error dialog. The app window closes but the error dialog appears, which macOS interprets as a crash.

## Root Cause

The Neutralino server C++ code at [`api/window/window.cpp`](https://github.com/neutralinojs/neutralinojs/blob/v6.8.0/api/window/window.cpp) calls:

```cpp
dispatch_sync(dispatch_get_main_queue(), ^{
    nativeWindow->terminate(exitCode);
});
```

`dispatch_sync` is designed to **block the current thread** until the block executes on the target queue. However, when the close button is clicked, the `WEBVIEW_WINDOW_CLOSE` event handler is already executing on the **main thread** (`com.apple.main-thread`). Calling `dispatch_sync` to dispatch to the same queue you're already on is a **libdispatch contract violation** — it would cause a deadlock if libdispatch allowed it. Instead, libdispatch detects this and intentionally aborts with:

```
BUG IN CLIENT OF LIBDISPATCH: dispatch_sync called on queue already owned by current thread
```

This is delivered as `EXC_BREAKPOINT (SIGTRAP)`, which macOS reports as a "Quit Unexpectedly" crash.

## The Fix

Replace the unconditional `dispatch_sync` with a **main-thread check**:

```cpp
// Safe from any thread:
if(dispatch_queue_get_label(DISPATCH_CURRENT_QUEUE_LABEL) ==
   dispatch_queue_get_label(dispatch_get_main_queue())) {
    // Already on main thread — call directly (no dispatch needed)
    nativeWindow->terminate(exitCode);
} else {
    // On a background thread — dispatch to main thread synchronously
    dispatch_sync(dispatch_get_main_queue(), ^{
        nativeWindow->terminate(exitCode);
    });
}
```

### Why not `dispatch_async`?

The original attempted fix was `dispatch_sync` → `dispatch_async`. This is **wrong** because:

```cpp
dispatch_async(dispatch_get_main_queue(), ^{
    nativeWindow->terminate(exitCode);  // runs LATER on main thread
});
delete nativeWindow;  // runs IMMEDIATELY — nativeWindow is freed before terminate() runs!
nativeWindow = nullptr;
```

`dispatch_async` returns immediately without waiting for the block to execute. The `delete nativeWindow` on the next line runs before `nativeWindow->terminate()` has a chance to execute, causing a **use-after-free** crash.

## How to Rebuild the Patched Binary

If the binary needs to be rebuilt (e.g., after a Neutralino version upgrade):

```bash
# 1. Clone the Neutralino server source
git clone --depth 1 --branch v6.8.0 https://github.com/neutralinojs/neutralinojs.git /tmp/neutralinojs

# 2. Apply the fix
# Edit /tmp/neutralinojs/api/window/window.cpp
# Find the _close() function and replace dispatch_sync with the main-thread check

# 3. Build
cd /tmp/neutralinojs && mkdir -p build && cd build
python3 -m cmake .. -DCMAKE_OSX_ARCHITECTURES="arm64"
python3 -m cmake --build . -j$(sysctl -n hw.ncpu)

# 4. Replace the binary
cp /tmp/neutralinojs/bin/neutralino-mac_arm64 \
   /path/to/project/bin/neutralino-mac_arm64

# 5. Update the SHA256 checksum in validate-config.sh
shasum -a 256 /path/to/project/bin/neutralino-mac_arm64
# Copy the output hash and update EXPECTED_HASH in scripts/validate-config.sh
```

## Files Modified in This Fix

| File | Change |
|------|--------|
| [`neutralino.config.json`](../neutralino.config.json:41) | `exitProcessOnClose` set to `true` (safe with patched binary) |
| [`bin/neutralino-mac_arm64`](../bin/neutralino-mac_arm64) | Patched binary (original backed up as `neutralino-mac_arm64.bak`) |
| [`scripts/validate-config.sh`](../scripts/validate-config.sh) | Build-time validation: SHA256 checksum verifies patched binary |
| [`eslint.config.js`](../eslint.config.js:38) | Warns if `exitProcessOnClose` is `false` (should be `true` with patched binary) |
| [`src/neutralino-bridge.js`](../src/neutralino-bridge.js:204) | Runtime assertion updated for patched binary |

## Guardrails

Three layers of protection prevent regression:

1. **Build-time** ([`scripts/validate-config.sh`](../scripts/validate-config.sh)): Runs on `npm run prebuild` and `npm run predist`. Uses a **SHA256 checksum** of the known-good patched binary to deterministically verify the binary hasn't been replaced with an unpatched version. This is far more reliable than the previous size/date heuristic.

2. **Runtime** ([`src/neutralino-bridge.js:204`](../src/neutralino-bridge.js:204)): On app startup, checks `Neutralino.app.getConfig()` to verify `exitProcessOnClose` is `true`. Logs a warning if not.

3. **ESLint** ([`eslint.config.js:38`](../eslint.config.js:38)): `no-restricted-syntax` rule warns if `exitProcessOnClose` is set to `false` in the config.

## Detection

If the close button crash reappears:

1. **Check the crash report**: Look for `dispatch_sync called on queue already owned by current thread` and `window::_close` in the backtrace.

2. **Verify the binary**: Run `bash scripts/validate-config.sh` — it will compare the binary's SHA256 against the known-good hash and report whether it matches.

3. **Check the config**: Verify `neutralino.config.json` has `"exitProcessOnClose": true`.

4. **Check the ESLint output**: Run `npx eslint neutralino.config.json` to verify no `no-restricted-syntax` warnings.
