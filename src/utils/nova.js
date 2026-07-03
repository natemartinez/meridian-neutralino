import { validateAgainstSchema, getPlainSchemaForProgram } from '../schemas/nova-schemas.js';

export function computePlanningConfidence(syncEvents) {
  const SATURATION = 40;
  if (!syncEvents?.length) return 0;
  const accepted  = syncEvents.filter(e => e.type === 'task_accepted').length;
  const rejected  = syncEvents.filter(e => e.type === 'task_rejected').length;
  const completed = syncEvents.filter(e => e.type === 'task_completed').length;
  const total     = accepted + rejected;
  const acceptance = total > 0 ? accepted / total : 0.5;
  const completion = accepted > 0 ? Math.min(completed / accepted, 1) : 0;
  // Only count meaningful decision events — not UI clicks like program_opened
  const meaningfulEvents = syncEvents.filter(e =>
    ['task_accepted', 'task_rejected', 'task_completed', 'briefing_done'].includes(e.type)
  );
  const richness   = Math.min(meaningfulEvents.length / SATURATION, 1);
  return Math.round((acceptance * 0.35 + completion * 0.45 + richness * 0.20) * 100);
}

/**
 * Validate NOVA's JSON response against the schema for the given program type.
 * Uses the schema-based validator from nova-schemas.js instead of heuristic
 * text pattern matching.
 *
 * With Strict Schema Mode enforced at the provider level, validation failures
 * should be extremely rare. This is a safety net only.
 *
 * @param {string} text - Raw JSON response text from the API
 * @param {string} programId - Program type identifier
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateNOVAResponse(text, programId) {
  if (!text || text.trim().length < 10) {
    return { valid: false, reason: 'Response too short or empty.' };
  }

  // Attempt to parse JSON
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, reason: 'Response is not valid JSON.' };
  }

  // Validate against the schema for this program type
  const schema = getPlainSchemaForProgram(programId);
  const result = validateAgainstSchema(parsed, schema);

  if (!result.valid) {
    return { valid: false, reason: `Schema validation failed: ${result.errors.join('; ')}` };
  }

  return { valid: true, reason: null };
}

/**
 * Compute plan accuracy from plan items and completed task IDs.
 */
export function computePlanAccuracy(planItems, completedTaskIds) {
  if (!planItems?.length) return 0;
  const matched = planItems.filter(item => completedTaskIds.includes(item.id));
  return matched.length / planItems.length;
}

/**
 * Update plan accuracy history with a new entry.
 * Keeps last 30 days, computes 7-day moving average.
 */
export function updatePlanAccuracyHistory(history, newEntry) {
  const updated = [...(history || []), newEntry].slice(-30);
  const last7 = updated.slice(-7);
  const movingAverage = last7.reduce((s, e) => s + e.accuracy, 0) / last7.length;
  return { history: updated, movingAverage };
}

/**
 * Infer which skills were improved based on completed task titles and descriptions.
 * Uses keyword matching against known skill names from INITIAL_SKILLS.
 * Returns an array of { skillName, confidence, taskTitle } objects.
 */
