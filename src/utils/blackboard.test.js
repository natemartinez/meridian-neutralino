/**
 * Tests for blackboard.js
 *
 * What we're testing:
 * - compileBlackboard: pure function that aggregates app state into a flat JSON snapshot
 *   - activeGoals: filtered, mapped with progress/quadrant/deadline
 *   - quadrantDistribution: Eisenhower quadrant counts
 *   - todayCompletedCount, todayFocusedMinutes, todayTotalMinutes
 *   - selectedForToday, onwardItems (condensed)
 *   - currentStreak, lastActiveDate, planningConfidence
 *   - knowledgeEntries (condensed), corrections
 *   - activeSession (condensed), currentProgram, currentPhase
 *   - currentHour, dayOfWeek, isAfterMidnight
 * - computeQuadrantDistribution: pure quadrant counting
 * - buildInteractionSyncPayload: derives store sync payload from Blackboard
 * - getBlackboardDeps: returns stable dependency array
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compileBlackboard,
  computeQuadrantDistribution,
  buildInteractionSyncPayload,
  getBlackboardDeps,
} from './blackboard.js';

// ============================================================
// Helpers
// ============================================================

/** Create a minimal project object for testing */
function makeProject(overrides = {}) {
  return {
    id: 'proj_1',
    title: 'Test Goal',
    quadrant: 'q2',
    priority: 'medium',
    completedAt: null,
    deadline: null,
    subtasks: [],
    checkpoints: [],
    ...overrides,
  };
}

/** Create a minimal onward item */
function makeOnwardItem(overrides = {}) {
  return {
    id: 'task_1',
    title: 'Test Task',
    done: false,
    date: new Date().toDateString(),
    estimatedMinutes: 30,
    ...overrides,
  };
}

/** Default state object for compileBlackboard */
function defaultState(overrides = {}) {
  return {
    projects: [],
    onwardItems: [],
    selectedForToday: [],
    streakDays: 0,
    lastActiveDate: null,
    syncEvents: [],
    knowledgePool: { entries: [], corrections: '' },
    activeSession: null,
    mainPage: 'hq',
    getTodayStats: () => ({ totalMin: 0, focusedMin: 0 }),
    ...overrides,
  };
}

