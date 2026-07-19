// src/neutralino-bridge.js
// Neutralino.js adapter — implements window.electronAPI and window.nova
// using Neutralino's extension system, keeping React components unchanged.
// Falls back to direct browser fetch() when Neutralino is unavailable (dev mode).

import { init } from '@neutralinojs/lib';

// ── Neutralino auth token (module-scoped, not exposed on window) ──
let _nlToken = null;
let _nlPort = null;

// ── Detect runtime environment ──
const isNeutralino = () => typeof Neutralino !== 'undefined' && !!Neutralino.extensions;

// ── Direct browser fetch to OpenRouter (dev mode fallback) ──
async function browserFetchAI(endpoint, params) {
  const { apiKey, model, messages, systemPrompt, userMsg, schemaType } = params;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const body = messages
    ? { model: model || 'deepseek-v4-flash', messages, max_tokens: 4096 }
    : { model: model || 'deepseek-v4-flash', messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ], max_tokens: 4096 };
  // DeepSeek supports json_object (not json_schema).
  // When schemaType is provided, use json_object to enforce JSON output.
  if (schemaType) {
    body.response_format = { type: 'json_object' };
  }
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(endpoint === 'aiChat' ? 45000 : 30000),
  });
  if (!r.ok) {
    let errMsg = `HTTP ${r.status}: ${r.statusText}`;
    try { const errBody = await r.json(); if (errBody?.error?.message) errMsg = errBody.error.message; } catch {}
    throw new Error(errMsg);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Extension IPC Helper ──
async function ext(method, params) {
  if (isNeutralino()) {
    try {
      const result = await Neutralino.extensions.dispatch('meridian', method, params);
      if (!result.success) throw new Error(result.error);
      return result.data;
    } catch (err) {
      throw err;
    }
  }
  // ── Browser fallback (Neutralino not available) ──
  if (method === 'aiQuery' || method === 'aiChat') {
    return browserFetchAI(method, params);
  }
  if (method === 'getApiKey') {
    return null; // API key is stored in OS keychain via extension only
  }
  if (method === 'setApiKey') {
    return; // API key is stored in OS keychain via extension only
  }
  if (method === 'getModel') {
    return localStorage.getItem('meridian_model') || null;
  }
  if (method === 'setModel') {
    localStorage.setItem('meridian_model', params);
    return;
  }
  if (method === 'saveState') {
    // State is already persisted via useLocalStorageSync — no-op in browser
    return;
  }
  if (method === 'loadState') {
    return null; // App.jsx already loads from localStorage directly
  }
  if (method === 'getMorningTime' || method === 'setMorningTime' || method === 'writePomodoroState') {
    return; // Non-critical in dev mode
  }
  // For nova.* methods, silently no-op in browser mode
  return;
}

// ── window.electronAPI ──
window.electronAPI = {
  saveState:            (state) => ext('saveState', state),
  loadState:            ()      => ext('loadState'),
  getApiKey:            ()      => ext('getApiKey'),
  setApiKey:            (key)   => ext('setApiKey', key),
  getModel:             ()      => ext('getModel'),
  setModel:             (m)     => ext('setModel', m),
  getMorningTime:       ()      => ext('getMorningTime'),
  setMorningTime:       (time)  => ext('setMorningTime', time),
  onMorningPrompt:      (cb)    => { if (isNeutralino()) Neutralino.events.on('morningPrompt', (evt) => cb(evt.detail)); },
  queryAI:              (params) => ext('aiQuery', params),
  chatNOVA:             (params) => ext('aiChat', params),
  writePomodoroState:   (state) => ext('writePomodoroState', state),
};

// ── window.nova ──
window.nova = {
  session: {
    save:      (s)         => ext('novaSessionSave', s),
    getRange:  (from, to)  => ext('novaSessionGetRange', { from, to }),
    getRecent: (n)         => ext('novaSessionGetRecent', n ?? 20),
  },
  insight: {
    save:       (i)  => ext('novaInsightSave', i),
    getActive:  ()   => ext('novaInsightGetActive'),
    deactivate: (id) => ext('novaInsightDeactivate', id),
  },
  checkin: {
    save:      (c) => ext('novaCheckinSave', c),
    getRecent: (n) => ext('novaCheckinGetRecent', n ?? 20),
  },
  behavioral: {
    log:      (s)         => ext('novaBehavioralLog', s),
    getRange: (from, to)  => ext('novaBehavioralGetRange', { from, to }),
    getToday: ()          => ext('novaBehavioralGetToday'),
  },
  knowledge: {
    upsert: (e)  => ext('novaKnowledgeUpsert', e),
    delete: (id) => ext('novaKnowledgeDelete', id),
    getAll: ()   => ext('novaKnowledgeGetAll'),
  },
};

// ── Auth Bootstrap ──
// In production mode, __neutralino_globals.js is injected as a <script> tag
// in index.html and loads synchronously BEFORE the app module. It sets
// window.NL_TOKEN and window.NL_PORT as global variables.
//
// In dev mode (--load-dir-res), __neutralino_globals.js sets NL_TOKEN=''
// because the real token lives in .tmp/auth_info.json. During Vite dev,
// the neuAuthProxy plugin serves it at /auth_info.json.
//
// This bootstrap ensures NL_TOKEN and NL_PORT are available before
// @neutralinojs/lib's init() establishes the WebSocket connection.
// In plain browser dev mode (Neutralino not available), skip init() entirely.
(async () => {
  // ── Step 0: Check if Neutralino is available at all ──
  // In plain browser dev mode (npx neu run with Vite), Neutralino is not
  // available. Skip the entire bootstrap to avoid ReferenceErrors.
  if (typeof Neutralino === 'undefined') {
    return;
  }

  // ── Step 1: Check if already set by __neutralino_globals.js <script> tag ──
  // In production, the synchronous script tag in index.html sets these globals
  // before the app module ever loads, so they should already be available.
  if (window.NL_TOKEN && window.NL_PORT) {
    // Already have auth from production __neutralino_globals.js — proceed
    _nlToken = window.NL_TOKEN;
    _nlPort = window.NL_PORT;
    // Clear from window to reduce XSS exposure
    delete window.NL_TOKEN;
    delete window.NL_PORT;
    init();
    registerWindowCloseHandler();
    return;
  }

  // ── Step 2: Try Vite dev server proxy (localhost:5173/auth_info.json) ──
  try {
    const res = await fetch('/auth_info.json');
    if (res.ok) {
      const auth = await res.json();
      if (auth.nlToken) {
        _nlToken = auth.nlToken;
        _nlPort = auth.nlPort;
      }
    }
  } catch (_) {
    // Not running under Vite dev server – ignore
  }

  // ── Step 3: Fallback — fetch __neutralino_globals.js directly ──
  // This handles cases where the script tag didn't set the globals
  // (e.g., when loaded via file:// or other non-standard setups).
  if (!_nlToken) {
    try {
      const res = await fetch('__neutralino_globals.js');
      if (res.ok) {
        const text = await res.text();
        const match = text.match(/var NL_TOKEN='([^']*)'/);
        if (match && match[1]) {
          _nlToken = match[1];
        }
        const portMatch = text.match(/var NL_PORT=(\d+)/);
        if (portMatch && portMatch[1]) {
          _nlPort = portMatch[1];
        }
      }
    } catch (_) {
      // ignore
    }
  }

  // ── Initialize Neutralino ──
  init();
  registerWindowCloseHandler();
})();

