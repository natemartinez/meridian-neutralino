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
 * Validate NOVA's response based on program type.
 * Returns { valid: boolean, reason: string|null }
 */
export function validateNOVAResponse(text, programId) {
  if (!text || text.trim().length < 10) {
    return { valid: false, reason: 'Response too short or empty.' };
  }

  switch (programId) {
    case 'briefing': {
      // Must contain a question or planning language
      const hasQuestion = text.includes('?');
      const hasPlanning = /plan|focus|priorit|today|scale|headspace/i.test(text);
      if (!hasQuestion && !hasPlanning) {
        return { valid: false, reason: 'Briefing should include a question or planning guidance.' };
      }
      return { valid: true, reason: null };
    }

    case 'focus': {
      // Must contain bullet points or numbered steps
      const hasBullets = /^[\s]*[-*•]\s/m.test(text);
      const hasNumbers = /^\s*\d+[.)]\s/m.test(text);
      const hasActionVerbs = /^(break|create|implement|write|build|refactor|test|review|analyze|setup|configure|research|draft)/im.test(text);
      if (!hasBullets && !hasNumbers) {
        return { valid: false, reason: 'Focus plan should use bullet points or numbered steps.' };
      }
      if (!hasActionVerbs) {
        return { valid: false, reason: 'Focus plan steps should start with action verbs.' };
      }
      return { valid: true, reason: null };
    }

    case 'regroup': {
      // Must acknowledge the situation, not be purely motivational
      const hasAcknowledgment = /happened|interrupt|lost|understand|feel|noticed|signal|break|reset/i.test(text);
      if (!hasAcknowledgment) {
        return { valid: false, reason: 'Regroup should acknowledge the situation first.' };
      }
      return { valid: true, reason: null };
    }

    case 'preview': {
      // Must reference planning for tomorrow/later
      const hasHorizon = /tomorrow|today|later|plan|next|upcoming|schedule/i.test(text);
      const hasQuestion = text.includes('?');
      if (!hasHorizon) {
        return { valid: false, reason: 'Preview should reference upcoming planning horizon.' };
      }
      return { valid: true, reason: null };
    }

    case 'calibration': {
      // Must contain a question and reference understanding/learning
      const hasQuestion = text.includes('?');
      const hasLearningIntent = /understand|learn|tell me|what about|how about|clarify|help me understand|you mentioned|you said|what are|what does|how do/i.test(text);
      if (!hasQuestion) {
        return { valid: false, reason: 'Calibration should ask questions to understand the user.' };
      }
      if (!hasLearningIntent) {
        return { valid: false, reason: 'Calibration should reference user context, not be generic.' };
      }
      return { valid: true, reason: null };
    }

    default:
      return { valid: true, reason: null };
  }
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
 *   4. Calibration — any time, if never completed
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

  // Priority 4: Calibration — any time, if never completed
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
