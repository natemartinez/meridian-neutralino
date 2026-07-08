/**
 * Tests for NOVA Action Utilities — novaActions.js
 *
 * Covers:
 *   - parseActionsFromResponse()
 *   - isActionUndoable()
 *   - buildUndoAction()
 *   - formatActionForDisplay()
 */
import { describe, it, expect } from 'vitest';
import {
  parseActionsFromResponse,
  isActionUndoable,
  buildUndoAction,
  formatActionForDisplay,
} from './novaActions.js';

// ──────────────────────────────────────────────
// parseActionsFromResponse
// ──────────────────────────────────────────────
describe('parseActionsFromResponse', () => {
  it('returns [] for null input', () => {
    expect(parseActionsFromResponse(null)).toEqual([]);
  });

  it('returns [] for undefined input', () => {
    expect(parseActionsFromResponse(undefined)).toEqual([]);
  });

  it('returns [] for non-string input (number)', () => {
    expect(parseActionsFromResponse(123)).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseActionsFromResponse('')).toEqual([]);
  });

  it('returns [] for plain text with no JSON', () => {
    expect(parseActionsFromResponse('Hello, this is NOVA.')).toEqual([]);
  });

  it('extracts actions from a ```json code block', () => {
    const text = `Some text here
\`\`\`json
{
  "content": "I've added a task.",
  "actions": [
    { "type": "ADD_ONWARD_ITEM", "params": { "title": "Review Q2", "estimatedMinutes": 30 } }
  ]
}
\`\`\`
more text`;
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('ADD_ONWARD_ITEM');
    expect(result[0].params.title).toBe('Review Q2');
  });

  it('extracts actions from a ``` block without json keyword', () => {
    const text = `\`\`\`
{
  "actions": [{ "type": "CREATE_GOAL", "params": { "title": "New Goal" } }]
}
\`\`\``;
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('CREATE_GOAL');
  });

  it('skips a ```json block that has no actions key', () => {
    const text = `\`\`\`json
{ "content": "Just a message" }
\`\`\``;
    expect(parseActionsFromResponse(text)).toEqual([]);
  });

  it('skips a ```json block with malformed JSON', () => {
    const text = '```json\n{ invalid json }\n```';
    expect(parseActionsFromResponse(text)).toEqual([]);
  });

  it('aggregates actions from multiple ```json blocks', () => {
    const text = `First block:
\`\`\`json
{ "actions": [{ "type": "ADD_ONWARD_ITEM", "params": {} }] }
\`\`\`
Second block:
\`\`\`json
{ "actions": [{ "type": "CREATE_GOAL", "params": {} }] }
\`\`\``;
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('ADD_ONWARD_ITEM');
    expect(result[1].type).toBe('CREATE_GOAL');
  });

  it('falls back to inline { "actions": [...] } when no code blocks found', () => {
    const text = 'NOVA response with inline { "actions": [{ "type": "TOGGLE_SUBTASK", "params": { "id": "abc" } }] }';
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('TOGGLE_SUBTASK');
    expect(result[0].params.id).toBe('abc');
  });

  it('handles inline JSON with nested objects in params', () => {
    const text = 'Here: { "actions": [{ "type": "ADD_ONWARD_ITEM", "params": { "title": "Task", "meta": { "source": "nova" } } }] }';
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].params.meta.source).toBe('nova');
  });

  it('filters out actions missing a type field', () => {
    const text = '```json\n{ "actions": [{ "type": "ADD_ONWARD_ITEM", "params": {} }, { "params": {} }, { "type": "CREATE_GOAL", "params": {} }] }\n```';
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('ADD_ONWARD_ITEM');
    expect(result[1].type).toBe('CREATE_GOAL');
  });

  it('filters out actions with non-string type', () => {
    const text = '```json\n{ "actions": [{ "type": "ADD_ONWARD_ITEM", "params": {} }, { "type": 123, "params": {} }] }\n```';
    const result = parseActionsFromResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('ADD_ONWARD_ITEM');
  });

  it('prefers ```json blocks over inline JSON when both exist', () => {
    const text = `\`\`\`json
{ "actions": [{ "type": "FROM_BLOCK", "params": {} }] }
\`\`\`
And inline: { "actions": [{ "type": "FROM_INLINE", "params": {} }] }`;
    const result = parseActionsFromResponse(text);
    // Should only return the block result since inline only triggers when actions.length === 0
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('FROM_BLOCK');
  });

  it('handles unmatched braces in inline mode gracefully', () => {
    // The bracket matcher will never find depth 0, so endIdx stays at startIdx
    // resulting in an empty slice that JSON.parse will reject
    const text = 'Here: { "actions": [{ "type": "TEST", "params": {} }] ';
    const result = parseActionsFromResponse(text);
    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// isActionUndoable
// ──────────────────────────────────────────────
describe('isActionUndoable', () => {
  it('returns true for ADD_ONWARD_ITEM', () => {
    expect(isActionUndoable('ADD_ONWARD_ITEM')).toBe(true);
  });

  it('returns true for CREATE_GOAL', () => {
    expect(isActionUndoable('CREATE_GOAL')).toBe(true);
  });

  it('returns true for TOGGLE_SUBTASK', () => {
    expect(isActionUndoable('TOGGLE_SUBTASK')).toBe(true);
  });

  it('returns true for TOGGLE_ONWARD_DONE', () => {
    expect(isActionUndoable('TOGGLE_ONWARD_DONE')).toBe(true);
  });

  it('returns false for unknown action type', () => {
    expect(isActionUndoable('DELETE_EVERYTHING')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isActionUndoable('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isActionUndoable(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isActionUndoable(undefined)).toBe(false);
  });
});

// ──────────────────────────────────────────────
// buildUndoAction
// ──────────────────────────────────────────────
describe('buildUndoAction', () => {
  it('returns null when action is null', () => {
    expect(buildUndoAction(null, { success: true })).toBeNull();
  });

  it('returns null when result is null', () => {
    expect(buildUndoAction({ type: 'ADD_ONWARD_ITEM', params: {} }, null)).toBeNull();
  });

  it('returns null when result.success is false', () => {
    expect(buildUndoAction(
      { type: 'ADD_ONWARD_ITEM', params: {} },
      { success: false, error: 'Failed' }
    )).toBeNull();
  });

  describe('ADD_ONWARD_ITEM', () => {
    it('returns DELETE_ONWARD_ITEM with createdId', () => {
      const result = buildUndoAction(
        { type: 'ADD_ONWARD_ITEM', params: { title: 'Test' } },
        { success: true, createdId: 'item-123' }
      );
      expect(result).toEqual({ type: 'DELETE_ONWARD_ITEM', params: { id: 'item-123' } });
    });

    it('returns null when createdId is missing', () => {
      const result = buildUndoAction(
        { type: 'ADD_ONWARD_ITEM', params: { title: 'Test' } },
        { success: true }
      );
      expect(result).toBeNull();
    });
  });

  describe('CREATE_GOAL', () => {
    it('returns DELETE_GOAL with createdId', () => {
      const result = buildUndoAction(
        { type: 'CREATE_GOAL', params: { title: 'New Goal' } },
        { success: true, createdId: 'goal-456' }
      );
      expect(result).toEqual({ type: 'DELETE_GOAL', params: { goalId: 'goal-456' } });
    });

    it('returns null when createdId is missing', () => {
      const result = buildUndoAction(
        { type: 'CREATE_GOAL', params: { title: 'New Goal' } },
        { success: true }
      );
      expect(result).toBeNull();
    });
  });

  describe('TOGGLE_SUBTASK', () => {
    it('returns TOGGLE_SUBTASK with same params (inverse toggle)', () => {
      const result = buildUndoAction(
        { type: 'TOGGLE_SUBTASK', params: { goalId: 'g1', subtaskId: 'st1' } },
        { success: true }
      );
      expect(result).toEqual({ type: 'TOGGLE_SUBTASK', params: { goalId: 'g1', subtaskId: 'st1' } });
    });
  });

  describe('TOGGLE_ONWARD_DONE', () => {
    it('returns TOGGLE_ONWARD_DONE with same params (inverse toggle)', () => {
      const result = buildUndoAction(
        { type: 'TOGGLE_ONWARD_DONE', params: { id: 'item-789' } },
        { success: true }
      );
      expect(result).toEqual({ type: 'TOGGLE_ONWARD_DONE', params: { id: 'item-789' } });
    });
  });

  it('returns null for unknown action type', () => {
    const result = buildUndoAction(
      { type: 'UNKNOWN_ACTION', params: {} },
      { success: true }
    );
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// formatActionForDisplay
// ──────────────────────────────────────────────
describe('formatActionForDisplay', () => {
  it('returns "Unknown action" for null', () => {
    expect(formatActionForDisplay(null)).toBe('Unknown action');
  });

  it('returns "Unknown action" for undefined', () => {
    expect(formatActionForDisplay(undefined)).toBe('Unknown action');
  });

  it('formats ADD_ONWARD_ITEM with title', () => {
    expect(formatActionForDisplay({ type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } }))
      .toBe('Add task: "Review Q2"');
  });

  it('formats ADD_ONWARD_ITEM without title (fallback)', () => {
    expect(formatActionForDisplay({ type: 'ADD_ONWARD_ITEM', params: {} }))
      .toBe('Add task: "untitled"');
  });

  it('formats CREATE_GOAL with title', () => {
    expect(formatActionForDisplay({ type: 'CREATE_GOAL', params: { title: 'Learn Rust' } }))
      .toBe('Create goal: "Learn Rust"');
  });

  it('formats CREATE_GOAL without title (fallback)', () => {
    expect(formatActionForDisplay({ type: 'CREATE_GOAL', params: {} }))
      .toBe('Create goal: "untitled"');
  });

  it('formats TOGGLE_SUBTASK', () => {
    expect(formatActionForDisplay({ type: 'TOGGLE_SUBTASK', params: {} }))
      .toBe('Toggle subtask completion');
  });

  it('formats TOGGLE_ONWARD_DONE', () => {
    expect(formatActionForDisplay({ type: 'TOGGLE_ONWARD_DONE', params: {} }))
      .toBe('Toggle task completion');
  });

  it('formats DELETE_GOAL with goalId', () => {
    expect(formatActionForDisplay({ type: 'DELETE_GOAL', params: { goalId: 'g-1' } }))
      .toBe('Delete goal: "g-1"');
  });

  it('formats DELETE_GOAL without goalId (fallback)', () => {
    expect(formatActionForDisplay({ type: 'DELETE_GOAL', params: {} }))
      .toBe('Delete goal: "unknown"');
  });

  it('formats COMPLETE_GOAL', () => {
    expect(formatActionForDisplay({ type: 'COMPLETE_GOAL', params: {} }))
      .toBe('Mark goal as completed');
  });

  it('formats RENAME_GOAL with newTitle', () => {
    expect(formatActionForDisplay({ type: 'RENAME_GOAL', params: { newTitle: 'Better Name' } }))
      .toBe('Rename goal to: "Better Name"');
  });

  it('formats RENAME_GOAL without newTitle (fallback)', () => {
    expect(formatActionForDisplay({ type: 'RENAME_GOAL', params: {} }))
      .toBe('Rename goal to: "untitled"');
  });

  it('formats START_FOCUS_SESSION', () => {
    expect(formatActionForDisplay({ type: 'START_FOCUS_SESSION', params: {} }))
      .toBe('Start focus session');
  });

  it('formats STOP_FOCUS_SESSION', () => {
    expect(formatActionForDisplay({ type: 'STOP_FOCUS_SESSION', params: {} }))
      .toBe('Stop focus session');
  });

  it('formats SET_PICK3', () => {
    expect(formatActionForDisplay({ type: 'SET_PICK3', params: {} }))
      .toBe("Set today's priorities");
  });

  it('formats ADD_KNOWLEDGE_ENTRY', () => {
    expect(formatActionForDisplay({ type: 'ADD_KNOWLEDGE_ENTRY', params: {} }))
      .toBe('Add knowledge entry');
  });

  it('formats NAVIGATE_TO with page', () => {
    expect(formatActionForDisplay({ type: 'NAVIGATE_TO', params: { page: 'focus' } }))
      .toBe('Navigate to focus');
  });

  it('formats NAVIGATE_TO with programId', () => {
    expect(formatActionForDisplay({ type: 'NAVIGATE_TO', params: { programId: 'briefing' } }))
      .toBe('Navigate to briefing');
  });

  it('formats NAVIGATE_TO without page or programId (fallback)', () => {
    expect(formatActionForDisplay({ type: 'NAVIGATE_TO', params: {} }))
      .toBe('Navigate to unknown');
  });

  it('falls back to "Execute: {type}" for unknown action types', () => {
    expect(formatActionForDisplay({ type: 'MY_CUSTOM_ACTION', params: {} }))
      .toBe('Execute: MY_CUSTOM_ACTION');
  });

  it('handles missing type field', () => {
    expect(formatActionForDisplay({ params: {} }))
      .toBe('Execute: undefined');
  });
});
