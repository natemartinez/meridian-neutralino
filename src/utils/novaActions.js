/**
 * NOVA Action Utilities — Parsing and undo support for NOVA-driven actions.
 *
 * NOVA can return structured action JSON within its response text.
 * These utilities extract and manage those actions.
 *
 * Action JSON format (embedded in NOVA response):
 * ```json
 * {
 *   "content": "I've added a task to review Q2 metrics.",
 *   "actions": [
 *     { "type": "ADD_ONWARD_ITEM", "params": { "title": "Review Q2 metrics", "estimatedMinutes": 30, "priority": "medium" } }
 *   ]
 * }
 * ```
 */

/**
 * Parse action JSON from a NOVA response text string.
 * Looks for ```json ... ``` blocks or inline { "actions": [...] } patterns.
 *
 * @param {string} responseText - The raw text response from NOVA
 * @returns {Array<{ type: string, params: Object }>} Array of parsed actions
 */
export function parseActionsFromResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') return [];

  const actions = [];

  // Try 1: Extract ```json ... ``` blocks
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = jsonBlockRegex.exec(responseText)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.actions && Array.isArray(parsed.actions)) {
        actions.push(...parsed.actions);
      }
    } catch {
      // Not valid JSON, skip this block
    }
  }

  // Try 2: If no JSON blocks found, look for inline { "actions": [...] }
  if (actions.length === 0) {
    const inlineRegex = /\{\s*"actions"\s*:\s*\[/;
    const inlineMatch = responseText.match(inlineRegex);
    if (inlineMatch) {
      // Find the matching closing bracket
      const startIdx = inlineMatch.index;
      let depth = 0;
      let endIdx = startIdx;
      for (let i = startIdx; i < responseText.length; i++) {
        if (responseText[i] === '{') depth++;
        else if (responseText[i] === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
      try {
        const sliced = responseText.slice(startIdx, endIdx);
        const parsed = JSON.parse(sliced);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          actions.push(...parsed.actions);
        }
      } catch {
        // Malformed inline JSON, ignore
      }
    }
  }

  // Validate each action has required fields
  return actions.filter(a => a && a.type && typeof a.type === 'string');
}

/**
 * Check if an action type supports undo.
 *
 * @param {string} actionType - The UPPER_SNAKE_CASE action identifier
 * @returns {boolean}
 */
export function isActionUndoable(actionType) {
  return ['ADD_ONWARD_ITEM', 'CREATE_GOAL', 'TOGGLE_SUBTASK', 'TOGGLE_ONWARD_DONE'].includes(actionType);
}

/**
 * Build an undo action for a given action + result.
 * The undo action reverses the effect of the original action.
 *
 * @param {Object} action - The original action { type, params }
 * @param {Object} result - The result from actionRegistry.dispatch() { success, createdId?, ... }
 * @returns {Object|null} Undo action { type, params } or null if not undoable
 */
export function buildUndoAction(action, result) {
  if (!action || !result || !result.success) return null;

  switch (action.type) {
    case 'ADD_ONWARD_ITEM':
      // Undo by deleting the created onward item
      if (result.createdId) {
        return { type: 'DELETE_ONWARD_ITEM', params: { id: result.createdId } };
      }
      return null;

    case 'CREATE_GOAL':
      // Undo by deleting the created goal
      if (result.createdId) {
        return { type: 'DELETE_GOAL', params: { goalId: result.createdId } };
      }
      return null;

    case 'TOGGLE_SUBTASK':
      // Undo by toggling the same subtask again
      return { type: 'TOGGLE_SUBTASK', params: action.params };

    case 'TOGGLE_ONWARD_DONE':
      // Undo by toggling the same item again
      return { type: 'TOGGLE_ONWARD_DONE', params: action.params };

    default:
      return null;
  }
}

/**
 * Format an action for display in the chat confirmation UI.
 *
 * @param {Object} action - The action { type, params }
 * @returns {string} Human-readable description
 */
export function formatActionForDisplay(action) {
  if (!action) return 'Unknown action';

  const labels = {
    ADD_ONWARD_ITEM: `Add task: "${action.params?.title || 'untitled'}"`,
    CREATE_GOAL: `Create goal: "${action.params?.title || 'untitled'}"`,
    TOGGLE_SUBTASK: 'Toggle subtask completion',
    TOGGLE_ONWARD_DONE: 'Toggle task completion',
    DELETE_GOAL: `Delete goal: "${action.params?.goalId || 'unknown'}"`,
    COMPLETE_GOAL: 'Mark goal as completed',
    RENAME_GOAL: `Rename goal to: "${action.params?.newTitle || 'untitled'}"`,
    START_FOCUS_SESSION: 'Start focus session',
    STOP_FOCUS_SESSION: 'Stop focus session',
    SET_PICK3: 'Set today\'s priorities',
    ADD_KNOWLEDGE_ENTRY: 'Add knowledge entry',
    NAVIGATE_TO: `Navigate to ${action.params?.page || action.params?.programId || 'unknown'}`,
  };

  return labels[action.type] || `Execute: ${action.type}`;
}
