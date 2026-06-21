// extensions/meridian/main.js
// Neutralino.js extension — reuses existing main.js logic

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');

// ── Paths (replaces app.getPath) ──
const HOME = os.homedir();
const DATA_DIR = path.join(HOME, '.config', 'meridian');
const POMODORO_DIR = path.join(HOME, '.config', 'meridian-pomodoro');
const STATE_FILE = path.join(DATA_DIR, 'meridian-state.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DB_FILE = path.join(DATA_DIR, 'nova-memory.db');

// ── Database (reused from main.js) ──
let db;
function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  // Same schema as src/db/schema.js
  db.exec(`
    CREATE TABLE IF NOT EXISTS nova_sessions (
      id TEXT PRIMARY KEY, program TEXT NOT NULL, date TEXT NOT NULL,
      started_at INTEGER NOT NULL, ended_at INTEGER,
      raw_messages TEXT, summary TEXT, energy_level INTEGER, tags TEXT
    );
    CREATE TABLE IF NOT EXISTS nova_insights (
      id TEXT PRIMARY KEY, session_id TEXT, type TEXT NOT NULL,
      content TEXT NOT NULL, confidence REAL, source TEXT NOT NULL,
      created_at INTEGER NOT NULL, is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS nova_checkins (
      id TEXT PRIMARY KEY, asked_at INTEGER NOT NULL,
      query TEXT NOT NULL, response TEXT NOT NULL, context_snapshot TEXT
    );
    CREATE TABLE IF NOT EXISTS nova_behavioral (
      date TEXT PRIMARY KEY, tasks_generated INTEGER, tasks_accepted INTEGER,
      tasks_rejected INTEGER, tasks_completed INTEGER, sync_score_start INTEGER,
      sync_score_end INTEGER, briefing_done INTEGER, regroup_done INTEGER
    );
    CREATE TABLE IF NOT EXISTS knowledge_pool (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, text TEXT NOT NULL,
      source TEXT NOT NULL, confidence REAL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, insight_id TEXT
    );
  `);
}

