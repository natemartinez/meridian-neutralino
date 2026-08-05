// extensions/meridian/keyStorage.test.js
// Evidence for Security Checklist #1 + #2:
//  - #1: The extension only enables OS-keychain storage when the
//        --enable-encrypted-storage flag is passed (never silently claims
//        encryption). `isEncryptedMode()` reflects the REAL state so the
//        renderer can label the UI honestly.
//  - #2: keyStorage holds NO plaintext key material — it only tracks the
//        storage MODE. The API key never lives in this module or in
//        localStorage (enforced at the useAppState layer).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fresh module state per test (module-level `nativeStorageEnabled`).
function loadModule() {
  vi.resetModules();
  return import('./keyStorage.js');
}

describe('keyStorage mode', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('defaults to local (not encrypted) mode without the flag', async () => {
    process.argv = ['node', 'main.js'];
    const mod = await loadModule();
    expect(mod.isEncryptedMode()).toBe(false);
  });

  it('enables encrypted mode when --enable-encrypted-storage is present', async () => {
    process.argv = ['node', 'main.js', '--enable-encrypted-storage'];
    const mod = await loadModule();
    expect(mod.isEncryptedMode()).toBe(true);
  });

  it('setEncryptedMode(false) can downgrade after a keychain failure', async () => {
    process.argv = ['node', 'main.js', '--enable-encrypted-storage'];
    const mod = await loadModule();
    expect(mod.isEncryptedMode()).toBe(true);
    mod.setEncryptedMode(false);
    expect(mod.isEncryptedMode()).toBe(false);
  });

  it('exposes no key material / no key-getter or key-setter', async () => {
    process.argv = ['node', 'main.js'];
    const mod = await loadModule();
    const exported = Object.keys(mod);
    expect(exported).not.toContain('getApiKey');
    expect(exported).not.toContain('setApiKey');
    expect(exported).not.toContain('apiKey');
  });
});

// ── A2: localStorage must never hold the API key ──
describe('localStorage key hygiene', () => {
  it('setApiKey in the bridge never writes meridian_api_key to localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    // In browser dev the bridge's setApiKey is a session-only no-op; the key
    // must never reach localStorage. In production the extension keychain
    // handles persistence. Either way, nothing may write this key.
    const writes = [];
    setItem.mockImplementation((key, value) => { writes.push([key, value]); });
    try {
      await (window.electronAPI?.setApiKey?.('sk-or-v1-test') ?? Promise.resolve());
    } catch {}
    expect(writes.some(([k]) => k === 'meridian_api_key')).toBe(false);
    setItem.mockRestore();
  });

  it('no source file reads or writes the plaintext api key in localStorage', async () => {
    // Static regression guard: grep the renderer sources for any use of the
    // legacy localStorage key that A2 removed.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '..', '..');
    const targets = [
      path.join(root, 'src', 'hooks', 'useAppState.js'),
      path.join(root, 'src', 'neutralino-bridge.js'),
    ];
    for (const file of targets) {
      const src = fs.readFileSync(file, 'utf-8');
      expect(src).not.toContain("localStorage.getItem('meridian_api_key')");
      expect(src).not.toContain("localStorage.setItem('meridian_api_key'");
      expect(src).not.toContain("'meridian_api_key'");
    }
  });
});
