/**
 * Tests for nova-schemas.js
 *
 * What we're testing:
 * - validateAgainstSchema: lightweight app-layer JSON validation
 *   - Required field checks
 *   - Type checks (string, boolean, number, array, object)
 *   - Nullable field handling
 *   - Enum validation
 *   - Nested object validation
 *   - Array item validation
 * - getSchemaForProgram: schema lookup by program ID
 * - getPlainSchemaForProgram: plain schema lookup by program ID
 */

import { describe, it, expect } from 'vitest';
import {
  CHAT_SCHEMA,
  PLAN_SCHEMA,
  INSIGHT_SCHEMA,
  KNOWLEDGE_INFERENCE_SCHEMA,
  WEEKLY_SCAN_SCHEMA,
  CHAT_SCHEMA_OPENROUTER,
  PLAN_SCHEMA_OPENROUTER,
  INSIGHT_SCHEMA_OPENROUTER,
  KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER,
  WEEKLY_SCAN_SCHEMA_OPENROUTER,
  validateAgainstSchema,
  getSchemaForProgram,
  getPlainSchemaForProgram,
} from './nova-schemas.js';

// ============================================================
// Schema Shape Verification
// ============================================================
describe('CHAT_SCHEMA_OPENROUTER', () => {
  it('has the expected OpenRouter json_schema shape', () => {
    expect(CHAT_SCHEMA_OPENROUTER).toHaveProperty('name', 'NovaChatResponse');
    expect(CHAT_SCHEMA_OPENROUTER).toHaveProperty('strict', true);
    expect(CHAT_SCHEMA_OPENROUTER.schema).toHaveProperty('type', 'object');
    expect(CHAT_SCHEMA_OPENROUTER.schema.required).toContain('content');
    expect(CHAT_SCHEMA_OPENROUTER.schema.required).toContain('ready');
    expect(CHAT_SCHEMA_OPENROUTER.schema).toHaveProperty('additionalProperties', false);
  });
});

describe('PLAN_SCHEMA_OPENROUTER', () => {
  it('has the expected OpenRouter json_schema shape', () => {
    expect(PLAN_SCHEMA_OPENROUTER).toHaveProperty('name', 'NovaPlanResponse');
    expect(PLAN_SCHEMA_OPENROUTER).toHaveProperty('strict', true);
    expect(PLAN_SCHEMA_OPENROUTER.schema.required).toContain('tasks');
    expect(PLAN_SCHEMA_OPENROUTER.schema.properties.tasks.type).toBe('array');
  });
});

describe('INSIGHT_SCHEMA_OPENROUTER', () => {
  it('has the expected OpenRouter json_schema shape', () => {
    expect(INSIGHT_SCHEMA_OPENROUTER).toHaveProperty('name', 'NovaInsightResponse');
    expect(INSIGHT_SCHEMA_OPENROUTER).toHaveProperty('strict', true);
    expect(INSIGHT_SCHEMA_OPENROUTER.schema.properties).toHaveProperty('routine_update');
    expect(INSIGHT_SCHEMA_OPENROUTER.schema.properties).toHaveProperty('suggested_tasks');
    expect(INSIGHT_SCHEMA_OPENROUTER.schema.properties).toHaveProperty('knowledge_entries');
  });
});

describe('KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER', () => {
  it('has the expected OpenRouter json_schema shape', () => {
    expect(KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER).toHaveProperty('name', 'NovaKnowledgeInferenceResponse');
    expect(KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER.schema.required).toContain('entries');
  });
});

describe('WEEKLY_SCAN_SCHEMA_OPENROUTER', () => {
  it('has the expected OpenRouter json_schema shape', () => {
    expect(WEEKLY_SCAN_SCHEMA_OPENROUTER).toHaveProperty('name', 'NovaWeeklyScanResponse');
    expect(WEEKLY_SCAN_SCHEMA_OPENROUTER.schema.required).toContain('assessment');
  });
});

