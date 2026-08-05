import React, { useState, useEffect, useRef } from 'react';
import { T } from '../utils/theme.js';
import { validateApiKey } from '../utils/api.js';
import { validateOpenRouterKey } from '../utils/openRouterValidation.js';
import meridianLogo from '../assets/meridian_full_logo.png';

/**
 * Onboarding screen for entering and validating an OpenRouter API key.
 *
 * Performs two-stage validation:
 *  1. Client-side format check (instant feedback)
 *  2. Server-side auth test against OpenRouter API (async, with loading state)
 *
 * The server-side result is cached in memory for 5 minutes to avoid
 * redundant API calls during the onboarding flow.
 */
export default function ApiKeyScreen({ onSave, onSkip }) {
  const [val, setVal]       = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [validating, setValidating] = useState(false);
  const [serverStatus, setServerStatus] = useState(null); // 'checking' | 'valid' | 'invalid' | null
  const [storageMode, setStorageMode] = useState(null); // 'encrypted' | 'local' | 'browser' | null
  const abortRef = useRef(null);

  // Query the extension for the ACTUAL storage mode so the UI can label
  // honestly ("OS keychain" vs "local file") instead of claiming encryption.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mode = await window.electronAPI?.getKeyStorageMode?.();
        if (!cancelled) setStorageMode(mode || null);
      } catch {
        if (!cancelled) setStorageMode(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  /**
   * Run server-side validation as the user types (debounced).
   * Only triggers when format is valid.
   */
  useEffect(() => {
    const trimmed = val.trim();

    // Reset server status when input changes
    setServerStatus(null);

    // Only run server check if format is valid
    const formatResult = validateApiKey(trimmed);
    if (!formatResult.valid) {
      setErr(formatResult.reason);
      return;
    }

    // Clear any previous error since format is valid
    setErr('');

    // Debounce server-side check
    const timer = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setValidating(true);
      setServerStatus('checking');

      try {
        const result = await validateOpenRouterKey(trimmed, {
          signal: controller.signal,
          cacheTtlMs: 5 * 60 * 1000, // 5 minutes
        });

        if (controller.signal.aborted) return;

        if (result.valid) {
          setServerStatus('valid');
          setErr('');
        } else {
          setServerStatus('invalid');
          setErr(result.reason);
        }
      } catch {
        // Ignore aborted requests
      } finally {
        if (!controller.signal.aborted) {
          setValidating(false);
        }
      }
    }, 800); // 800ms debounce

    return () => {
      clearTimeout(timer);
    };
  }, [val]);

  const handleSave = async () => {
    const trimmed = val.trim();

    // Run format validation first
    const formatResult = validateApiKey(trimmed);
    if (!formatResult.valid) {
      setErr(formatResult.reason);
      const prefix = trimmed ? trimmed.substring(0, 8) + '...' : '(empty)';
      console.warn(`[ApiKeyScreen] Key rejected (${formatResult.code}): ${prefix} — ${formatResult.reason}`);
      return;
    }

    // Run server-side validation if not already done
    if (serverStatus !== 'valid') {
      setValidating(true);
      try {
        const result = await validateOpenRouterKey(trimmed, {
          cacheTtlMs: 5 * 60 * 1000,
        });
        if (!result.valid) {
          setErr(result.reason);
          setValidating(false);
          return;
        }
      } catch {
        setErr('Validation failed. Please check your internet connection and try again.');
        setValidating(false);
        return;
      }
      setValidating(false);
    }

    setSaving(true);
    // Save to extension (Neutralino keychain) — may fail if WebSocket not connected
    try { await (window.electronAPI?.setApiKey(trimmed) ?? Promise.resolve()); }
    catch {
      console.warn('[ApiKeyScreen] Extension unavailable — API key will not persist across sessions');
    }
    onSave(trimmed);
  };

  const isProcessing = saving || validating;

  const storageLabel =
    storageMode === 'encrypted' ? 'stored encrypted in your OS keychain' :
    storageMode === 'local'     ? 'stored locally on this device' :
    storageMode === 'browser'   ? 'session-only (not persisted in browser dev)' :
                                  'storage status unavailable';

  return (
    <div style={{ position:'fixed', inset:0, background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:'40px 48px', width:440, boxShadow:'0 8px 40px #00000080' }}>
        <img src={meridianLogo} alt="Meridian" style={{ width:180, display:'block', marginBottom:12 }} />
        <div style={{ color:T.muted, fontSize:13, marginBottom:28, lineHeight:1.5 }}>
          Enter your API key to enable AI features.<br/>
          Get a key at <strong>openrouter.ai/keys</strong> — {storageLabel}.
        </div>

        {/* Input field */}
        <div style={{ position:'relative' }}>
          <input
            type="password"
            placeholder="sk-or-v1-..."
            value={val}
            onChange={e => { setVal(e.target.value); }}
            onKeyDown={e => e.key === 'Enter' && !isProcessing && handleSave()}
            style={{
              width:'100%', boxSizing:'border-box', background:T.surface,
              border:`1px solid ${err ? T.rose : serverStatus === 'valid' ? T.emerald : T.border}`,
              borderRadius:8, padding:'10px 14px', color:T.text, fontSize:14,
              fontFamily:'IBM Plex Mono,monospace', outline:'none',
              marginBottom: err || serverStatus ? 6 : 16,
              paddingRight: 40,
            }}
          />

          {/* Status indicator */}
          {serverStatus === 'checking' && (
            <span style={{
              position:'absolute', right:12, top:10, fontSize:12, color:T.muted,
            }}>
              ✓
            </span>
          )}
          {serverStatus === 'valid' && (
            <span style={{
              position:'absolute', right:12, top:10, fontSize:16, color:T.emerald,
            }}>
              ✓
            </span>
          )}
        </div>

        {/* Error / status message */}
        {err && <div style={{ color:T.rose, fontSize:12, marginBottom:14 }}>{err}</div>}
        {serverStatus === 'checking' && !err && (
          <div style={{ color:T.muted, fontSize:12, marginBottom:14 }}>
            Checking key with OpenRouter...
          </div>
        )}
        {serverStatus === 'valid' && !err && (
          <div style={{ color:T.emerald, fontSize:12, marginBottom:14 }}>
            Key verified with OpenRouter ✓
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isProcessing || !val.trim()}
          style={{
            width:'100%',
            background: isProcessing ? T.muted : T.accent,
            color:'#07090f', border:'none', borderRadius:8, padding:'11px 0',
            fontWeight:700, fontSize:14,
            cursor: isProcessing || !val.trim() ? 'not-allowed' : 'pointer',
            opacity: isProcessing || !val.trim() ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : validating ? 'Validating…' : 'Save & Continue'}
        </button>

        {/* Skip — enter the app in No-AI mode */}
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={isProcessing}
            style={{
              width:'100%', marginTop:10, background:'none',
              border:'none', color:T.muted, fontSize:12, cursor:'pointer',
              padding:'6px 0', fontFamily:"'IBM Plex Mono',monospace",
            }}
          >
            Skip for now — use Meridian without AI
          </button>
        )}
      </div>
    </div>
  );
}
