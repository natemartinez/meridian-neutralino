/**
 * Action Registry — A plain object map of all state-mutating actions.
 *
 * Each action wraps an existing hook function (from useGoalActions, useTracking,
 * useNOVA, etc.) with a schema that includes:
 *   - id:         UPPER_SNAKE_CASE identifier
 *   - label:      Human-readable description
 *   - precondition: (blackboard, params) => boolean — can this action run now?
 *   - effect:     (params) => void — calls the underlying hook function
 *   - cost:       Relative cost (1-10) for planning
 *   - category:   Domain grouping ('tracking'|'goals'|'knowledge'|'navigation'|'system')
 *
 * The registry is stateless and testable. Hook function references are injected
 * via the `hookFns` parameter at initialization.
 *
 * Usage:
 *   const registry = createActionRegistry({ startSession, stopSession, ... });
 *   registry.dispatch('START_FOCUS_SESSION', { label: 'Deep Work' }, blackboard);
 *
 * @module actionRegistry
 */

/**
 * Create the action registry with injected hook function references.
 *
 * @param {Object} hookFns - References to the actual hook functions
 * @param {Function} hookFns.startSession       - From useTracking
 * @param {Function} hookFns.stopSession        - From useTracking
 * @param {Function} hookFns.toggleSubtask      - From useGoalActions
 * @param {Function} hookFns.createGoalFromModal - From useGoalActions
 * @param {Function} hookFns.addOnwardItem      - From useGoalActions
 * @param {Function} hookFns.setFocus           - From useAppState (setFocus)
 * @param {Function} hookFns.addKnowledgeEntry  - From useNOVA
 * @param {Function} hookFns.updateCorrections  - From useNOVA
 * @param {Function} hookFns.onSubNav           - Navigation helper
 * @param {Function} hookFns.onOpenProgramWithPage - Navigation helper
 * @param {Function} hookFns.setSelectedForToday - From useAppState
 * @param {Function} hookFns.finishBriefing     - From NOVAProgramPanel (injected later)
 * @param {Function} hookFns.generateNovaPlan   - From useNOVA
 * @param {Function} hookFns.toggleOnwardDone   - From useGoalActions
 * @param {Function} hookFns.completeGoal       - From useGoalActions
 * @param {Function} hookFns.renameGoal         - From useGoalActions
 * @param {Function} hookFns.deleteGoal         - From useGoalActions
 * @returns {Object} Registry with actions map and dispatch function
 */
