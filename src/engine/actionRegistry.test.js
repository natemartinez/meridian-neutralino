/**
 * Tests for actionRegistry.js
 *
 * What we're testing:
 * - createActionRegistry: factory returns actions map + dispatch + getAvailableActions
 * - Each action's precondition logic with mock Blackboard data
 * - dispatch: success case, unknown action, precondition failure, error handling
 * - getAvailableActions: filters by precondition
 * - All 16 actions defined with correct schema
 */

import { describe, it, expect, vi } from 'vitest';
import { createActionRegistry } from './actionRegistry.js';

// ============================================================
// Helpers
// ============================================================

/** Create a minimal Blackboard snapshot for precondition testing */
function makeBlackboard(overrides = {}) {
  return {
    activeGoals: [],
    activeSession: null,
    currentProgram: null,
    currentPhase: null,
    ...overrides,
  };
}

/** Create a mock hook functions object */
function makeHookFns(overrides = {}) {
  return {
    startSession: vi.fn(),
    stopSession: vi.fn(),
    toggleSubtask: vi.fn(),
    createGoalFromModal: vi.fn(),
    addOnwardItem: vi.fn(),
    setFocus: vi.fn(),
    addKnowledgeEntry: vi.fn(),
    updateCorrections: vi.fn(),
    onSubNav: vi.fn(),
    onOpenProgramWithPage: vi.fn(),
    setSelectedForToday: vi.fn(),
    finishBriefing: vi.fn(),
    generateNovaPlan: vi.fn(),
    toggleOnwardDone: vi.fn(),
    completeGoal: vi.fn(),
    renameGoal: vi.fn(),
    deleteGoal: vi.fn(),
    ...overrides,
  };
}

// ============================================================
// createActionRegistry
// ============================================================
describe('createActionRegistry', () => {
  it('returns an object with actions, dispatch, and getAvailableActions', () => {
    const registry = createActionRegistry(makeHookFns());
    expect(registry).toHaveProperty('actions');
    expect(registry).toHaveProperty('dispatch');
    expect(registry).toHaveProperty('getAvailableActions');
    expect(typeof registry.dispatch).toBe('function');
    expect(typeof registry.getAvailableActions).toBe('function');
  });

  it('defines all expected actions', () => {
    const registry = createActionRegistry(makeHookFns());
    const actionIds = Object.keys(registry.actions).sort();
    expect(actionIds).toEqual([
      'ADD_KNOWLEDGE_ENTRY',
      'ADD_ONWARD_ITEM',
      'COMPLETE_BRIEFING',
      'COMPLETE_GOAL',
      'CREATE_GOAL',
      'DELETE_GOAL',
      'GENERATE_PLAN',
      'NAVIGATE_TO',
      'RENAME_GOAL',
      'SET_FOCUS_ITEMS',
      'SET_PICK3',
      'START_FOCUS_SESSION',
      'STOP_FOCUS_SESSION',
      'TOGGLE_ONWARD_DONE',
      'TOGGLE_SUBTASK',
      'UPDATE_CORRECTIONS',
    ]);
  });

  it('each action has the correct schema', () => {
    const registry = createActionRegistry(makeHookFns());
    Object.values(registry.actions).forEach(action => {
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('precondition');
      expect(action).toHaveProperty('effect');
      expect(action).toHaveProperty('cost');
      expect(action).toHaveProperty('category');
      expect(typeof action.id).toBe('string');
      expect(typeof action.label).toBe('string');
      expect(typeof action.precondition).toBe('function');
      expect(typeof action.effect).toBe('function');
      expect(typeof action.cost).toBe('number');
      expect(['tracking', 'goals', 'knowledge', 'navigation', 'system']).toContain(action.category);
    });
  });
});