// ── Graceful shutdown on window close ──
// Close event handling uses a multi-layer defensive strategy:
// 1. exitProcessOnClose is set to false in neutralino.config.json to prevent
//    the C++ dispatch_sync crash. Instead, Neutralino dispatches a windowClose
//    event to the JavaScript layer.
// 2. We register handlers on Neutralino.events.on('windowClose', ...) for
//    proper Neutralino event handling.
// 3. We also register browser-level beforeunload/unload handlers as fallbacks.
function registerWindowCloseHandler() {
  // Runtime safety check: verify the patched binary is in use
  // With the patched binary (dispatch_sync → dispatch_async fix),
  // exitProcessOnClose: true is safe and provides reliable close behavior.
  // This check catches regressions where the binary was replaced with
  // an unpatched version.
  try {
    Neutralino.app.getConfig().then(config => {
      const exitOnClose = config?.modes?.window?.exitProcessOnClose;
      if (exitOnClose !== true) {
        console.warn(
          '%c⚠ exitProcessOnClose is ' + JSON.stringify(exitOnClose) + ' — expected true with patched binary',
          'color: orange; font-weight: bold;'
        );
      }
    }).catch(() => {});
  } catch (_) {
    // Neutralino.app.getConfig() may not be available (e.g., browser dev mode)
  }

  // Guard against re-entrancy — prevent double execution
  if (window.__neutralinoClosing) return;
  window.__neutralinoClosing = true;

  function safeExit() {
    if (window.__neutralinoClosing) return;
    window.__neutralinoClosing = true;

    // Path 1: Neutralino.app.exit(0) — WebSocket RPC to server
    Neutralino.app.exit(0).catch(() => {});

    // Path 2: Neutralino.app.killProcess() — more forceful WebSocket RPC
    Neutralino.app.killProcess().catch(() => {});

    // Path 3: Extension killProcess dispatch — separate IPC channel
    try {
      Neutralino.extensions.dispatch('meridian', 'killProcess', {});
    } catch (_) {
      // Extension dispatch may also fail — nothing more we can do
    }
  }

  // Layer 1: Neutralino's windowClose event (primary)
  // With exitProcessOnClose: true, the C++ layer handles close directly
  // via the patched dispatch_async call. This handler is a safety net
  // for the beforeunload/unload browser events.
  try {
    Neutralino.events.on('windowClose', safeExit);
  } catch (_) {
    // Neutralino may not be available (e.g., running in browser dev mode)
  }

  // Layer 2: Browser beforeunload event (fallback)
  // Fires when the window/tab is being closed, regardless of Neutralino
  try {
    window.addEventListener('beforeunload', safeExit);
  } catch (_) {
    // Browser may not support this event
  }

  // Layer 3: Browser unload event (last resort)
  // Fires when the document is being unloaded
  try {
    window.addEventListener('unload', safeExit);
  } catch (_) {
    // Browser may not support this event
  }
}
