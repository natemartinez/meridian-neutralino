import { useState, useEffect, useRef, useCallback } from 'react';
import { chatWithNOVA, askAI } from '../utils/api.js';
import { uid, progress, QUADRANTS } from '../utils/helpers.js';
import { buildFullKnowledgeBlock, buildLightKnowledgeContext, buildStructuredKnowledgeBlock, decayKnowledge, markEntriesUsed } from '../utils/knowledge.js';
import { computePlanningConfidence, NOVA_DEFAULT, updatePlanAccuracyHistory } from '../utils/nova.js';
import { useNovaRetry } from './useNovaRetry.js';
import {
  CHAT_SCHEMA_OPENROUTER,
  INSIGHT_SCHEMA_OPENROUTER,
  PLAN_SCHEMA_OPENROUTER,
  KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER,
  WEEKLY_SCAN_SCHEMA_OPENROUTER,
  getSchemaForProgram,
} from '../schemas/nova-schemas.js';

export function useNOVA({ apiKey, model, projects, focus, waypointContext, loaded, pendingAutoStart, setPendingAutoStart }) {
  const [novaState, setNovaState] = useState(() => {
    try {
      const s = localStorage.getItem('meridian_nova_v1');
      if (!s) return NOVA_DEFAULT;
      return { ...NOVA_DEFAULT, ...JSON.parse(s), planGenLoading: false };
    } catch { return NOVA_DEFAULT; }
  });
  const [novaChatInput, setNovaChatInput] = useState('');
  const [novaLoading, setNovaLoading]     = useState(false);
  const [novaSessionKey, setNovaSessionKey] = useState(0);
  const [knowledgePool, setKnowledgePool] = useState(() => {
    try {
      const s = localStorage.getItem('meridian_knowledge_pool_v1');
      if (!s) return { entries: [], corrections: '', lastUpdated: null };
      return JSON.parse(s);
    } catch { return { entries: [], corrections: '', lastUpdated: null }; }
  });

  const novaRetry = useNovaRetry({
    maxRetries: 5,
    cooldownMs: 5000,
    cacheKey: 'meridian_nova_cache',
    onSuccess: (data, attempts) => {
      // NOVA request succeeded — no action needed
    },
    onError: (error) => {
      console.error('[NOVA] Request failed after all retries:', error.message);
    },
  });

  const knowledgePoolRef = useRef(knowledgePool);
  useEffect(() => { knowledgePoolRef.current = knowledgePool; }, [knowledgePool]);

  // Tracks knowledge entry IDs used by buildNOVASystemPrompt so we can apply
  // markEntriesUsed in a useEffect (not during render, which would cause
  // "Cannot update a component while rendering a different component" in React 19).
  const lastUsedEntryIdsRef = useRef(null);

  // Persist NOVA state
  useEffect(() => { localStorage.setItem('meridian_nova_v1', JSON.stringify(novaState)); }, [novaState]);
  useEffect(() => { localStorage.setItem('meridian_knowledge_pool_v1', JSON.stringify(knowledgePool)); }, [knowledgePool]);

  // Knowledge decay effect — periodically decay AI-inferred entries
  useEffect(() => {
    const runDecay = () => {
      setKnowledgePool(prev => decayKnowledge(prev));
    };
    runDecay(); // Run on mount
    const interval = setInterval(runDecay, 3600000); // Every hour
    return () => clearInterval(interval);
  }, []);

  // Apply markEntriesUsed after render (not during render) to avoid React 19
  // "Cannot update a component while rendering a different component" error.
  // buildNOVASystemPrompt stores used entry IDs in lastUsedEntryIdsRef instead
  // of calling setKnowledgePool directly.
  useEffect(() => {
    if (lastUsedEntryIdsRef.current) {
      setKnowledgePool(prev => markEntriesUsed(prev, lastUsedEntryIdsRef.current));
      lastUsedEntryIdsRef.current = null;
    }
  });

  // Seed initial Knowledge Pool entries on first load (when pool is empty)
  useEffect(() => {
    if (knowledgePool.entries.length > 0) return;
    const now = new Date().toISOString();
    const seedEntries = [
      { id: uid(), cat: 'prefs', text: 'Prefers 90-120 minute uninterrupted work blocks', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
      { id: uid(), cat: 'prefs', text: 'Uses Briefing program for daily planning each morning', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
      { id: uid(), cat: 'work', text: 'Plans the day during morning Briefing session', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
      { id: uid(), cat: 'goals', text: 'Wants to make steady progress on active projects daily', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
    ];
    setKnowledgePool(prev => ({
      ...prev,
      entries: seedEntries,
      lastUpdated: now,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally narrow — one-time seed on mount

  const addSyncEvent = useCallback((type, detail = '') => {
    const POINTS = { task_accepted: 5, task_completed: 10, briefing_done: 5, task_rejected: -2, calibration_complete: 15, knowledge_confirmed: 3, insight_accepted: 3, insight_dismissed: -1 };
    setNovaState(prev => ({
      ...prev,
      syncEvents: [...prev.syncEvents, { type, detail, ts: Date.now() }].slice(-200),
    }));
  }, []);

  const onNewSession = useCallback((programId) => {
    const isFocus = programId === 'focus';
    setNovaState(prev => ({
      ...prev,
      programChats: { ...prev.programChats, [programId]: isFocus ? null : [] },
      suggestedTasks: [],
    }));
    setNovaSessionKey(k => k + 1);
  }, []);

  const addKnowledgeEntry = useCallback((cat, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setKnowledgePool(prev => {
      if (prev.entries.filter(e => e.cat === cat).length >= 20) {
        console.warn('[KnowledgePool] Soft limit reached for category:', cat);
      }
      const now = new Date().toISOString();
      return {
        ...prev,
        entries: [...prev.entries, { id: uid(), cat, text: trimmed, source: 'manual', conf: 1, createdAt: now, updatedAt: now }],
        lastUpdated: now,
      };
    });
  }, []);

  const deleteKnowledgeEntry = useCallback((id) => {
    setKnowledgePool(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const editKnowledgeEntry = useCallback((id, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    setKnowledgePool(prev => ({
      ...prev,
      entries: prev.entries.map(e =>
        e.id === id ? { ...e, text: trimmed, source: 'manual', conf: 1, updatedAt: now } : e
      ),
      lastUpdated: now,
    }));
  }, []);

  const updateCorrections = useCallback((text) => {
    setKnowledgePool(prev => ({ ...prev, corrections: text, lastUpdated: new Date().toISOString() }));
  }, []);

  const addInferredEntries = useCallback((newEntries) => {
    if (!Array.isArray(newEntries) || newEntries.length === 0) return;
    const validCats = new Set(['work', 'goals', 'prefs', 'context']);
    const current = knowledgePoolRef.current;
    const existingTexts = new Set(current.entries.map(e => e.text.toLowerCase().trim()));
    const filtered = newEntries
      .filter(e => validCats.has(e.cat) && typeof e.text === 'string' && e.text.trim())
      .filter(e => !existingTexts.has(e.text.toLowerCase().trim()))
      .map(e => {
        const now = new Date().toISOString();
        return { id: uid(), cat: e.cat, text: e.text.trim(), source: 'ai', conf: Math.min(1, Math.max(0, Number(e.conf) || 0.5)), createdAt: now, updatedAt: now };
      });
    if (filtered.length === 0) return;
    setKnowledgePool(prev => ({
      ...prev,
      entries: [...prev.entries, ...filtered],
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  /**
   * Build the STATIC system prompt — contains only behavioral directives and
   * JSON schema instructions. NO volatile Blackboard data.
   * This maximizes OpenRouter's server-side prompt caching (exact byte-identity
   * required for cache hits).
   *
   * The volatile Blackboard snapshot is injected separately via
   * buildBlackboardUserMessage() as a user-role message.
   */
  const buildNOVASystemPrompt = useCallback((programId, isPreCraftedPrompt) => {
    const confidence = computePlanningConfidence(novaState.syncEvents);
    const routineNote = novaState.routine ? `Known pattern: ${novaState.routine.summary}` : '';

    // Static base — no volatile data, only behavioral directives
    const base = `You are NOVA, a productivity companion and psychological coach. Planning confidence with this user: ${confidence}%. ${confidence < 30 ? 'Ask more questions to learn their patterns.' : confidence > 70 ? 'You know this user well — make bold, specific suggestions.' : 'Balance questions with suggestions.'} ${routineNote} Psychological coaching scope: stress reduction, task breakdown, work tips only — not personal therapy.

Respond with a valid JSON object matching this schema:
{
  "content": "Your message text here",
  "options": ["Option 1", "Option 2", "Option 3"] | null,
  "ready": false
}
- "content": Your main message to the user.
- "options": 3 specific multiple-choice reply options the user can pick, or null if free-form input is expected (e.g., rating scales, open-ended reflection).
- "ready": Set to true when the user seems satisfied with this phase and the program should terminate.`;

    if (programId === 'briefing') {
      if (isPreCraftedPrompt) {
        return `${base} The user has sent a specific request to start the conversation. Respond directly to their request without asking "On a scale of 1–5, how's your headspace?" — they've already told you what they want. If they want a briefing, run through their goals, priorities, and help set 3 key objectives. If they want a goal rundown, list all goals with progress. If they want to log a task, help them schedule it. Be concise and actionable. Set "ready" to true when the user seems satisfied.`;
      }
      return `${base} This is a morning Briefing. Your FIRST message must be EXACTLY this mindset check-in: "On a scale of 1–5, how's your headspace going into today?" Use their score to calibrate: 1-2 = more coaching and task breakdown; 3 = balanced; 4-5 = jump straight to daily planning. Plan only for TODAY — not the week, not the month. Ask one question at a time. Set "ready" to true when the user says they feel ready.`;
    }

    if (programId === 'focus') return `${base} The user wants to lock in on a task. Respond with a JSON object where "content" contains a clean bulleted action plan (3–7 steps). No preamble, no sign-off, no conversation. Start each bullet with an action verb. If the task sounds overwhelming, silently break it into smaller steps. Set "options" to null — the user will type free-form.`;

    if (programId === 'regroup') return `${base} The user has lost momentum. Your FIRST message must be: "What happened — did something interrupt you, or did you just lose the thread?" Be grounding, not motivational. Ask one question at a time. If you detect stress signals, offer one brief tip (breathing, task reframing, or size reduction).`;

    if (programId === 'preview') {
      return `${base} The user is planning ahead. Your FIRST message must be a concise planning question. Suggest 2-4 specific tasks based on active goals and what's unfinished. Ask one question at a time. Set "ready" to true when the user seems satisfied.`;
    }

    if (programId === 'calibration') {
      let directive;
      if (confidence < 30) {
        directive = `Your confidence with this user is very low (${confidence}%). Your ONLY goal is to understand them. Ask fundamental questions one at a time: What are their main goals? What does their ideal work day look like? What tools do they prefer? What are their biggest challenges? Do NOT make suggestions. Do NOT try to plan. Just learn.`;
      } else if (confidence < 55) {
        directive = `Your confidence with this user is moderate (${confidence}%). Ask targeted follow-up questions to fill gaps in your understanding. Reference what you already know and ask for clarification or elaboration. One question at a time.`;
      } else {
        directive = `Your confidence with this user is good (${confidence}%). Summarize what you understand about them and ask them to confirm. If they confirm accuracy, set "ready" to true. If they correct you, learn from the correction and continue.`;
      }

      return `${base}\n\nThis is a Paths session. ${directive}\n\nRules:\n- Ask ONE question at a time\n- Never repeat a question already answered\n- Reference what you already know to show understanding\n- Set "ready" to true when the user confirms understanding is accurate`;
    }

    return base;
  }, [novaState.syncEvents, novaState.routine]);

  /**
   * Build the VOLATILE user message containing Blackboard data.
   * This changes every turn and is NOT cached — it's injected as a user-role
   * message separate from the static system prompt.
   */
  const buildBlackboardUserMessage = useCallback((programId, userInput, blackboard) => {
    const activeGoals = projects.filter(p => !p.completedAt);
    const quadrantCounts = { q1: 0, q2: 0, q3: 0, q4: 0 };
    activeGoals.forEach(p => {
      if (p.quadrant && quadrantCounts[p.quadrant] !== undefined) {
        quadrantCounts[p.quadrant]++;
      }
    });
    const quadrantSummary = Object.entries(quadrantCounts)
      .filter(([, count]) => count > 0)
      .map(([q, count]) => `${QUADRANTS[q].title} (${q.toUpperCase()}): ${count} goals`)
      .join(', ');

    const goalsSummary = activeGoals
      .map(p => `"${p.title}" (${progress(p)}% done${p.quadrant ? `, ${p.quadrant.toUpperCase()}` : ''})`).join(', ') || 'none';
    const quadrantBlock = quadrantSummary ? `\nEisenhower Matrix distribution: ${quadrantSummary}.` : '';
    const focusSummary = focus.filter(Boolean).join(', ') || 'none';

    // Knowledge pool context (volatile — changes as entries are added/decayed)
    const kbResult = buildStructuredKnowledgeBlock(knowledgePool);
    const knowledgeBlock = kbResult.text || buildFullKnowledgeBlock(knowledgePool).text || '';
    if (kbResult.usedEntryIds?.length > 0) {
      lastUsedEntryIdsRef.current = kbResult.usedEntryIds;
    }

    // Program-specific volatile context
    let programContext = '';
    if (programId === 'preview') {
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();
      const timeStr = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
      const isAfterMidnight = hour >= 0 && hour < 6;
      const horizon = isAfterMidnight ? 'later today' : 'tomorrow';

      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      const yesterdayCompletions = projects
        .flatMap(p => p.subtasks || [])
        .filter(s => s.completedAt && new Date(s.completedAt).toDateString() === yesterdayStr)
        .length;

      const today = new Date().toDateString();
      const todayTasks = (novaState.dailyPlan?.date === today ? novaState.dailyPlan.items : [])
        .map(i => `  - ${i.title} (${i.estimatedMinutes}min)`)
        .join('\n');

      programContext = `It's currently ${timeStr}. Planning for ${horizon}. Yesterday completed ${yesterdayCompletions} subtasks.${todayTasks ? `\n\nToday's existing plan:\n${todayTasks}` : ''}`;
    }

    return `[Blackboard State]
Active goals: ${goalsSummary}.${quadrantBlock}
Today's focus: ${focusSummary}.
${knowledgeBlock ? `Knowledge context:\n${knowledgeBlock}` : ''}
${programContext ? `\n${programContext}` : ''}

[User]: ${userInput}`;
  }, [projects, focus, knowledgePool, novaState.dailyPlan]);

  // Auto-start NOVA programs when waypoint opens OR pendingAutoStart is set
  useEffect(() => {
    if (!loaded) return;
    if (!apiKey) return;
    if (novaLoading) return;

    // Determine which program to auto-start
    let progId = null;

    // Priority 1: pendingAutoStart (from App.jsx mount effect)
    if (pendingAutoStart) {
      progId = pendingAutoStart;
    }
    // Priority 2: waypointContext (from ProgramsList click)
    else if (waypointContext?.type === 'program') {
      progId = waypointContext.id;
    }

    if (!progId) return;
    if (progId === 'focus') return;

    const history = novaState.programChats[progId] || [];
    if (history.length > 0) {
      // If pendingAutoStart but program already has history, clear the flag
      if (pendingAutoStart) setPendingAutoStart?.(null);
      return;
    }

    const systemPrompt = buildNOVASystemPrompt(progId);
    const schemaType = getSchemaForProgram(progId);
    setNovaLoading(true);

    // Clear pendingAutoStart once we begin
    if (pendingAutoStart) setPendingAutoStart?.(null);

    novaRetry.executeWithRetry(() =>
      chatWithNOVA([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: 'Hello' },
      ], apiKey, { model, schemaType })
    ).then(reply => {
      const data = typeof reply === 'object' && reply.data ? reply.data : reply;
      // Parse JSON response with try/catch fallback to text mode
      try {
        const parsed = JSON.parse(data);
        const cleanReply = parsed.content || data;
        const isReady = parsed.ready === true;
        setNovaState(prev => ({
          ...prev,
          programChats: { ...prev.programChats, [progId]: [{ role: 'assistant', content: cleanReply }] },
        }));
      } catch {
        // Fallback: treat as plain text (backward compatibility)
        setNovaState(prev => ({
          ...prev,
          programChats: { ...prev.programChats, [progId]: [{ role: 'assistant', content: data }] },
        }));
      }
    }).finally(() => setNovaLoading(false));
  }, [waypointContext?.type, waypointContext?.id, pendingAutoStart, apiKey, buildNOVASystemPrompt, loaded, novaSessionKey, novaRetry, novaLoading, novaState.programChats, setPendingAutoStart]);

  const extractNOVAInsights = useCallback(async (programId, messages) => {
    if (!apiKey || messages.length < 3) return;
    const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const raw = await chatWithNOVA([
      { role: 'system', content: 'You are a JSON API that extracts insights from productivity coaching conversations.' },
      { role: 'user', content: `Analyze this productivity coaching conversation and extract:\n1. routine_update: one sentence describing the user's work patterns revealed in this chat\n2. suggested_tasks: array of 2–4 specific actionable task strings\n3. knowledge_entries: array of 0–4 objects, each { "cat": "work"|"goals"|"prefs"|"context", "text": string (max 120 chars, factual present-tense), "conf": number 0–1 }\n   - Only include entries you are confident about\n   - "work" = habits/style; "goals" = objectives/motivations; "prefs" = tool/process preferences; "context" = personal/situational facts\n   - Leave empty if nothing clear was revealed\n\nConversation:\n${transcript}\n\nRespond with a JSON object matching: {"routine_update":"...","suggested_tasks":["..."],"knowledge_entries":[{"cat":"work","text":"...","conf":0.85}]}` },
    ], apiKey, { model, schemaType: INSIGHT_SCHEMA_OPENROUTER });
    try {
      const parsed  = JSON.parse(raw);
      // Build pending insights instead of directly mutating state
      const pending = [];
      if (parsed.routine_update) {
        pending.push({
          id: uid(),
          type: 'routine',
          content: parsed.routine_update,
          source: programId,
          createdAt: Date.now(),
        });
      }
      if (Array.isArray(parsed.suggested_tasks)) {
        parsed.suggested_tasks.forEach(t => {
          pending.push({
            id: uid(),
            type: 'task',
            content: t,
            source: programId,
            createdAt: Date.now(),
          });
        });
      }
      if (Array.isArray(parsed.knowledge_entries)) {
        parsed.knowledge_entries.forEach(e => {
          pending.push({
            id: uid(),
            type: 'knowledge',
            content: e,
            source: programId,
            createdAt: Date.now(),
          });
        });
      }
      if (pending.length > 0) {
        setNovaState(prev => ({
          ...prev,
          pendingInsights: [...(prev.pendingInsights || []), ...pending],
        }));
      }
    } catch { /* silently ignore parse errors */ }
  }, [apiKey]);

  const confirmInsight = useCallback((insightId) => {
    setNovaState(prev => {
      const insight = (prev.pendingInsights || []).find(i => i.id === insightId);
      if (!insight) return prev;
      const remaining = (prev.pendingInsights || []).filter(i => i.id !== insightId);
      // Fire sync event outside the updater to avoid batching issues
      const insightType = insight.type || 'unknown';
      const detail = `insight_${insightType}: ${String(insight.content || '').slice(0, 80)}`;
      // Use setTimeout(0) to ensure we're outside the setState updater
      setTimeout(() => addSyncEvent('insight_accepted', detail), 0);
      if (insight.type === 'routine') {
        return {
          ...prev,
          routine: { summary: insight.content, lastUpdated: new Date().toISOString() },
          pendingInsights: remaining,
        };
      }
      if (insight.type === 'knowledge') {
        // Add to knowledge pool via addInferredEntries
        addInferredEntries([insight.content]);
        return { ...prev, pendingInsights: remaining };
      }
      if (insight.type === 'task') {
        return {
          ...prev,
          suggestedTasks: [...(prev.suggestedTasks || []), { id: uid(), text: insight.content, source: insight.source, accepted: null }],
          pendingInsights: remaining,
        };
      }
      return { ...prev, pendingInsights: remaining };
    });
  }, [addInferredEntries, addSyncEvent]);

  const dismissInsight = useCallback((insightId) => {
    setNovaState(prev => {
      const insight = (prev.pendingInsights || []).find(i => i.id === insightId);
      const detail = insight
        ? `insight_${insight.type || 'unknown'}: ${String(insight.content || '').slice(0, 80)}`
        : `insight_${insightId}`;
      setTimeout(() => addSyncEvent('insight_dismissed', detail), 0);
      return {
        ...prev,
        pendingInsights: (prev.pendingInsights || []).filter(i => i.id !== insightId),
      };
    });
  }, [addSyncEvent]);

  /**
   * Record plan accuracy by comparing completed tasks against the daily plan.
   * Called when tasks are checked off to build a feedback loop.
   */
  const recordPlanAccuracy = useCallback(() => {
    const plan = novaState.dailyPlan;
    if (!plan?.items?.length) return;
    const today = new Date().toISOString().slice(0, 10);
    if (plan.date !== today) return;
    // Count how many plan items have matching completed subtasks
    const completedPlanItems = plan.items.filter(item => {
      return projects.some(p =>
        (p.subtasks || []).some(s =>
          s.done && s.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 20))
        )
      );
    });
    const accuracy = completedPlanItems.length / plan.items.length;
    setNovaState(prev => ({
      ...prev,
      planAccuracy: updatePlanAccuracyHistory(prev.planAccuracy?.history || [], {
        date: today,
        planned: plan.items.length,
        completed: completedPlanItems.length,
        accuracy,
      }),
    }));
  }, [novaState.dailyPlan, projects]);

  const generateNovaPlanRef = useRef(null);

  /**
   * Real-time knowledge inference — lightweight extraction during conversation.
   * Fire-and-forget: never blocks the main message flow.
   * Results go to pendingInsights for user confirmation.
   */
  const inferKnowledgeFromMessage = useCallback(async (userText, programId) => {
    if (!apiKey || userText.trim().length < 20) return;
    try {
      const system = 'You are a knowledge extraction API. Extract knowledge entries from user messages.';
      const result = await chatWithNOVA([
        { role: 'system', content: system },
        { role: 'user', content: `Extract any new knowledge from this message: "${userText}"` },
      ], apiKey, { model, schemaType: KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER });
      const parsed = JSON.parse(result);
      const entries = parsed.entries || [];
      if (Array.isArray(entries) && entries.length > 0) {
        const pending = entries.map(e => ({
          id: uid(),
          type: 'knowledge',
          content: { cat: e.cat, text: e.text, conf: Math.min(0.6, e.conf || 0.3) },
          source: `${programId}_realtime`,
          createdAt: Date.now(),
        }));
        setNovaState(prev => ({
          ...prev,
          pendingInsights: [...(prev.pendingInsights || []), ...pending],
        }));
      }
    } catch {
      // Silently fail — real-time inference is best-effort
    }
  }, [apiKey]);

  const sendNOVAMessage = useCallback(async (programId, overrideText) => {
    const text = (overrideText || novaChatInput).trim();
    if (!text || novaLoading || !apiKey) return;
    if (!overrideText) setNovaChatInput('');

    // When overrideText is provided (from startup action buttons), it's a pre-crafted prompt.
    // Pass this flag so buildNOVASystemPrompt can skip the headspace check for briefing.
    const isPreCraftedPrompt = !!overrideText;
    const systemPrompt = buildNOVASystemPrompt(programId, isPreCraftedPrompt);
    const schemaType = getSchemaForProgram(programId);
    const currentHistory = novaState.programChats[programId] || [];

    if (programId === 'focus') {
      const userMsg = { role: 'user', content: text };
      setNovaState(prev => ({
        ...prev,
        programChats: { ...prev.programChats, focus: '__loading__' },
      }));
      setNovaLoading(true);
      try {
        const reply = await novaRetry.executeWithRetry(
          () => chatWithNOVA([{ role: 'system', content: systemPrompt }, userMsg], apiKey, { model, schemaType })
        ).then(r => r.data);
        // Parse JSON response
        try {
          const parsed = JSON.parse(reply);
          const content = parsed.content || reply;
          setNovaState(prev => ({
            ...prev,
            programChats: { ...prev.programChats, focus: content },
          }));
        } catch {
          // Fallback: plain text
          setNovaState(prev => ({
            ...prev,
            programChats: { ...prev.programChats, focus: reply },
          }));
        }
      } finally { setNovaLoading(false); }
      return;
    }

    const updatedHistory = [...currentHistory, { role: 'user', content: text }];
    setNovaState(prev => ({
      ...prev,
      programChats: { ...prev.programChats, [programId]: updatedHistory },
    }));
    setNovaLoading(true);

    // Fire-and-forget real-time knowledge inference (non-blocking)
    if (programId !== 'focus') {
      inferKnowledgeFromMessage(text, programId);
    }
    try {
      const apiHistory = updatedHistory[0]?.role === 'assistant'
        ? [{ role: 'user', content: 'Hello' }, ...updatedHistory]
        : updatedHistory;
      const messages = [{ role: 'system', content: systemPrompt }, ...apiHistory];
      const reply    = await novaRetry.executeWithRetry(
        () => chatWithNOVA(messages, apiKey, { model, schemaType })
      ).then(r => r.data);
      // Parse JSON response — extract content and ready flag
      let cleanReply = reply;
      let isReady = false;
      try {
        const parsed = JSON.parse(reply);
        cleanReply = parsed.content || reply;
        isReady = parsed.ready === true;
      } catch {
        // Fallback: treat as plain text (backward compatibility)
        cleanReply = reply;
      }
      const finalHistory = [...updatedHistory, { role: 'assistant', content: cleanReply }];
      setNovaState(prev => ({
        ...prev,
        programChats: { ...prev.programChats, [programId]: finalHistory },
      }));
      if (isReady) {
        if (programId === 'calibration') {
          addSyncEvent('calibration_complete', 'User confirmed NOVA understanding');
        } else {
          addSyncEvent('briefing_done', programId);
          extractNOVAInsights(programId, finalHistory);
          generateNovaPlanRef.current?.();
        }
      }
    } finally { setNovaLoading(false); }
  }, [novaChatInput, novaLoading, apiKey, novaState, buildNOVASystemPrompt, addSyncEvent, extractNOVAInsights, novaRetry, inferKnowledgeFromMessage, novaSessionKey]);

  // Internal helpers for generateNovaPlan (same logic as App.jsx's calcStreak/getWeeklyData)
  const allCompletionDates = () => {
    const dates = [];
    projects.forEach(p => {
      p.subtasks.forEach(s    => { if (s.completedAt) dates.push(new Date(s.completedAt)); });
      p.checkpoints.forEach(c => { if (c.completedAt) dates.push(new Date(c.completedAt)); });
    });
    return dates;
  };

  const calcStreak = () => {
    const dateStrings = [...new Set(allCompletionDates().map(d => {
      const x = new Date(d); x.setHours(0,0,0,0); return x.getTime();
    }))].sort((a,b) => b-a);
    if (!dateStrings.length) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const mostRecent = new Date(dateStrings[0]);
    if (mostRecent < yesterday) return 0;
    let streak = 1;
    for (let i = 1; i < dateStrings.length; i++) {
      if ((dateStrings[i-1] - dateStrings[i]) === 86400000) streak++;
      else break;
    }
    return streak;
  };

  const getWeeklyData = () => {
    const completions = allCompletionDates();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i));
      const end = new Date(d); end.setHours(23,59,59,999);
      return {
        day:     ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
        count:   completions.filter(c => c >= d && c <= end).length,
        isToday: i === 6,
      };
    });
  };

  const generateNovaPlan = useCallback(async (userPriorities) => {
    if (!apiKey || novaState.planGenLoading) return;

    // Dynamic confidence threshold based on plan accuracy history
    const confidence = computePlanningConfidence(novaState.syncEvents);
    const baseThreshold = 80;
    const accuracyBonus = novaState.planAccuracy?.movingAverage
      ? Math.round((novaState.planAccuracy.movingAverage - 0.5) * 40) // -20 to +20
      : 0;
    const effectiveThreshold = Math.max(50, Math.min(95, baseThreshold - accuracyBonus));
    if (confidence < effectiveThreshold) {
      setNovaState(prev => ({
        ...prev,
        planGenLoading: false,
        dailyPlan: null,
        planError: `NOVA confidence is ${confidence}% — needs to be at least ${effectiveThreshold}% to generate a reliable plan. ${accuracyBonus < 0 ? 'Previous plans have had low accuracy, so NOVA is being more cautious.' : 'Complete more Briefings and accept/reject tasks to improve confidence.'}`,
      }));
      return;
    }

    const activeGoals = projects.filter(p => !p.completedAt);
    const goalContext = activeGoals.length
      ? activeGoals.map(p => {
          const subs = p.subtasks.filter(s => !s.done).map(s => `  - [subtask] ${s.title}`).join('\n');
          const cps  = p.checkpoints.filter(c => !c.done).map(c => `  - [milestone] ${c.title}`).join('\n');
          const pct  = progress(p);
          const dl   = p.deadline ? ` | deadline: ${p.deadline}` : '';
          const pri  = p.priority === 'high' ? ' | HIGH PRIORITY' : '';
          return `Goal: "${p.title}" (${pct}% complete${dl}${pri})\n${subs}\n${cps}`;
        }).join('\n\n')
      : 'No active goals. Generate general productivity tasks.';

    const streak    = calcStreak();
    const weekly    = getWeeklyData();
    const avgPerDay = weekly.length
      ? (weekly.reduce((s, d) => s + d.count, 0) / weekly.length).toFixed(1)
      : '0';
    const routineNote = novaState.routine?.summary || 'No work pattern established yet.';
    const lightCtx    = buildLightKnowledgeContext(knowledgePool);

    // Determine plan start time based on whether we're planning for today or tomorrow
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isPlanningForTomorrow = currentHour >= 18; // After 6pm, plan for tomorrow
    const planDate = new Date();
    if (isPlanningForTomorrow) planDate.setDate(planDate.getDate() + 1);
    const planDateStr = planDate.toISOString().slice(0, 10);

    // Start time: if planning for today, start at current time (rounded to next 15min);
    // if planning for tomorrow, start at 11:00 AM
    let startHour, startMinute;
    if (isPlanningForTomorrow) {
      startHour = 11;
      startMinute = 0;
    } else {
      // Round current time up to next 15-minute increment
      startHour = currentHour;
      startMinute = Math.ceil(currentMinute / 15) * 15;
      if (startMinute >= 60) {
        startHour += 1;
        startMinute = 0;
      }
    }
    const startTimeMinutes = startHour * 60 + startMinute;

    const system = (`You are NOVA, an AI planning engine. Generate a daily plan as a JSON object with a "tasks" array. Each task: { "title": string (max 60 chars), "goalId": string|null, "goalTitle": string|null, "estimatedMinutes": number (15-120), "complexity": "low"|"medium"|"high", "rationale": string (max 80 chars) }. Generate exactly 5 to 7 tasks. Prioritize using the Eisenhower Matrix: Q1 (Do First) > Q2 (Schedule) > Q3 (Delegate) > Q4 (Eliminate). Focus on urgent+important and important+not-urgent goals first.${lightCtx ? ' ' + lightCtx : ''}`).trim();

    const priorityContext = userPriorities && userPriorities.trim()
      ? `\n\nUSER'S PRIORITIES:\n${userPriorities.trim()}`
      : '';

    const userMsg = `Plan my day.

ACTIVE GOALS AND INCOMPLETE WORK:
${goalContext}

PERFORMANCE SIGNALS:
- Current streak: ${streak} day(s)
- Average tasks completed per day (last 7 days): ${avgPerDay}
- Nova planning confidence: ${confidence}%
- My work pattern: ${routineNote}

Today is ${planDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
Plan start time: ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}
${isPlanningForTomorrow ? 'This plan is for TOMORROW.' : 'This plan is for TODAY.'}
${priorityContext}

Generate a JSON object with a "tasks" array of 5-7 tasks for ${isPlanningForTomorrow ? 'tomorrow' : 'today'}. Use the exact goalId strings from the goals above, or null for general tasks. Each task should be scheduled sequentially starting from the plan start time, with the estimatedMinutes determining the duration of each block.`;

    setNovaState(prev => ({ ...prev, planGenLoading: true, planError: null }));
    try {
      const result  = await novaRetry.executeWithRetry(
        () => askAI(system, userMsg, apiKey, { model, schemaType: PLAN_SCHEMA_OPENROUTER })
      );
      const raw     = result.data;
      const parsed  = JSON.parse(raw);
      const tasks = parsed.tasks || (Array.isArray(parsed) ? parsed : []);
      if (Array.isArray(tasks) && tasks.length >= 5) {
        // Build sequential time blocks starting from startTimeMinutes
        let currentTimeOffset = 0;
        setNovaState(prev => ({
          ...prev,
          dailyPlan: {
            date: planDateStr,
            generatedAt: new Date().toISOString(),
            startTimeMinutes,
            isTomorrow: isPlanningForTomorrow,
            items: tasks.map(item => {
              const estimatedMinutes = Math.min(120, Math.max(15, Number(item.estimatedMinutes) || 30));
              const itemStart = startTimeMinutes + currentTimeOffset;
              currentTimeOffset += estimatedMinutes;
              return {
                id: uid(),
                title: String(item.title || '').slice(0, 60),
                goalId: item.goalId || null,
                goalTitle: item.goalTitle || null,
                estimatedMinutes,
                startMinutes: itemStart,
                complexity: ['low','medium','high'].includes(item.complexity) ? item.complexity : 'medium',
                rationale: String(item.rationale || '').slice(0, 80),
              };
            }),
          },
          planGenLoading: false,
        }));
      } else {
        setNovaState(prev => ({ ...prev, planGenLoading: false }));
      }
    } catch {
      setNovaState(prev => ({ ...prev, planGenLoading: false }));
    }
  }, [apiKey, projects, novaState.planGenLoading, novaState.syncEvents, novaState.routine, novaState.planAccuracy, knowledgePool, novaRetry]);

  generateNovaPlanRef.current = generateNovaPlan;

  // Startup: generate daily plan if stale (only if confidence >= 80%)
  useEffect(() => {
    if (!apiKey) return;
    const today = new Date().toISOString().slice(0, 10);
    const plan  = novaState.dailyPlan;
    const confidence = computePlanningConfidence(novaState.syncEvents);
    if ((!plan || plan.date !== today) && !novaState.planGenLoading && confidence >= 80) {
      generateNovaPlan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // intentionally narrow — one-time startup trigger

  // ── Weekly Goals Scan ──
  const scanWeeklyGoals = useCallback(async () => {
    if (!apiKey) return;
    setNovaState(prev => ({ ...prev, weeklyInsights: { loading: true, text: null, error: null } }));

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const today = now.getDate();
    const currentWeek = Math.floor((firstDow + today - 1) / 7);
    const weekStart = new Date(year, month, 1 + currentWeek * 7 - firstDow);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);

    const activeProjects = projects.filter(p => !p.completedAt);
    const weekProjects = activeProjects.filter(p => {
      if (!p.deadline) return false;
      const d = new Date(p.deadline);
      return d >= weekStart && d <= weekEnd;
    });
    const overdueProjects = activeProjects.filter(p => {
      if (!p.deadline) return false;
      const d = new Date(p.deadline);
      const done = (p.subtasks.filter(s => s.done).length + p.checkpoints.filter(c => c.done).length);
      const total = p.subtasks.length + p.checkpoints.length;
      return d < weekStart && done < total;
    });

    const goalContext = weekProjects.map(p => {
      const pct = progress(p);
      const subs = p.subtasks.filter(s => !s.done).map(s => s.title).join(', ');
      return `"${p.title}" (${pct}% done)${subs ? ` — remaining: ${subs}` : ''}`;
    }).join('\n');

    const overdueContext = overdueProjects.map(p => {
      const pct = progress(p);
      return `"${p.title}" (${pct}% done) — OVERDUE`;
    }).join('\n');

    const system = 'You are NOVA, a weekly planning analyst. Assess the user\'s weekly goal alignment. Be direct and specific.';
    const userMsg = `Current week: ${weekStart.toLocaleDateString('en-US', { month:'short', day:'numeric' })} — ${weekEnd.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}\n\nGoals with deadlines this week:\n${goalContext || 'None'}\n\nOverdue goals:\n${overdueContext || 'None'}\n\nAssess my weekly alignment.`;

    try {
      const result = await novaRetry.executeWithRetry(
        () => askAI(system, userMsg, apiKey, { model, schemaType: WEEKLY_SCAN_SCHEMA_OPENROUTER })
      );
      const raw   = result.data;
      let reply = raw;
      try {
        const parsed = JSON.parse(raw);
        reply = parsed.assessment || raw;
      } catch { /* use raw text fallback */ }
      setNovaState(prev => ({
        ...prev,
        weeklyInsights: { loading: false, text: reply.trim(), error: null, scannedAt: Date.now() },
      }));
    } catch {
      setNovaState(prev => ({
        ...prev,
        weeklyInsights: { loading: false, text: null, error: 'Failed to scan weekly goals. Try again.' },
      }));
    }
  }, [apiKey, projects, novaRetry]);

  return {
    novaState, setNovaState,
    novaChatInput, setNovaChatInput,
    novaLoading,
    novaSessionKey,
    knowledgePool, setKnowledgePool,
    knowledgePoolRef,
    addSyncEvent,
    onNewSession,
    addKnowledgeEntry,
    deleteKnowledgeEntry,
    editKnowledgeEntry,
    updateCorrections,
    addInferredEntries,
    sendNOVAMessage,
    generateNovaPlan,
    generateNovaPlanRef,
    buildNOVASystemPrompt,
    scanWeeklyGoals,
    novaRetry,
    confirmInsight,
    dismissInsight,
    recordPlanAccuracy,
  };
}