// ============================================================
// validateAgainstSchema — CHAT_SCHEMA
// ============================================================
describe('validateAgainstSchema (CHAT_SCHEMA)', () => {
  it('accepts a valid chat response', () => {
    const data = { content: 'Hello!', options: ['Yes', 'No'], ready: false };
    const result = validateAgainstSchema(data, CHAT_SCHEMA);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a response with null options', () => {
    const data = { content: 'Hello!', options: null, ready: true };
    const result = validateAgainstSchema(data, CHAT_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('rejects missing required field "content"', () => {
    const data = { options: null, ready: false };
    const result = validateAgainstSchema(data, CHAT_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('content');
  });

  it('rejects missing required field "ready"', () => {
    const data = { content: 'Hello', options: null };
    const result = validateAgainstSchema(data, CHAT_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('ready');
  });

  it('rejects non-boolean ready field', () => {
    const data = { content: 'Hello', options: null, ready: 'yes' };
    const result = validateAgainstSchema(data, CHAT_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('ready');
  });

  it('rejects null/undefined input', () => {
    expect(validateAgainstSchema(null, CHAT_SCHEMA).valid).toBe(false);
    expect(validateAgainstSchema(undefined, CHAT_SCHEMA).valid).toBe(false);
  });

  it('rejects non-object input (array)', () => {
    expect(validateAgainstSchema([], CHAT_SCHEMA).valid).toBe(false);
  });

  it('rejects non-object input (string)', () => {
    expect(validateAgainstSchema('hello', CHAT_SCHEMA).valid).toBe(false);
  });
});

// ============================================================
// validateAgainstSchema — PLAN_SCHEMA
// ============================================================
describe('validateAgainstSchema (PLAN_SCHEMA)', () => {
  it('accepts a valid plan response', () => {
    const data = {
      tasks: [
        {
          title: 'Build login page',
          goalId: 'abc123',
          goalTitle: 'Finish frontend',
          estimatedMinutes: 60,
          complexity: 'medium',
          rationale: 'Core feature for MVP',
        },
      ],
    };
    const result = validateAgainstSchema(data, PLAN_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('accepts tasks with nullable goalId/goalTitle', () => {
    const data = {
      tasks: [
        {
          title: 'General task',
          goalId: null,
          goalTitle: null,
          estimatedMinutes: 30,
          complexity: 'low',
          rationale: 'Quick win',
        },
      ],
    };
    const result = validateAgainstSchema(data, PLAN_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('rejects missing tasks array', () => {
    const data = {};
    const result = validateAgainstSchema(data, PLAN_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('tasks');
  });

  it('rejects invalid complexity enum value', () => {
    const data = {
      tasks: [
        {
          title: 'Task',
          goalId: null,
          goalTitle: null,
          estimatedMinutes: 30,
          complexity: 'extreme',
          rationale: 'Test',
        },
      ],
    };
    const result = validateAgainstSchema(data, PLAN_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('complexity');
  });

  it('rejects missing title in task item', () => {
    const data = {
      tasks: [
        {
          estimatedMinutes: 30,
          complexity: 'low',
          rationale: 'Test',
        },
      ],
    };
    const result = validateAgainstSchema(data, PLAN_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('title');
  });
});

// ============================================================
// validateAgainstSchema — INSIGHT_SCHEMA
// ============================================================
describe('validateAgainstSchema (INSIGHT_SCHEMA)', () => {
  it('accepts a valid insight response with all fields', () => {
    const data = {
      routine_update: 'User prefers morning deep work',
      suggested_tasks: ['Review PRs', 'Write docs'],
      knowledge_entries: [
        { cat: 'work', text: 'User is a morning person', conf: 0.9 },
      ],
    };
    const result = validateAgainstSchema(data, INSIGHT_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('accepts an empty insight response (all optional)', () => {
    const data = {};
    const result = validateAgainstSchema(data, INSIGHT_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid category in knowledge_entries', () => {
    const data = {
      knowledge_entries: [
        { cat: 'invalid', text: 'Something', conf: 0.5 },
      ],
    };
    const result = validateAgainstSchema(data, INSIGHT_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('cat');
  });
});

// ============================================================
// validateAgainstSchema — KNOWLEDGE_INFERENCE_SCHEMA
// ============================================================
describe('validateAgainstSchema (KNOWLEDGE_INFERENCE_SCHEMA)', () => {
  it('accepts a valid knowledge inference response', () => {
    const data = {
      entries: [
        { cat: 'prefs', text: 'User prefers VS Code', conf: 0.8 },
      ],
    };
    const result = validateAgainstSchema(data, KNOWLEDGE_INFERENCE_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('rejects missing entries array', () => {
    const data = {};
    const result = validateAgainstSchema(data, KNOWLEDGE_INFERENCE_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('entries');
  });
});

// ============================================================
// validateAgainstSchema — WEEKLY_SCAN_SCHEMA
// ============================================================
describe('validateAgainstSchema (WEEKLY_SCAN_SCHEMA)', () => {
  it('accepts a valid weekly scan response', () => {
    const data = { assessment: 'You are on track this week.' };
    const result = validateAgainstSchema(data, WEEKLY_SCAN_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('rejects missing assessment', () => {
    const data = {};
    const result = validateAgainstSchema(data, WEEKLY_SCAN_SCHEMA);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('assessment');
  });
});

// ============================================================
// getSchemaForProgram
// ============================================================
describe('getSchemaForProgram', () => {
  it('returns CHAT_SCHEMA_OPENROUTER for briefing', () => {
    expect(getSchemaForProgram('briefing')).toBe(CHAT_SCHEMA_OPENROUTER);
  });

  it('returns CHAT_SCHEMA_OPENROUTER for regroup', () => {
    expect(getSchemaForProgram('regroup')).toBe(CHAT_SCHEMA_OPENROUTER);
  });

  it('returns CHAT_SCHEMA_OPENROUTER for preview', () => {
    expect(getSchemaForProgram('preview')).toBe(CHAT_SCHEMA_OPENROUTER);
  });

  it('returns CHAT_SCHEMA_OPENROUTER for calibration', () => {
    expect(getSchemaForProgram('calibration')).toBe(CHAT_SCHEMA_OPENROUTER);
  });

  it('returns CHAT_SCHEMA_OPENROUTER for focus', () => {
    expect(getSchemaForProgram('focus')).toBe(CHAT_SCHEMA_OPENROUTER);
  });

  it('falls back to CHAT_SCHEMA_OPENROUTER for unknown programs', () => {
    expect(getSchemaForProgram('unknown')).toBe(CHAT_SCHEMA_OPENROUTER);
  });
});

// ============================================================
// getPlainSchemaForProgram
// ============================================================
describe('getPlainSchemaForProgram', () => {
  it('returns CHAT_SCHEMA for briefing', () => {
    expect(getPlainSchemaForProgram('briefing')).toBe(CHAT_SCHEMA);
  });

  it('falls back to CHAT_SCHEMA for unknown programs', () => {
    expect(getPlainSchemaForProgram('unknown')).toBe(CHAT_SCHEMA);
  });
});
