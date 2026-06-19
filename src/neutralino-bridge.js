// src/neutralino-bridge.js
// Neutralino.js adapter — implements window.electronAPI and window.nova
// using Neutralino's extension system, keeping React components unchanged.
// Falls back to direct browser fetch() when Neutralino is unavailable (dev mode).

import { init } from '@neutralinojs/lib';

// ── Detect runtime environment ──
const isNeutralino = () => typeof Neutralino !== 'undefined' && !!Neutralino.extensions;

// ── Direct browser fetch to OpenRouter (dev mode fallback) ──
async function browserFetchAI(endpoint, params) {
  const { apiKey, model, messages, systemPrompt, userMsg } = params;
  const body = messages
    ? { model: model || 'openai/gpt-4o-mini', messages, max_tokens: 1200 }
    : { model: model || 'openai/gpt-4o-mini', messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ], max_tokens: 1000 };
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
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
    return localStorage.getItem('meridian_api_key') || null;
  }
  if (method === 'setApiKey') {
    localStorage.setItem('meridian_api_key', params);
    return;
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
    init();
    return;
  }

  // ── Step 2: Try Vite dev server proxy (localhost:5173/auth_info.json) ──
  try {
    const res = await fetch('/auth_info.json');
    if (res.ok) {
      const auth = await res.json();
      if (auth.nlToken) {
        window.NL_TOKEN = auth.nlToken;
        window.NL_PORT = auth.nlPort;
      }
    }
  } catch (_) {
    // Not running under Vite dev server – ignore
  }

  // ── Step 3: Fallback — fetch __neutralino_globals.js directly ──
  // This handles cases where the script tag didn't set the globals
  // (e.g., when loaded via file:// or other non-standard setups).
  if (!window.NL_TOKEN) {
    try {
      const res = await fetch('__neutralino_globals.js');
      if (res.ok) {
        const text = await res.text();
        const match = text.match(/var NL_TOKEN='([^']*)'/);
        if (match && match[1]) {
          window.NL_TOKEN = match[1];
        }
        const portMatch = text.match(/var NL_PORT=(\d+)/);
        if (portMatch && portMatch[1]) {
          window.NL_PORT = portMatch[1];
        }
      }
    } catch (_) {
      // ignore
    }
  }

  // ── Initialize Neutralino ──
  init();
})();
