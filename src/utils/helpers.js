import { T } from './theme.js';

export const uid = () => {
  try {
    return crypto.randomUUID().slice(0, 7);
  } catch {
    // NOSONAR: fallback only when crypto.randomUUID() is unavailable; IDs are
    // not security tokens, so a non-cryptographic RNG is acceptable here.
    return Math.random().toString(36).slice(2, 9);
  }
};

export const projectPos = (i) => ({ x: 240 + i * 440, y: 270 });

/**
 * Quadrant constants for Eisenhower Matrix.
 * Maps quadrant IDs to human-readable labels and colors.
 */
export const QUADRANTS = {
  q1: { id: 'q1', title: 'DO FIRST',   subtitle: 'Urgent + Important',          color: '#f77171' },
  q2: { id: 'q2', title: 'SCHEDULE',   subtitle: 'Not Urgent + Important',      color: '#53aaff' },
  q3: { id: 'q3', title: 'DELEGATE',   subtitle: 'Urgent + Not Important',      color: '#f0b429' },
  q4: { id: 'q4', title: 'ELIMINATE',  subtitle: 'Not Urgent + Not Important',  color: '#56687f' },
};

/**
 * Calculate which Eisenhower quadrant a position falls into.
 * The canvas is divided by two perpendicular axes at (axisX, axisY).
 *
 * Quadrant layout:
 *   Q2 (Schedule)     |  Q1 (Do First)
 *   Not Urgent+Imp    |  Urgent+Imp
 *   ------------------+------------------
 *   Q4 (Eliminate)    |  Q3 (Delegate)
 *   Not Urgent+NotImp |  Urgent+NotImp
 *
 * @param {{ x: number, y: number }} pos - Goal position in canvas coordinates
 * @param {number} axisX - X-coordinate of the vertical (urgency) divider
 * @param {number} axisY - Y-coordinate of the horizontal (importance) divider
 * @returns {'q1'|'q2'|'q3'|'q4'}
 */
export function calculateQuadrant(pos, axisX, axisY) {
  if (pos.x >= axisX && pos.y < axisY) return 'q1';
  if (pos.x < axisX  && pos.y < axisY) return 'q2';
  if (pos.x >= axisX && pos.y >= axisY) return 'q3';
  return 'q4';
}

/**
 * Resolve a goal's taxonomy category with a defensive fallback read.
 * Reads the new `category` field first, falling back to the legacy `scale`
 * during the transition window.
 *
 * @param {{ category?: string, scale?: string, deadline?: string|null }} goal
 * @returns {'short'|'long'|'open'}
 */
export function getCategory(goal) {
  if (goal?.category && ['short', 'long', 'open'].includes(goal.category)) {
    return goal.category;
  }
  switch (goal?.scale) {
    case 'short': return 'short';
    case 'medium':
    case 'long':  return 'long';
    default:      return goal?.deadline ? 'long' : 'open';
  }
}

/**
 * Infer the initial Eisenhower quadrant for a newly created goal
 * based on its deadline proximity, priority, and category/scale.
 *
 * Heuristic:
 *   - Urgent (deadline ≤ 7 days) + Important (high priority or long category) → Q1
 *   - Not urgent + Important → Q2
 *   - Urgent + Not important → Q3
 *   - Neither → Q4
 *   - 'open' goals are NEVER urgent by deadline (deadline is null by invariant)
 *     and default to Q2 (Schedule).
 *
 * @param {{ deadline?: string, priority?: string, category?: string, scale?: string }} goalData
 * @returns {'q1'|'q2'|'q3'|'q4'}
 */
export function inferInitialQuadrant(goalData) {
  const category = getCategory(goalData);
  let isUrgent = false;
  if (goalData.deadline && category !== 'open') {
    const deadlineDate = new Date(goalData.deadline);
    if (!isNaN(deadlineDate.getTime())) {
      isUrgent = (deadlineDate - new Date()) / 86400000 <= 7;
    }
  }
  // Open goals are ongoing life areas — never urgent, but important by
  // default so they land in Q2 (Schedule) when created (plan §7.1).
  const isImportant = category === 'open' || goalData.priority === 'high' || category === 'long';

  if (isUrgent && isImportant) return 'q1';
  if (!isUrgent && isImportant) return 'q2';
  if (isUrgent && !isImportant) return 'q3';
  return 'q4';
}

/**
 * Get the center position for a given quadrant, relative to the matrix axes.
 * Useful for placing newly created goals in the center of their inferred quadrant.
 *
 * @param {'q1'|'q2'|'q3'|'q4'} quadrant
 * @param {number} axisX - X-coordinate of the vertical divider
 * @param {number} axisY - Y-coordinate of the horizontal divider
 * @returns {{ x: number, y: number }}
 */
export function quadrantCenter(quadrant, axisX, axisY) {
  const cx = axisX / 2;
  const cy = axisY / 2;
  switch (quadrant) {
    case 'q1': return { x: axisX + cx, y: cy };
    case 'q2': return { x: cx,         y: cy };
    case 'q3': return { x: axisX + cx, y: axisY + cy };
    case 'q4': return { x: cx,         y: axisY + cy };
    default:   return { x: axisX,      y: axisY };
  }
}

export const progress = (p) => {
  // Count subtasks: top-level + within checkpoints
  const topLevelSubs = p.subtasks || [];
  const cpSubs = (p.checkpoints || []).reduce((sum, cp) => sum + (cp.subtasks || []).length, 0);
  const total = topLevelSubs.length + cpSubs;
  if (!total) return 0;
  const done = topLevelSubs.filter(s => s.done).length
    + (p.checkpoints || []).reduce((sum, cp) => sum + (cp.subtasks || []).filter(s => s.done).length, 0);
  return Math.round((done / total) * 100);
};