// ============================================================
// dispatch
// ============================================================
describe('dispatch', () => {
  it('returns success when action exists and precondition passes', () => {
    const hookFns = makeHookFns();
    const registry = createActionRegistry(hookFns);

    const result = registry.dispatch('CREATE_GOAL', { title: 'New Goal' }, makeBlackboard());
    expect(result).toEqual({ success: true });
    expect(hookFns.createGoalFromModal).toHaveBeenCalledWith({ title: 'New Goal' });
  });

  it('returns error for unknown action', () => {
    const registry = createActionRegistry(makeHookFns());
    const result = registry.dispatch('UNKNOWN_ACTION', {}, makeBlackboard());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });

  it('returns error when precondition fails', () => {
    const hookFns = makeHookFns();
    const registry = createActionRegistry(hookFns);

    // START_FOCUS_SESSION requires no active session
    const bb = makeBlackboard({ activeSession: { id: 'sess_1' } });
    const result = registry.dispatch('START_FOCUS_SESSION', { label: 'Test' }, bb);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Precondition failed');
    expect(hookFns.startSession).not.toHaveBeenCalled();
  });

  it('does not call effect when precondition fails', () => {
    const hookFns = makeHookFns();
    const registry = createActionRegistry(hookFns);

    // STOP_FOCUS_SESSION requires an active session
    const bb = makeBlackboard({ activeSession: null });
    registry.dispatch('STOP_FOCUS_SESSION', {}, bb);
    expect(hookFns.stopSession).not.toHaveBeenCalled();
  });

  it('catches errors thrown by effect and returns error result', () => {
    const hookFns = makeHookFns({
      createGoalFromModal: vi.fn(() => { throw new Error('Database error'); }),
    });
    const registry = createActionRegistry(hookFns);

    const result = registry.dispatch('CREATE_GOAL', {}, makeBlackboard());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });

  it('passes params to the effect function', () => {
    const hookFns = makeHookFns();
    const registry = createActionRegistry(hookFns);

    registry.dispatch('ADD_ONWARD_ITEM', { title: 'Task', estimatedMinutes: 30, priority: 'high' }, makeBlackboard());
    expect(hookFns.addOnwardItem).toHaveBeenCalledWith('Task', 30, 'high');
  });
});

// ============================================================
// Precondition Logic
// ============================================================
describe('precondition logic', () => {
  describe('START_FOCUS_SESSION', () => {
    it('passes when no active session', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.START_FOCUS_SESSION;
      expect(action.precondition(makeBlackboard({ activeSession: null }), {})).toBe(true);
    });

    it('fails when session is active', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.START_FOCUS_SESSION;
      expect(action.precondition(makeBlackboard({ activeSession: { id: 's1' } }), {})).toBe(false);
    });
  });

  describe('STOP_FOCUS_SESSION', () => {
    it('passes when session is active', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.STOP_FOCUS_SESSION;
      expect(action.precondition(makeBlackboard({ activeSession: { id: 's1' } }), {})).toBe(true);
    });

    it('fails when no active session', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.STOP_FOCUS_SESSION;
      expect(action.precondition(makeBlackboard({ activeSession: null }), {})).toBe(false);
    });
  });

  describe('TOGGLE_SUBTASK', () => {
    it('passes when goal exists and progress < 100', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.TOGGLE_SUBTASK;
      const bb = makeBlackboard({
        activeGoals: [{ id: 'g1', progress: 50 }],
      });
      expect(action.precondition(bb, { goalId: 'g1', subtaskId: 'st1' })).toBe(true);
    });

    it('fails when goal does not exist', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.TOGGLE_SUBTASK;
      const bb = makeBlackboard({ activeGoals: [] });
      expect(action.precondition(bb, { goalId: 'g1', subtaskId: 'st1' })).toBe(false);
    });

    it('fails when goal progress is 100', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.TOGGLE_SUBTASK;
      const bb = makeBlackboard({
        activeGoals: [{ id: 'g1', progress: 100 }],
      });
      expect(action.precondition(bb, { goalId: 'g1', subtaskId: 'st1' })).toBe(false);
    });
  });

  describe('COMPLETE_GOAL', () => {
    it('passes when goal exists', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.COMPLETE_GOAL;
      const bb = makeBlackboard({ activeGoals: [{ id: 'g1' }] });
      expect(action.precondition(bb, { goalId: 'g1' })).toBe(true);
    });

    it('fails when goal does not exist', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.COMPLETE_GOAL;
      expect(action.precondition(makeBlackboard(), { goalId: 'g1' })).toBe(false);
    });
  });

  describe('RENAME_GOAL', () => {
    it('passes when goal exists', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.RENAME_GOAL;
      const bb = makeBlackboard({ activeGoals: [{ id: 'g1' }] });
      expect(action.precondition(bb, { goalId: 'g1' })).toBe(true);
    });

    it('fails when goal does not exist', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.RENAME_GOAL;
      expect(action.precondition(makeBlackboard(), { goalId: 'g1' })).toBe(false);
    });
  });

  describe('DELETE_GOAL', () => {
    it('passes when goal exists', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.DELETE_GOAL;
      const bb = makeBlackboard({ activeGoals: [{ id: 'g1' }] });
      expect(action.precondition(bb, { goalId: 'g1' })).toBe(true);
    });

    it('fails when goal does not exist', () => {
      const registry = createActionRegistry(makeHookFns());
      const action = registry.actions.DELETE_GOAL;
      expect(action.precondition(makeBlackboard(), { goalId: 'g1' })).toBe(false);
    });
  });

  describe('actions with no precondition', () => {
    const alwaysPass = [
      'CREATE_GOAL',
      'ADD_ONWARD_ITEM',
      'TOGGLE_ONWARD_DONE',
      'SET_FOCUS_ITEMS',
      'ADD_KNOWLEDGE_ENTRY',
      'UPDATE_CORRECTIONS',
      'NAVIGATE_TO',
      'SET_PICK3',
      'COMPLETE_BRIEFING',
      'GENERATE_PLAN',
    ];

    alwaysPass.forEach(actionId => {
      it(`${actionId} precondition always returns true`, () => {
        const registry = createActionRegistry(makeHookFns());
        const action = registry.actions[actionId];
        expect(action.precondition(makeBlackboard(), {})).toBe(true);
      });
    });
  });
});