// ============================================================
// compileBlackboard
// ============================================================
describe('compileBlackboard', () => {
  it('returns a complete Blackboard object with default values', () => {
    const bb = compileBlackboard(defaultState());

    expect(bb).toHaveProperty('activeGoals');
    expect(bb).toHaveProperty('quadrantDistribution');
    expect(bb).toHaveProperty('todayCompletedCount');
    expect(bb).toHaveProperty('todayFocusedMinutes');
    expect(bb).toHaveProperty('todayTotalMinutes');
    expect(bb).toHaveProperty('selectedForToday');
    expect(bb).toHaveProperty('onwardItems');
    expect(bb).toHaveProperty('currentStreak');
    expect(bb).toHaveProperty('lastActiveDate');
    expect(bb).toHaveProperty('planningConfidence');
    expect(bb).toHaveProperty('knowledgeEntries');
    expect(bb).toHaveProperty('corrections');
    expect(bb).toHaveProperty('activeSession');
    expect(bb).toHaveProperty('currentProgram');
    expect(bb).toHaveProperty('currentPhase');
    expect(bb).toHaveProperty('currentHour');
    expect(bb).toHaveProperty('dayOfWeek');
    expect(bb).toHaveProperty('isAfterMidnight');

    // Defaults
    expect(bb.activeGoals).toEqual([]);
    expect(bb.quadrantDistribution).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
    expect(bb.todayCompletedCount).toBe(0);
    expect(bb.todayFocusedMinutes).toBe(0);
    expect(bb.todayTotalMinutes).toBe(0);
    expect(bb.selectedForToday).toEqual([]);
    expect(bb.onwardItems).toEqual([]);
    expect(bb.currentStreak).toBe(0);
    expect(bb.lastActiveDate).toBeNull();
    expect(bb.planningConfidence).toBe(0);
    expect(bb.knowledgeEntries).toEqual([]);
    expect(bb.corrections).toBe('');
    expect(bb.activeSession).toBeNull();
    expect(bb.currentProgram).toBeNull();
    expect(bb.currentPhase).toBeNull();
  });

  it('maps active goals with progress and metadata', () => {
    const projects = [
      makeProject({
        id: 'g1',
        title: 'Build App',
        quadrant: 'q1',
        priority: 'high',
        deadline: '2026-07-15',
        subtasks: [
          { id: 'st1', title: 'Setup', done: true },
          { id: 'st2', title: 'Build', done: false },
        ],
        checkpoints: [{ id: 'cp1', title: 'Launch', done: false }],
      }),
      makeProject({
        id: 'g2',
        title: 'Learn Piano',
        quadrant: 'q2',
        completedAt: '2026-06-01', // completed — should be filtered out
      }),
      makeProject({
        id: 'g3',
        title: 'Read Books',
        quadrant: 'q3',
        priority: 'low',
        subtasks: [{ id: 'st3', title: 'Buy', done: true }],
      }),
    ];

    const bb = compileBlackboard(defaultState({ projects }));

    expect(bb.activeGoals).toHaveLength(2);
    expect(bb.activeGoals[0]).toEqual({
      id: 'g1',
      title: 'Build App',
      progress: 33, // 1 done / 3 total ≈ 33%
      quadrant: 'q1',
      subtaskCount: 2,
      completedSubtasks: 1,
      deadline: '2026-07-15',
      priority: 'high',
    });
    expect(bb.activeGoals[1]).toEqual({
      id: 'g3',
      title: 'Read Books',
      progress: 100, // 1 done / 1 total = 100%
      quadrant: 'q3',
      subtaskCount: 1,
      completedSubtasks: 1,
      deadline: null,
      priority: 'low',
    });
  });

  it('computes quadrant distribution correctly', () => {
    const projects = [
      makeProject({ quadrant: 'q1' }),
      makeProject({ quadrant: 'q2' }),
      makeProject({ quadrant: 'q2' }),
      makeProject({ quadrant: 'q3' }),
      makeProject({ quadrant: 'q4' }),
      makeProject({ quadrant: 'q2', completedAt: '2026-06-01' }), // completed — excluded
    ];

    const bb = compileBlackboard(defaultState({ projects }));
    expect(bb.quadrantDistribution).toEqual({ q1: 1, q2: 2, q3: 1, q4: 1 });
  });

  it('counts today completed items from onwardItems', () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const onwardItems = [
      makeOnwardItem({ id: 't1', done: true, date: today }),
      makeOnwardItem({ id: 't2', done: true, date: today }),
      makeOnwardItem({ id: 't3', done: false, date: today }),
      makeOnwardItem({ id: 't4', done: true, date: yesterday }), // not today
    ];

    const bb = compileBlackboard(defaultState({ onwardItems }));
    expect(bb.todayCompletedCount).toBe(2);
  });

  it('includes today stats from getTodayStats', () => {
    const getTodayStats = () => ({ totalMin: 120, focusedMin: 45 });

    const bb = compileBlackboard(defaultState({ getTodayStats }));
    expect(bb.todayFocusedMinutes).toBe(45);
    expect(bb.todayTotalMinutes).toBe(120);
  });

  it('handles getTodayStats gracefully when not a function', () => {
    const bb = compileBlackboard(defaultState({ getTodayStats: undefined }));
    expect(bb.todayFocusedMinutes).toBe(0);
    expect(bb.todayTotalMinutes).toBe(0);
  });

  it('includes streak and confidence data', () => {
    const syncEvents = [
      { type: 'task_accepted', ts: Date.now() },
      { type: 'task_completed', ts: Date.now() },
    ];

    const bb = compileBlackboard(defaultState({
      streakDays: 7,
      lastActiveDate: '2026-06-29',
      syncEvents,
    }));

    expect(bb.currentStreak).toBe(7);
    expect(bb.lastActiveDate).toBe('2026-06-29');
    expect(bb.planningConfidence).toBeGreaterThan(0);
  });

  it('condenses knowledge pool entries', () => {
    const knowledgePool = {
      entries: [
        { cat: 'preference', text: 'Likes dark mode', conf: 0.9 },
        { cat: 'habit', text: 'Works best in morning', conf: 0.7 },
      ],
      corrections: 'User prefers light mode actually',
    };

    const bb = compileBlackboard(defaultState({ knowledgePool }));
    expect(bb.knowledgeEntries).toEqual([
      { cat: 'preference', text: 'Likes dark mode', conf: 0.9 },
      { cat: 'habit', text: 'Works best in morning', conf: 0.7 },
    ]);
    expect(bb.corrections).toBe('User prefers light mode actually');
  });

  it('condenses activeSession to minimal fields', () => {
    const activeSession = {
      id: 'sess_1',
      startTime: '2026-06-30T10:00:00.000Z',
      endTime: null,
      label: 'Deep Work',
      goalId: 'proj_1',
      extraField: 'should be stripped',
    };

    const bb = compileBlackboard(defaultState({ activeSession }));
    expect(bb.activeSession).toEqual({
      id: 'sess_1',
      startTime: '2026-06-30T10:00:00.000Z',
      label: 'Deep Work',
      goalId: 'proj_1',
    });
    expect(bb.activeSession).not.toHaveProperty('extraField');
    expect(bb.activeSession).not.toHaveProperty('endTime');
  });

  it('detects current program from mainPage', () => {
    const bb = compileBlackboard(defaultState({ mainPage: 'program-briefing' }));
    expect(bb.currentProgram).toBe('briefing');
  });

  it('returns null currentProgram for non-program pages', () => {
    const bb = compileBlackboard(defaultState({ mainPage: 'hq' }));
    expect(bb.currentProgram).toBeNull();
  });

  it('includes time context fields (defaults to new Date())', () => {
    const bb = compileBlackboard(defaultState());
    const now = new Date();

    expect(bb.currentHour).toBe(now.getHours());
    expect(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).toContain(bb.dayOfWeek);
    expect(typeof bb.isAfterMidnight).toBe('boolean');
    expect(bb.isAfterMidnight).toBe(now.getHours() < 6);
  });

  it('uses provided now override for time context', () => {
    const fixedNow = new Date('2026-06-30T03:30:00'); // 3:30 AM Wednesday
    const bb = compileBlackboard(defaultState({ now: fixedNow }));

    expect(bb.currentHour).toBe(3);
    expect(bb.dayOfWeek).toBe('Tue');
    expect(bb.isAfterMidnight).toBe(true);
  });

  it('uses provided now for midday context', () => {
    const fixedNow = new Date('2026-06-30T14:00:00'); // 2:00 PM
    const bb = compileBlackboard(defaultState({ now: fixedNow }));

    expect(bb.currentHour).toBe(14);
    expect(bb.dayOfWeek).toBe('Tue');
    expect(bb.isAfterMidnight).toBe(false);
  });

  it('uses provided now for todayCompletedCount date comparison', () => {
    // Use a fixed date so todayCompletedCount compares against that date
    const fixedNow = new Date('2026-07-04T12:00:00');
    const onwardItems = [
      makeOnwardItem({ id: 't1', done: true, date: 'Sat Jul 04 2026' }),
      makeOnwardItem({ id: 't2', done: true, date: 'Sun Jul 05 2026' }), // different day
    ];

    const bb = compileBlackboard(defaultState({ onwardItems, now: fixedNow }));
    expect(bb.todayCompletedCount).toBe(1);
    expect(bb.currentHour).toBe(12);
    expect(bb.dayOfWeek).toBe('Sat');
  });

  it('handles null/undefined projects gracefully', () => {
    const bb = compileBlackboard(defaultState({ projects: null }));
    expect(bb.activeGoals).toEqual([]);
    expect(bb.quadrantDistribution).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
  });

  it('handles null/undefined onwardItems gracefully', () => {
    const bb = compileBlackboard(defaultState({ onwardItems: null }));
    expect(bb.todayCompletedCount).toBe(0);
    expect(bb.onwardItems).toEqual([]);
  });

  it('handles null/undefined knowledgePool gracefully', () => {
    const bb = compileBlackboard(defaultState({ knowledgePool: null }));
    expect(bb.knowledgeEntries).toEqual([]);
    expect(bb.corrections).toBe('');
  });

  it('handles null/undefined syncEvents gracefully', () => {
    const bb = compileBlackboard(defaultState({ syncEvents: null }));
    expect(bb.planningConfidence).toBe(0);
  });
});

