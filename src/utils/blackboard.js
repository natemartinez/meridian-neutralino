/**
 * Blackboard Adapter — Pure compilation functions for the read-only state aggregate.
 *
 * The Blackboard is a minimal, flat JSON snapshot of all app state that gets passed
 * to the LLM (via OpenRouter) for strategic planning. It is compiled from existing
 * hook state via pure selector functions — no side effects, no hook dependencies.
 *
 * This is the **only** data structure the LLM sees. Keeping it minimal reduces
 * token usage, improves prompt caching hit rates, and forces the LLM to focus on
 * what matters.
 *
 * @module blackboard
 */

import { computePlanningConfidence } from './nova.js';
import { progress } from './helpers.js';
import { isProgram, extractProgId } from '../constants/programs.js';

/**
 * Compile the full Blackboard snapshot from raw app state.
 *
 * This is a pure function — given the same inputs, it always returns the same output.
 * It is designed to be called inside a `useMemo` in the consuming hook.
 *
 * Time-context fields (currentHour, dayOfWeek, isAfterMidnight) are derived from
 * the optional `now` parameter. If omitted, they default to `new Date()` at call time.
 * In the consuming hook, `now` should be driven by a lightweight interval (e.g. 60s)
 * to prevent stale clock values when the app stays open across midnight.
 *
 * @param {Object} state - Raw app state values
 * @param {Array}  state.projects           - All projects/goals
 * @param {Array}  state.onwardItems        - Onward (task) items
 * @param {Array}  state.selectedForToday   - "Pick 3" selected objective IDs
 * @param {number} state.streakDays         - Current streak count
 * @param {string|null} state.lastActiveDate - Last active date string
 * @param {Array}  state.syncEvents         - NOVA sync events for confidence computation
 * @param {Object} state.knowledgePool      - Knowledge pool { entries, corrections }
 * @param {Object|null} state.activeSession - Active focus session or null
 * @param {string} state.mainPage           - Current main page identifier
 * @param {Function} state.getTodayStats    - Function returning today's stats
 * @param {Date}   [state.now]             - Optional Date override for time-context fields
 * @returns {Object} Compiled Blackboard snapshot
 */
export function compileBlackboard(state) {
  const {
    projects,
    onwardItems,
    selectedForToday,
    streakDays,
    lastActiveDate,
    syncEvents,
    knowledgePool,
    activeSession,
    mainPage,
    getTodayStats,
    now,
  } = state;

  const clock = now instanceof Date ? now : new Date();
  const todayStats = typeof getTodayStats === 'function' ? getTodayStats() : { totalMin: 0, focusedMin: 0 };

  return {
    // ── Goals ──
    activeGoals: (projects || [])
      .filter(p => !p.completedAt)
      .map(p => ({
        id: p.id,
        title: p.title,
        progress: progress(p),
        quadrant: p.quadrant || 'q2',
        subtaskCount: (p.subtasks || []).length,
        completedSubtasks: (p.subtasks || []).filter(s => s.done).length,
        deadline: p.deadline || null,
        priority: p.priority || 'medium',
      })),
    quadrantDistribution: computeQuadrantDistribution(projects),

    // ── Today ──
    todayCompletedCount: (onwardItems || [])
      .filter(it => it.done && it.date === clock.toDateString()).length,
    todayFocusedMinutes: todayStats.focusedMin || 0,
    todayTotalMinutes: todayStats.totalMin || 0,
    selectedForToday: selectedForToday || [],
    onwardItems: (onwardItems || []).map(i => ({
      id: i.id,
      title: i.title,
      done: i.done,
      estimatedMinutes: i.estimatedMinutes || 0,
    })),

    // ── Streak & Momentum ──
    currentStreak: streakDays || 0,
    lastActiveDate: lastActiveDate || null,
    planningConfidence: computePlanningConfidence(syncEvents || []),

    // ── Knowledge Pool (condensed) ──
    knowledgeEntries: (knowledgePool?.entries || []).map(e => ({
      cat: e.cat,
      text: e.text,
      conf: e.conf,
    })),
    corrections: knowledgePool?.corrections || '',

    // ── Session State ──
    activeSession: activeSession
      ? { id: activeSession.id, startTime: activeSession.startTime, label: activeSession.label, goalId: activeSession.goalId }
      : null,
    currentProgram: isProgram(mainPage) ? extractProgId(mainPage) : null,
    currentPhase: null, // Set by Execution Engine (Phase 4)

    // ── Time Context ──
    // Derived from `clock` (injected via `now` param or default `new Date()`).
    // In the consuming hook, `now` is driven by a 60s interval to prevent
    // stale values when the app stays open across midnight.
    currentHour: clock.getHours(),
    dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][clock.getDay()],
    isAfterMidnight: clock.getHours() < 6,
  };
}

/**
 * Compute the distribution of active goals across Eisenhower quadrants.
 *
 * @param {Array} projects - All projects/goals
 * @returns {Object} { q1: number, q2: number, q3: number, q4: number }
 */
export function computeQuadrantDistribution(projects) {
  const counts = { q1: 0, q2: 0, q3: 0, q4: 0 };
  (projects || [])
    .filter(p => !p.completedAt)
    .forEach(p => {
      if (p.quadrant && counts[p.quadrant] !== undefined) {
        counts[p.quadrant]++;
      }
    });
  return counts;
}

/**
 * Build the sync payload for the NOVA interaction store from the Blackboard.
 *
 * This replaces the ad-hoc syncAppState call in useAppState.js with a
 * deterministic mapping from the Blackboard, ensuring a single source of truth.
 *
 * @param {Object} blackboard - The compiled Blackboard snapshot
 * @param {Array}  projects   - Raw projects array (for quadrant counts)
 * @param {string} activePage - Current active canvas page
 * @param {Object|null} waypointContext - Current waypoint context
 * @param {Array}  sessions   - All sessions
 * @param {number} deferredItemsCount - Number of deferred items
 * @param {number} backlogItemsCount  - Number of backlog items
 * @returns {Object} Payload for novaInteractions.syncAppState()
 */
export function buildInteractionSyncPayload(blackboard, { projects, activePage, waypointContext, sessions, deferredItemsCount, backlogItemsCount }) {
  return {
    currentStreak: blackboard.currentStreak,
    todayCompletedCount: blackboard.todayCompletedCount,
    activePage,
    waypointContext,
    knowledgePool: {
      entries: blackboard.knowledgeEntries,
      corrections: blackboard.corrections,
    },
    confidence: blackboard.planningConfidence,
    projects,
    onwardItems: blackboard.onwardItems,
    sessions,
    deferredItems: deferredItemsCount,
    backlogItems: backlogItemsCount,
    quadrantCounts: blackboard.quadrantDistribution,
  };
}

/**
 * Get the Blackboard dependency array for useMemo.
 * This ensures the Blackboard is only recomputed when its actual dependencies change.
 *
 * @param {Object} deps - Dependency values
 * @returns {Array} Dependency array for useMemo
 */
export function getBlackboardDeps(deps) {
  const {
    projects,
    onwardItems,
    selectedForToday,
    streakDays,
    lastActiveDate,
    syncEvents,
    knowledgePool,
    activeSession,
    mainPage,
    getTodayStats,
  } = deps;

  return [
    projects,
    onwardItems,
    selectedForToday,
    streakDays,
    lastActiveDate,
    syncEvents,
    knowledgePool?.entries,
    knowledgePool?.corrections,
    activeSession,
    mainPage,
    getTodayStats,
  ];
}