// ============================================================
// getAvailableActions
// ============================================================
describe('getAvailableActions', () => {
  it('returns actions whose preconditions pass with empty params and default blackboard', () => {
    const registry = createActionRegistry(makeHookFns());
    // Default blackboard: no activeSession, no activeGoals
    const available = registry.getAvailableActions(makeBlackboard());
    const ids = available.map(a => a.id);

    // These pass because they have no precondition or params-agnostic preconditions
    expect(ids).toContain('START_FOCUS_SESSION');
    expect(ids).toContain('CREATE_GOAL');
    expect(ids).toContain('ADD_ONWARD_ITEM');
    expect(ids).toContain('TOGGLE_ONWARD_DONE');
    expect(ids).toContain('SET_FOCUS_ITEMS');
    expect(ids).toContain('ADD_KNOWLEDGE_ENTRY');
    expect(ids).toContain('UPDATE_CORRECTIONS');
    expect(ids).toContain('NAVIGATE_TO');
    expect(ids).toContain('SET_PICK3');
    expect(ids).toContain('COMPLETE_BRIEFING');
    expect(ids).toContain('GENERATE_PLAN');

    // STOP_FOCUS_SESSION requires activeSession — not present in default blackboard
    expect(ids).not.toContain('STOP_FOCUS_SESSION');

    // These require a goalId in params, so they won't pass with empty params
    expect(ids).not.toContain('TOGGLE_SUBTASK');
    expect(ids).not.toContain('COMPLETE_GOAL');
    expect(ids).not.toContain('RENAME_GOAL');
    expect(ids).not.toContain('DELETE_GOAL');
  });

  it('excludes actions whose precondition fails', () => {
    const registry = createActionRegistry(makeHookFns());
    // With an active session, START_FOCUS_SESSION should be excluded
    const bb = makeBlackboard({ activeSession: { id: 's1' } });
    const available = registry.getAvailableActions(bb);
    const ids = available.map(a => a.id);
    expect(ids).not.toContain('START_FOCUS_SESSION');
    expect(ids).toContain('STOP_FOCUS_SESSION');
  });

  it('excludes STOP_FOCUS_SESSION when no active session', () => {
    const registry = createActionRegistry(makeHookFns());
    const bb = makeBlackboard({ activeSession: null });
    const available = registry.getAvailableActions(bb);
    const ids = available.map(a => a.id);
    expect(ids).not.toContain('STOP_FOCUS_SESSION');
    expect(ids).toContain('START_FOCUS_SESSION');
  });

  it('excludes TOGGLE_SUBTASK when goal does not exist', () => {
    const registry = createActionRegistry(makeHookFns());
    const bb = makeBlackboard({ activeGoals: [] });
    const available = registry.getAvailableActions(bb);
    const ids = available.map(a => a.id);
    expect(ids).not.toContain('TOGGLE_SUBTASK');
  });

  it('excludes TOGGLE_SUBTASK even with matching goal because params are empty', () => {
    // getAvailableActions passes {} as params, so goalId-dependent preconditions
    // will fail. This is by design — dispatch() receives params from the LLM,
    // while getAvailableActions is a general availability check.
    const registry = createActionRegistry(makeHookFns());
    const bb = makeBlackboard({ activeGoals: [{ id: 'g1', progress: 50 }] });
    const available = registry.getAvailableActions(bb);
    const ids = available.map(a => a.id);
    expect(ids).not.toContain('TOGGLE_SUBTASK');
  });

  it('returns objects with id, label, cost, category', () => {
    const registry = createActionRegistry(makeHookFns());
    const available = registry.getAvailableActions(makeBlackboard());
    available.forEach(a => {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('label');
      expect(a).toHaveProperty('cost');
      expect(a).toHaveProperty('category');
    });
  });
});