// ── Extension Message Handler ──
class MeridianExtension {
  async onMessage(id, method, params) {
    switch (method) {
      // ── State ──
      case 'saveState':
        fs.writeFileSync(STATE_FILE, JSON.stringify(params), 'utf-8');
        return { success: true };
      case 'loadState': {
        try {
          const data = fs.readFileSync(STATE_FILE, 'utf-8');
          return { success: true, data: JSON.parse(data) };
        } catch { return { success: true, data: null }; }
      }

      // ── Auth ──
      case 'getApiKey': {
        try {
          const { keytar } = require('keytar');
          const key = await keytar.getPassword('Meridian', 'api-key');
          return { success: true, data: key };
        } catch {
          try {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
            return { success: true, data: settings.apiKey || null };
          } catch { return { success: true, data: null }; }
        }
      }
      case 'setApiKey': {
        try {
          const { keytar } = require('keytar');
          await keytar.setPassword('Meridian', 'api-key', params);
        } catch {
          let settings = {};
          try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch {}
          settings.apiKey = params;
          fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        }
        return { success: true };
      }

      // ── AI (reused from main.js fetch logic) ──
      case 'aiQuery': {
        const { systemPrompt, userMsg, apiKey, model } = params;
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'openai/gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMsg },
            ],
            max_tokens: 1000,
          }),
          signal: AbortSignal.timeout(30000),
        });
        const data = await r.json();
        return { success: true, data: data.choices?.[0]?.message?.content || '' };
      }
      case 'aiChat': {
        const { messages, apiKey, model } = params;
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'openai/gpt-4o-mini',
            messages,
            max_tokens: 1200,
          }),
          signal: AbortSignal.timeout(45000),
        });
        const data = await r.json();
        return { success: true, data: data.choices?.[0]?.message?.content || '' };
      }

      // ── Filesystem ──
      case 'writePomodoroState':
        fs.mkdirSync(POMODORO_DIR, { recursive: true });
        fs.writeFileSync(path.join(POMODORO_DIR, 'state.json'), JSON.stringify(params), 'utf-8');
        return { success: true };

      // ── Settings ──
      case 'getModel':
      case 'getMorningTime': {
        let settings = {};
        try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch {}
        const key = method === 'getModel' ? 'model' : 'morningTime';
        return { success: true, data: settings[key] || null };
      }
      case 'setModel':
      case 'setMorningTime': {
        let settings = {};
        try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch {}
        settings[method === 'setModel' ? 'model' : 'morningTime'] = params;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return { success: true };
      }

      // ── Database ──
      case 'novaSessionSave': {
        const stmt = db.prepare(`INSERT OR REPLACE INTO nova_sessions
          (id, program, date, started_at, ended_at, raw_messages, summary, energy_level, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(params.id, params.program, params.date, params.started_at,
          params.ended_at || null, params.raw_messages || null,
          params.summary || null, params.energy_level || null, params.tags || null);
        return { success: true };
      }
      case 'novaSessionGetRange': {
        const rows = db.prepare(`SELECT * FROM nova_sessions WHERE date BETWEEN ? AND ? ORDER BY started_at ASC`)
          .all(params.from, params.to);
        return { success: true, data: rows };
      }
      case 'novaSessionGetRecent': {
        const limit = params ?? 20;
        const rows = db.prepare(`SELECT * FROM nova_sessions ORDER BY started_at DESC LIMIT ?`).all(limit);
        return { success: true, data: rows };
      }
      case 'novaInsightSave': {
        const stmt = db.prepare(`INSERT OR REPLACE INTO nova_insights
          (id, session_id, type, content, confidence, source, created_at, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(params.id, params.session_id || null, params.type, params.content,
          params.confidence || null, params.source, params.created_at,
          params.is_active !== undefined ? params.is_active : 1);
        return { success: true };
      }
      case 'novaInsightGetActive': {
        const rows = db.prepare(`SELECT * FROM nova_insights WHERE is_active = 1 ORDER BY created_at DESC`).all();
        return { success: true, data: rows };
      }
      case 'novaInsightDeactivate': {
        db.prepare(`UPDATE nova_insights SET is_active = 0 WHERE id = ?`).run(params);
        return { success: true };
      }
      case 'novaCheckinSave': {
        const stmt = db.prepare(`INSERT INTO nova_checkins
          (id, asked_at, query, response, context_snapshot) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(params.id, params.asked_at, params.query, params.response,
          params.context_snapshot || null);
        return { success: true };
      }
      case 'novaCheckinGetRecent': {
        const limit = params ?? 20;
        const rows = db.prepare(`SELECT * FROM nova_checkins ORDER BY asked_at DESC LIMIT ?`).all(limit);
        return { success: true, data: rows };
      }
      case 'novaBehavioralLog': {
        const stmt = db.prepare(`INSERT OR REPLACE INTO nova_behavioral
          (date, tasks_generated, tasks_accepted, tasks_rejected, tasks_completed,
           sync_score_start, sync_score_end, briefing_done, regroup_done)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(params.date, params.tasks_generated || null, params.tasks_accepted || null,
          params.tasks_rejected || null, params.tasks_completed || null,
          params.sync_score_start || null, params.sync_score_end || null,
          params.briefing_done || null, params.regroup_done || null);
        return { success: true };
      }
      case 'novaBehavioralGetRange': {
        const rows = db.prepare(`SELECT * FROM nova_behavioral WHERE date BETWEEN ? AND ? ORDER BY date ASC`)
          .all(params.from, params.to);
        return { success: true, data: rows };
      }
      case 'novaBehavioralGetToday': {
        const today = new Date().toISOString().slice(0, 10);
        const row = db.prepare(`SELECT * FROM nova_behavioral WHERE date = ?`).get(today);
        return { success: true, data: row || null };
      }
      case 'novaKnowledgeUpsert': {
        const stmt = db.prepare(`INSERT OR REPLACE INTO knowledge_pool
          (id, category, text, source, confidence, created_at, updated_at, insight_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(params.id, params.category, params.text, params.source,
          params.confidence || null, params.created_at, params.updated_at,
          params.insight_id || null);
        return { success: true };
      }
      case 'novaKnowledgeDelete': {
        db.prepare(`DELETE FROM knowledge_pool WHERE id = ?`).run(params);
        return { success: true };
      }
      case 'novaKnowledgeGetAll': {
        const rows = db.prepare(`SELECT * FROM knowledge_pool ORDER BY updated_at DESC`).all();
        return { success: true, data: rows };
      }

      case 'killProcess':
        // Called when the close button is clicked and Neutralino.app.exit(0)
        // fails. This kills the entire process group to ensure clean shutdown.
        process.exit(0);
        return { success: true };

      default:
        return { success: false, error: `Unknown method: ${method}` };
    }
  }
}

// ── Extension Lifecycle ──
module.exports = new MeridianExtension();