/**
 * Parse defer clues from task titles.
 * Patterns: "Micro 1 - Sat.", "Micro 2 – Mon", "Micro 3 — Tue"
 * Returns { microId, targetDay } or null.
 */
export function parseDeferClue(title) {
  if (typeof title !== 'string' || title.length > 200) return null;
  const match = title.match(/\b(Micro\s+\d+)\s*[-–—]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
  if (!match) return null;
  return { microId: match[1], targetDay: match[2] };
}

/**
 * Estimate pomodoros for a task based on title length and sub-step indicators.
 * Returns suggested number of 25-min pomodoros (minimum 1).
 */
export function estimatePomodoros(title, description = '') {
  const text = `${title} ${description}`;
  const wordCount = text.split(/\s+/).length;
  // Count sub-step indicators like "1.", "2.", "-", "•"
  const stepIndicators = (text.match(/(\d+\.|[-•])\s/g) || []).length;
  // Base estimate: 1 pomodoro per ~50 words, plus sub-steps
  const base = Math.max(1, Math.ceil(wordCount / 50));
  const steps = Math.max(0, stepIndicators);
  return Math.min(base + steps, 8); // Cap at 8 pomodoros
}

/**
 * Build daily summary from sessions, brain dump entries, and task data.
 * Categorizes time into Core Building, Maintenance, and Distractions Intercepted.
 */
export function buildDailySummary(sessions, brainDumpEntries, onwardItems, projects) {
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => {
    const sDate = new Date(s.startTime || s.ts || Date.now()).toDateString();
    return sDate === today;
  });
  const todayBrainDumps = brainDumpEntries.filter(e => {
    const eDate = new Date(e.timestamp).toDateString();
    return eDate === today;
  });

  let coreMinutes = 0;
  let maintenanceMinutes = 0;

  for (const session of todaySessions) {
    const duration = session.duration || 25;
    // Check if session is linked to a high-priority goal or selected objective
    const linkedGoal = session.goalId ? projects.find(p => p.id === session.goalId) : null;
    if (linkedGoal && linkedGoal.priority === 'high') {
      coreMinutes += duration;
    } else {
      // Check if the session task is in onwardItems with high priority
      const onwardTask = onwardItems.find(it => it.title === session.label && !it.done);
      if (onwardTask && onwardTask.priority === 'high') {
        coreMinutes += duration;
      } else {
        maintenanceMinutes += duration;
      }
    }
  }

  return {
    coreMinutes,
    maintenanceMinutes,
    distractionsCount: todayBrainDumps.length,
    totalMinutes: coreMinutes + maintenanceMinutes,
    sessionCount: todaySessions.length,
  };
}

export const DEFAULT_SKILLS = [
  { id: uid(), name: 'Programming', color: T.blue, subskills: [
    { id: uid(), name: 'JavaScript', level: 5 },
    { id: uid(), name: 'Python',     level: 4 },
    { id: uid(), name: 'Systems',    level: 3 },
  ]},
  { id: uid(), name: 'Creative', color: T.purple, subskills: [
    { id: uid(), name: 'Writing', level: 6 },
    { id: uid(), name: 'Design',  level: 4 },
    { id: uid(), name: 'Music',   level: 3 },
  ]},
  { id: uid(), name: 'Leadership', color: T.green, subskills: [
    { id: uid(), name: 'Communication', level: 5 },
    { id: uid(), name: 'Planning',      level: 4 },
    { id: uid(), name: 'Mentoring',     level: 3 },
  ]},
  { id: uid(), name: 'Wellness', color: T.rose, subskills: [
    { id: uid(), name: 'Exercise',    level: 5 },
    { id: uid(), name: 'Sleep',       level: 6 },
    { id: uid(), name: 'Mindfulness', level: 3 },
  ]},
];

/**
 * Calculate deadline alerts for projects.
 * Returns sorted array of { id, title, days, type, color, priority }.
 */
export function calculateDeadlineAlerts(projectsList) {
  const now = new Date();
  const alerts = [];

  projectsList.forEach(p => {
    if (!p.deadline || p.subtasks?.every(s => s.done)) return;

    const deadline = new Date(p.deadline);
    if (isNaN(deadline.getTime())) return; // Skip invalid dates
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      alerts.push({ id: p.id, title: p.title, days: diffDays, type: 'overdue', color: '#f77171', priority: p.priority });
    } else if (diffDays <= 3) {
      alerts.push({ id: p.id, title: p.title, days: diffDays, type: 'urgent', color: '#f0b429', priority: p.priority });
    } else if (diffDays <= 7) {
      alerts.push({ id: p.id, title: p.title, days: diffDays, type: 'upcoming', color: '#53aaff', priority: p.priority });
    }
  });

  return alerts.sort((a, b) => {
    if (a.type === 'overdue' && b.type !== 'overdue') return -1;
    if (b.type === 'overdue' && a.type !== 'overdue') return 1;
    return a.days - b.days;
  });
}

/**
 * Sanitize LLM response content before storing in React state.
 * Strips HTML, limits length, and normalizes whitespace.
 * @param {string} content - Raw LLM response text
 * @returns {string} Sanitized text safe for React state
 */
export function sanitizeLLMContent(content) {
  if (typeof content !== 'string') return '';
  return content
    .replace(/<[^>]*>/g, '')       // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Strip control characters
    .trim()
    .slice(0, 50000);              // 50KB limit
}