export function computeSkillImprovements(completedTasks, skillNames) {
  if (!completedTasks?.length || !skillNames?.length) return [];

  const improvements = [];
  const skillKeywords = {};

  // Build keyword map from skill names
  skillNames.forEach(name => {
    const keywords = name.toLowerCase()
      .replace(/[&/]/g, ' ')
      .split(/\s+/)
      .filter(k => k.length > 2);
    skillKeywords[name] = keywords;
  });

  completedTasks.forEach(task => {
    const title = (task.title || task.detail || '').toLowerCase();
    if (!title) return;

    for (const [skillName, keywords] of Object.entries(skillKeywords)) {
      // Check if any keyword from the skill name appears in the task title
      const matchCount = keywords.filter(kw => title.includes(kw)).length;
      if (matchCount > 0) {
        // Confidence based on how many keywords matched
        const confidence = Math.min(1, matchCount / keywords.length);
        improvements.push({
          skillName,
          confidence: Math.round(confidence * 100) / 100,
          taskTitle: task.title || task.detail || '',
        });
      }
    }
  });

  // Deduplicate by keeping highest confidence per skill
  const bestPerSkill = {};
  improvements.forEach(imp => {
    const existing = bestPerSkill[imp.skillName];
    if (!existing || imp.confidence > existing.confidence) {
      bestPerSkill[imp.skillName] = imp;
    }
  });

  return Object.values(bestPerSkill).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Identify skills that have been neglected (not applied recently).
 * Uses skill data to determine when a skill was last practiced.
 * Returns an array of { skillName, groupName, groupColor, daysSinceLastUse, hours, status } objects.
 */
export function getNeglectedSkills(skills) {
  if (!skills) return [];

  const neglected = [];
  const now = Date.now();
  const DAY_MS = 86_400_000;

  for (const [groupName, group] of Object.entries(skills)) {
    for (const [skillName, data] of Object.entries(group.skills || {})) {
      const lastApplied = data.lastApplied ? new Date(data.lastApplied).getTime() : null;
      const daysSince = lastApplied ? (now - lastApplied) / DAY_MS : Infinity;

      // A skill is neglected if:
      // 1. Has been applied before (has hours) but not in the last 14 days
      // 2. OR has never been applied (still at 0 hours) and was created more than 7 days ago
      const isNeglected = (data.hours > 0 && daysSince > 14) ||
                          (data.hours === 0 && daysSince > 7 && daysSince !== Infinity);

      if (isNeglected) {
        neglected.push({
          skillName,
          groupName,
          groupColor: group.color,
          daysSinceLastUse: Math.round(daysSince),
          hours: data.hours || 0,
          status: data.hours > 0 ? 'stale' : 'unused',
        });
      }
    }
  }

  return neglected.sort((a, b) => b.daysSinceLastUse - a.daysSinceLastUse);
}

export const NOVA_DEFAULT = {
  syncScore: 0,
  syncEvents: [],
  routine: null,
  programChats: { briefing: [], focus: null, regroup: [], preview: [], calibration: [] },
  suggestedTasks: [],
  dailyPlan: null,
  planGenLoading: false,
  planError: null,
  weeklyInsights: null,
  pendingInsights: [],
  planAccuracy: { history: [], movingAverage: null },
};

/**
 * Determine which NOVA program should auto-start on app launch.
 * Priority order (highest to lowest):
 *   1. Regroup — if streak was broken (had a streak, but missed yesterday)
 *   2. Briefing — morning hours (5-12) if not done today
 *   3. Preview — evening hours (17-22) if no history
 *   4. Paths — any time, if never completed
 *
 * Returns the program ID string, or null if no program should auto-start.
 *
 * @param {Object} opts
 * @param {string}  opts.apiKey          - API key (required; null means no NOVA)
 * @param {Array}   opts.syncEvents      - Array of sync event objects { type, ts }
 * @param {Object}  opts.programChats    - novaState.programChats
 * @param {number}  opts.hour            - Current hour (0-23)
 * @param {number}  opts.streakDays      - Current streak count
 * @param {string}  opts.lastActiveDate  - Date string of last activity
 * @returns {string|null}
 */
export function determineAutoStartProgram({ apiKey, syncEvents, programChats, hour, streakDays, lastActiveDate }) {
  if (!apiKey) return null;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const eventToday = (type) =>
    Array.isArray(syncEvents) && syncEvents.some(e => e.type === type && new Date(e.ts).toDateString() === today);

  const eventEver = (type) =>
    Array.isArray(syncEvents) && syncEvents.some(e => e.type === type);

  const hasHistory = (progId) => {
    const chat = programChats?.[progId];
    if (progId === 'focus') return chat !== null;
    return Array.isArray(chat) && chat.length > 0;
  };

  // Priority 1: Regroup — streak was broken
  // Streak was > 0 but last active was not today or yesterday
  if (streakDays > 0 && lastActiveDate && lastActiveDate !== today && lastActiveDate !== yesterday) {
    if (!hasHistory('regroup')) return 'regroup';
  }

  // Priority 2: Briefing — morning hours (5:00 - 11:59)
  if (hour >= 5 && hour < 12) {
    if (!eventToday('briefing_done') && !hasHistory('briefing')) return 'briefing';
  }

  // Priority 3: Preview — evening hours (17:00 - 21:59)
  if (hour >= 17 && hour < 22) {
    if (!hasHistory('preview')) return 'preview';
  }

  // Priority 4: Paths — any time, if never completed
  if (!eventEver('calibration_complete') && !hasHistory('calibration')) return 'calibration';

  return null;
}

/**
 * Find the most recently active NOVA program based on chat history.
 * Checks all program chats for the one with the most recent message timestamp.
 * Returns { progId, lastMessage, messageCount } or null if no program has history.
 *
 * @param {Object} programChats - novaState.programChats
 * @returns {{ progId: string, lastMessage: Object, messageCount: number } | null}
 */
export function getLastActiveProgram(programChats) {
  const progIds = ['briefing', 'focus', 'regroup', 'preview', 'calibration'];
  let lastActive = null;
  let lastTs = 0;

  for (const progId of progIds) {
    const chat = programChats[progId];
    if (!chat) continue;
    const messages = Array.isArray(chat) ? chat : [chat];
    if (messages.length === 0) continue;

    const lastMsg = messages[messages.length - 1];
    const ts = lastMsg.ts || lastMsg.timestamp || 0;
    if (ts > lastTs) {
      lastTs = ts;
      lastActive = { progId, lastMessage: lastMsg, messageCount: messages.length };
    }
  }

  return lastActive;
}

/**
 * Build a deterministic session summary from app state.
 * No AI calls — purely computed from existing data.
 *
 * @param {Object} opts
 * @param {Object}  opts.lastProgram       - Result of getLastActiveProgram()
 * @param {Object}  opts.novaState         - Full novaState object
 * @param {Array}   opts.selectedForToday  - Array of selected objective items
 * @param {Array}   opts.onwardItems       - Array of onward items (tasks)
 * @param {number}  opts.streakDays        - Current streak count
 * @returns {Object} SummaryObject
 */
export function buildSessionSummary({ lastProgram, novaState, selectedForToday, onwardItems, streakDays }) {
  if (!lastProgram) {
    return {
      programName: '',
      programIcon: '',
      programColor: '',
      lastActiveLabel: '',
      selectedCount: 0,
      completedCount: 0,
      totalCount: 0,
      streakDays: 0,
      lastMessageSnippet: '',
      messageCount: 0,
    };
  }

  // Compute relative time label
  const lastTs = lastProgram.lastMessage?.ts || lastProgram.lastMessage?.timestamp || 0;
  const now = Date.now();
  const diffMs = now - lastTs;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let lastActiveLabel;
  if (diffMins < 1) lastActiveLabel = 'Just now';
  else if (diffMins < 60) lastActiveLabel = `${diffMins} min ago`;
  else if (diffHours < 24) lastActiveLabel = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  else if (diffDays < 7) lastActiveLabel = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  else lastActiveLabel = new Date(lastTs).toLocaleDateString();

  // Count selected objectives
  const selectedCount = Array.isArray(selectedForToday) ? selectedForToday.length : 0;

  // Count completed vs total from onwardItems
  const items = Array.isArray(onwardItems) ? onwardItems : [];
  const totalCount = items.length;
  const completedCount = items.filter(item => item.done).length;

  // Get last message snippet (assistant message, truncated to 2 lines)
  const chat = novaState?.programChats?.[lastProgram.progId];
  const messages = Array.isArray(chat) ? chat : [];
  const assistantMessages = messages.filter(m => m.role === 'assistant' || m.role === 'nova');
  const lastMsg = assistantMessages[assistantMessages.length - 1];
  const lastMessageSnippet = lastMsg?.content
    ? lastMsg.content.split('\n').slice(0, 2).join('\n').substring(0, 120)
    : '';

  return {
    programName: lastProgram.progId.charAt(0).toUpperCase() + lastProgram.progId.slice(1),
    programIcon: '',
    programColor: '',
    lastActiveLabel,
    selectedCount,
    completedCount,
    totalCount,
    streakDays: streakDays || 0,
    lastMessageSnippet,
    messageCount: messages.length,
  };
}

/**
 * Select a time-appropriate greeting string.
 * Returns a deterministic greeting based on the current hour and streak.
 *
 * @param {number} hour       - Current hour (0-23)
 * @param {number} streakDays - Current streak count
 * @returns {string} Greeting text
 */
export function selectGreeting(hour, streakDays) {
  let greeting;

  if (hour >= 5 && hour < 12) {
    greeting = "Good morning. I'm NOVA, your productivity partner.";
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon. Ready to make progress?';
  } else if (hour >= 17 && hour < 22) {
    greeting = 'Good evening. Want to preview tomorrow?';
  } else {
    greeting = "Late night session. What's on your mind?";
  }

  if (streakDays > 0) {
    greeting += ` You're on a ${streakDays}-day streak — impressive momentum.`;
  }

  return greeting;
}