// ============================================================
// computeQuadrantDistribution
// ============================================================
describe('computeQuadrantDistribution', () => {
  it('returns zero counts for empty projects', () => {
    expect(computeQuadrantDistribution([])).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
  });

  it('returns zero counts for null/undefined', () => {
    expect(computeQuadrantDistribution(null)).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
    expect(computeQuadrantDistribution(undefined)).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
  });

  it('counts active goals per quadrant', () => {
    const projects = [
      makeProject({ quadrant: 'q1' }),
      makeProject({ quadrant: 'q2' }),
      makeProject({ quadrant: 'q2' }),
      makeProject({ quadrant: 'q3' }),
      makeProject({ quadrant: 'q4' }),
    ];
    expect(computeQuadrantDistribution(projects)).toEqual({ q1: 1, q2: 2, q3: 1, q4: 1 });
  });

  it('excludes completed goals', () => {
    const projects = [
      makeProject({ quadrant: 'q1' }),
      makeProject({ quadrant: 'q2', completedAt: '2026-06-01' }),
    ];
    expect(computeQuadrantDistribution(projects)).toEqual({ q1: 1, q2: 0, q3: 0, q4: 0 });
  });

  it('ignores unknown quadrants', () => {
    const projects = [
      makeProject({ quadrant: 'q1' }),
      makeProject({ quadrant: 'unknown' }),
      makeProject({ quadrant: undefined }), // no quadrant
    ];
    expect(computeQuadrantDistribution(projects)).toEqual({ q1: 1, q2: 0, q3: 0, q4: 0 });
  });
});

