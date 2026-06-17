// src/neutralino-bridge.js
// Neutralino.js adapter — implements window.electronAPI and window.nova
// using Neutralino's extension system, keeping React components unchanged.

import { init } from '@neutralinojs/lib';

// ── Extension IPC Helper ──
async function ext(method, params) {
  const result = await Neutralino.extensions.dispatch('meridian', method, params);
  if (!result.success) throw new Error(result.error);
  return result.data;
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
  onMorningPrompt:      (cb)    => { Neutralino.events.on('morningPrompt', (evt) => cb(evt.detail)); },
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

// Initialize Neutralino
init();