export function createActionRegistry(hookFns) {
  const {
    startSession,
    stopSession,
    toggleSubtask,
    createGoalFromModal,
    addOnwardItem,
    setFocus,
    addKnowledgeEntry,
    updateCorrections,
    onSubNav,
    onOpenProgramWithPage,
    setSelectedForToday,
    finishBriefing,
    generateNovaPlan,
    toggleOnwardDone,
    completeGoal,
    renameGoal,
    deleteGoal,
  } = hookFns;

  /** @type {Object<string, Action>} */
  const actions = {
    // ── Tracking ──────────────────────────────────────────────
    START_FOCUS_SESSION: {
      id: 'START_FOCUS_SESSION',
      label: 'Start a focus session',
      precondition: (bb) => !bb.activeSession,
      effect: ({ label, goalId, programId }) => startSession(label, goalId, programId),
      cost: 2,
      category: 'tracking',
    },

    STOP_FOCUS_SESSION: {
      id: 'STOP_FOCUS_SESSION',
      label: 'Stop the active focus session',
      precondition: (bb) => !!bb.activeSession,
      effect: () => stopSession(),
      cost: 1,
      category: 'tracking',
    },

    // ── Goals ─────────────────────────────────────────────────
    TOGGLE_SUBTASK: {
      id: 'TOGGLE_SUBTASK',
      label: 'Toggle a subtask completion',
      precondition: (bb, { goalId, subtaskId }) => {
        const goal = (bb.activeGoals || []).find(g => g.id === goalId);
        return !!goal && goal.progress < 100;
      },
      effect: ({ goalId, subtaskId }) => toggleSubtask(goalId, subtaskId),
      cost: 1,
      category: 'goals',
    },

    CREATE_GOAL: {
      id: 'CREATE_GOAL',
      label: 'Create a new goal/project',
      precondition: () => true,
      effect: (data) => createGoalFromModal(data),
      cost: 5,
      category: 'goals',
    },

    ADD_ONWARD_ITEM: {
      id: 'ADD_ONWARD_ITEM',
      label: 'Add a task to the onward list',
      precondition: () => true,
      effect: ({ title, estimatedMinutes, priority }) => addOnwardItem(title, estimatedMinutes, priority),
      cost: 2,
      category: 'goals',
    },

    TOGGLE_ONWARD_DONE: {
      id: 'TOGGLE_ONWARD_DONE',
      label: 'Toggle a task completion status',
      precondition: () => true,
      effect: ({ id }) => toggleOnwardDone(id),
      cost: 1,
      category: 'goals',
    },

    COMPLETE_GOAL: {
      id: 'COMPLETE_GOAL',
      label: 'Mark a goal as completed',
      precondition: (bb, { goalId }) => {
        const goal = (bb.activeGoals || []).find(g => g.id === goalId);
        return !!goal;
      },
      effect: ({ goalId }) => completeGoal(goalId),
      cost: 3,
      category: 'goals',
    },

    RENAME_GOAL: {
      id: 'RENAME_GOAL',
      label: 'Rename a goal',
      precondition: (bb, { goalId }) => {
        const goal = (bb.activeGoals || []).find(g => g.id === goalId);
        return !!goal;
      },
      effect: ({ goalId, newTitle }) => renameGoal(goalId, newTitle),
      cost: 1,
      category: 'goals',
    },

    DELETE_GOAL: {
      id: 'DELETE_GOAL',
      label: 'Delete a goal permanently',
      precondition: (bb, { goalId }) => {
        const goal = (bb.activeGoals || []).find(g => g.id === goalId);
        return !!goal;
      },
      effect: ({ goalId }) => deleteGoal(goalId),
      cost: 3,
      category: 'goals',
    },

    SET_FOCUS_ITEMS: {
      id: 'SET_FOCUS_ITEMS',
      label: 'Set the focus items for today',
      precondition: () => true,
      effect: ({ items }) => setFocus(items),
      cost: 2,
      category: 'goals',
    },

    // ── Knowledge ─────────────────────────────────────────────
    ADD_KNOWLEDGE_ENTRY: {
      id: 'ADD_KNOWLEDGE_ENTRY',
      label: 'Add an entry to the knowledge pool',
      precondition: () => true,
      effect: ({ cat, text }) => addKnowledgeEntry(cat, text),
      cost: 1,
      category: 'knowledge',
    },

    UPDATE_CORRECTIONS: {
      id: 'UPDATE_CORRECTIONS',
      label: 'Update the corrections field in the knowledge pool',
      precondition: () => true,
      effect: ({ text }) => updateCorrections(text),
      cost: 1,
      category: 'knowledge',
    },

    // ── Navigation ────────────────────────────────────────────
    NAVIGATE_TO: {
      id: 'NAVIGATE_TO',
      label: 'Navigate to a page or program',
      precondition: () => true,
      effect: ({ page, programId }) => {
        if (programId) {
          onOpenProgramWithPage(programId, page);
        } else {
          onSubNav(page);
        }
      },
      cost: 1,
      category: 'navigation',
    },

    // ── System ────────────────────────────────────────────────
    SET_PICK3: {
      id: 'SET_PICK3',
      label: 'Set the selected-for-today (Pick 3) objectives',
      precondition: () => true,
      effect: ({ ids }) => setSelectedForToday(ids),
      cost: 2,
      category: 'system',
    },

    COMPLETE_BRIEFING: {
      id: 'COMPLETE_BRIEFING',
      label: 'Complete the briefing program',
      precondition: () => true,
      effect: () => finishBriefing(),
      cost: 3,
      category: 'system',
    },

    GENERATE_PLAN: {
      id: 'GENERATE_PLAN',
      label: 'Generate a daily plan via NOVA',
      precondition: () => true,
      effect: () => generateNovaPlan(),
      cost: 5,
      category: 'system',
    },
  };

  /**
   * Dispatch an action by ID.
   *
   * @param {string} actionId - The UPPER_SNAKE_CASE action identifier
   * @param {Object} params   - Parameters to pass to the action's effect
   * @param {Object} blackboard - The current Blackboard snapshot (for precondition checks)
   * @returns {{ success: boolean, error?: string }} Result of the dispatch
   */
  function dispatch(actionId, params = {}, blackboard = {}) {
    const action = actions[actionId];
    if (!action) {
      return { success: false, error: `Unknown action: ${actionId}` };
    }

    if (!action.precondition(blackboard, params)) {
      return { success: false, error: `Precondition failed for action: ${actionId}` };
    }

    try {
      action.effect(params);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Get all actions that pass their precondition given the current Blackboard.
   * Useful for building the "available actions" list for the LLM prompt.
   *
   * @param {Object} blackboard - The current Blackboard snapshot
   * @returns {Array<{ id: string, label: string, cost: number, category: string }>}
   */
  function getAvailableActions(blackboard = {}) {
    return Object.values(actions)
      .filter(action => action.precondition(blackboard, {}))
      .map(({ id, label, cost, category }) => ({ id, label, cost, category }));
  }

  return {
    actions,
    dispatch,
    getAvailableActions,
  };
}