// ============================================================
// buildInteractionSyncPayload
// ============================================================
describe('buildInteractionSyncPayload', () => {
  it('derives sync payload from Blackboard', () => {
    const blackboard = compileBlackboard(defaultState({
      streakDays: 5,
      onwardItems: [makeOnwardItem({ id: 't1', done: true })],
      knowledgePool: {
        entries: [{ cat: 'preference', text: 'Likes dark mode', conf: 0.9 }],
        corrections: '',
      },
    }));

    const payload = buildInteractionSyncPayload(blackboard, {
      projects: [],
      activePage: 'goals',
      waypointContext: null,
      sessions: [],
      deferredItemsCount: 2,
      backlogItemsCount: 1,
    });

    expect(payload).toEqual({
      currentStreak: 5,
      todayCompletedCount: 1,
      activePage: 'goals',
      waypointContext: null,
      knowledgePool: {
        entries: [{ cat: 'preference', text: 'Likes dark mode', conf: 0.9 }],
        corrections: '',
      },
      confidence: 0,
      projects: [],
      onwardItems: [{ id: 't1', title: 'Test Task', done: true, estimatedMinutes: 30 }],
      sessions: [],
      deferredItems: 2,
      backlogItems: 1,
      quadrantCounts: { q1: 0, q2: 0, q3: 0, q4: 0 },
    });
  });

  it('includes quadrant distribution from Blackboard', () => {
    const projects = [
      makeProject({ quadrant: 'q1' }),
      makeProject({ quadrant: 'q2' }),
    ];
    const blackboard = compileBlackboard(defaultState({ projects }));

    const payload = buildInteractionSyncPayload(blackboard, {
      projects,
      activePage: 'hq',
      waypointContext: null,
      sessions: [],
      deferredItemsCount: 0,
      backlogItemsCount: 0,
    });

    expect(payload.quadrantCounts).toEqual({ q1: 1, q2: 1, q3: 0, q4: 0 });
  });
});

// ============================================================
// getBlackboardDeps
// ============================================================
describe('getBlackboardDeps', () => {
  it('returns a stable array of dependencies', () => {
    const deps = {
      projects: [{ id: 'p1' }],
      onwardItems: [{ id: 'o1' }],
      selectedForToday: ['p1'],
      streakDays: 3,
      lastActiveDate: '2026-06-29',
      syncEvents: [{ type: 'task_accepted' }],
      knowledgePool: { entries: [{ cat: 'test' }], corrections: '' },
      activeSession: null,
      mainPage: 'hq',
      getTodayStats: () => ({}),
    };

    const result = getBlackboardDeps(deps);
    expect(result).toHaveLength(11);
    expect(result[0]).toBe(deps.projects);
    expect(result[1]).toBe(deps.onwardItems);
    expect(result[2]).toBe(deps.selectedForToday);
    expect(result[3]).toBe(deps.streakDays);
    expect(result[4]).toBe(deps.lastActiveDate);
    expect(result[5]).toBe(deps.syncEvents);
    expect(result[6]).toBe(deps.knowledgePool.entries);
    expect(result[7]).toBe(deps.knowledgePool.corrections);
    expect(result[8]).toBe(deps.activeSession);
    expect(result[9]).toBe(deps.mainPage);
    expect(result[10]).toBe(deps.getTodayStats);
  });

  it('includes getTodayStats as a dependency (useCallback may change)', () => {
    const deps = {
      projects: [],
      onwardItems: [],
      selectedForToday: [],
      streakDays: 0,
      lastActiveDate: null,
      syncEvents: [],
      knowledgePool: { entries: [], corrections: '' },
      activeSession: null,
      mainPage: 'hq',
      getTodayStats: () => ({}),
    };

    const result = getBlackboardDeps(deps);
    // getTodayStats is a useCallback — its reference is stable, but it's still
    // a dependency because useCallback can recreate if its own deps change.
    expect(result).toContain(deps.getTodayStats);
  });
});
