/**
 * NOVA JSON Response Schemas
 *
 * Dual-format schema definitions:
 *   - Plain JS objects (FORMAT_A) for lightweight app-layer validation
 *   - OpenRouter json_schema wrappers (FORMAT_B) for Strict Schema Mode
 *     in the API request body: response_format: { type: "json_schema", json_schema: {...} }
 *
 * Strict Schema Mode (strict: true) forces the provider to use constrained
 * token sampling at the hardware layer, eliminating validation failures.
 */

// ── Format A: Plain JS validation schemas ──

export const CHAT_SCHEMA = {
  content: { type: 'string', required: true },
  options: { type: 'array', items: { type: 'string' }, required: false, nullable: true },
  ready: { type: 'boolean', required: true },
};

export const PLAN_SCHEMA = {
  tasks: {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      props: {
        title: { type: 'string', required: true },
        goalId: { type: 'string', required: false, nullable: true },
        goalTitle: { type: 'string', required: false, nullable: true },
        estimatedMinutes: { type: 'number', required: true },
        complexity: { type: 'string', required: true, enum: ['low', 'medium', 'high'] },
        rationale: { type: 'string', required: true },
      },
    },
  },
};

export const INSIGHT_SCHEMA = {
  routine_update: { type: 'string', required: false, nullable: true },
  suggested_tasks: { type: 'array', items: { type: 'string' }, required: false, nullable: true },
  knowledge_entries: {
    type: 'array',
    required: false,
    nullable: true,
    items: {
      type: 'object',
      props: {
        cat: { type: 'string', required: true, enum: ['work', 'goals', 'prefs', 'context'] },
        text: { type: 'string', required: true },
        conf: { type: 'number', required: true },
      },
    },
  },
};

export const KNOWLEDGE_INFERENCE_SCHEMA = {
  entries: {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      props: {
        cat: { type: 'string', required: true, enum: ['work', 'goals', 'prefs', 'context'] },
        text: { type: 'string', required: true },
        conf: { type: 'number', required: true },
      },
    },
  },
};

export const WEEKLY_SCAN_SCHEMA = {
  assessment: { type: 'string', required: true },
};

// ── Format B: OpenRouter json_schema wrappers (for response_format) ──
// These match the OpenRouter API spec:
//   response_format: { type: "json_schema", json_schema: { name, strict, schema } }

export const CHAT_SCHEMA_OPENROUTER = {
  name: 'NovaChatResponse',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      options: { type: ['array', 'null'], items: { type: 'string' } },
      ready: { type: 'boolean' },
    },
    required: ['content', 'ready'],
    additionalProperties: false,
  },
};

export const PLAN_SCHEMA_OPENROUTER = {
  name: 'NovaPlanResponse',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            goalId: { type: ['string', 'null'] },
            goalTitle: { type: ['string', 'null'] },
            estimatedMinutes: { type: 'number' },
            complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
            rationale: { type: 'string' },
          },
          required: ['title', 'estimatedMinutes', 'complexity', 'rationale'],
          additionalProperties: false,
        },
      },
    },
    required: ['tasks'],
    additionalProperties: false,
  },
};

export const INSIGHT_SCHEMA_OPENROUTER = {
  name: 'NovaInsightResponse',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      routine_update: { type: ['string', 'null'] },
      suggested_tasks: { type: ['array', 'null'], items: { type: 'string' } },
      knowledge_entries: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          properties: {
            cat: { type: 'string', enum: ['work', 'goals', 'prefs', 'context'] },
            text: { type: 'string' },
            conf: { type: 'number' },
          },
          required: ['cat', 'text', 'conf'],
          additionalProperties: false,
        },
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export const KNOWLEDGE_INFERENCE_SCHEMA_OPENROUTER = {
  name: 'NovaKnowledgeInferenceResponse',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            cat: { type: 'string', enum: ['work', 'goals', 'prefs', 'context'] },
            text: { type: 'string' },
            conf: { type: 'number' },
          },
          required: ['cat', 'text', 'conf'],
          additionalProperties: false,
        },
      },
    },
    required: ['entries'],
    additionalProperties: false,
  },
};

export const WEEKLY_SCAN_SCHEMA_OPENROUTER = {
  name: 'NovaWeeklyScanResponse',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      assessment: { type: 'string' },
    },
    required: ['assessment'],
    additionalProperties: false,
  },
};

// ── Schema Registry ──
// Maps program IDs to their corresponding schemas for easy lookup.

export const PROGRAM_SCHEMA_MAP = {
  briefing: CHAT_SCHEMA_OPENROUTER,
  preview: CHAT_SCHEMA_OPENROUTER,
  calibration: CHAT_SCHEMA_OPENROUTER,
  focus: CHAT_SCHEMA_OPENROUTER,
  general: CHAT_SCHEMA_OPENROUTER,
};

export const PROGRAM_SCHEMA_PLAIN_MAP = {
  briefing: CHAT_SCHEMA,
  preview: CHAT_SCHEMA,
  calibration: CHAT_SCHEMA,
  focus: CHAT_SCHEMA,
  general: CHAT_SCHEMA,
};

// ── Validation Utility ──

/**
 * Validate a parsed JSON object against a plain schema definition.
 * Returns { valid: boolean, errors: string[] }
 *
 * @param {*} data - The parsed JSON data to validate
 * @param {Object} schema - A plain schema object (FORMAT_A)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgainstSchema(data, schema) {
  const errors = [];

  if (data === null || data === undefined) {
    return { valid: false, errors: ['Response is null or undefined'] };
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Response is not a JSON object'] };
  }

  for (const [key, def] of Object.entries(schema)) {
    const value = data[key];

    // Check required fields
    if (def.required && (value === undefined || value === null)) {
      if (!def.nullable) {
        errors.push(`Missing required field: "${key}"`);
      }
      continue;
    }

    // Skip undefined optional fields
    if (value === undefined) continue;

    // Check nullable
    if (value === null && def.nullable) continue;
    if (value === null && !def.nullable) {
      errors.push(`Field "${key}" is null but not nullable`);
      continue;
    }

    // Type check
    if (def.type === 'string' && typeof value !== 'string') {
      errors.push(`Field "${key}" should be a string, got ${typeof value}`);
    } else if (def.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field "${key}" should be a boolean, got ${typeof value}`);
    } else if (def.type === 'number' && typeof value !== 'number') {
      errors.push(`Field "${key}" should be a number, got ${typeof value}`);
    } else if (def.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`Field "${key}" should be an array, got ${typeof value}`);
      } else if (def.items) {
        validateArrayItems(value, def.items, key, errors);
      }
    } else if (def.type === 'object' && def.props) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`Field "${key}" should be an object`);
      } else {
        const nested = validateAgainstSchema(value, def.props);
        errors.push(...nested.errors.map(e => `${key}.${e}`));
      }
    }

    // Enum check
    if (def.enum && !def.enum.includes(value)) {
      errors.push(`Field "${key}" should be one of [${def.enum.join(', ')}], got "${value}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateArrayItems(arr, itemDef, parentKey, errors) {
  arr.forEach((item, index) => {
    if (itemDef.type === 'string' && typeof item !== 'string') {
      errors.push(`${parentKey}[${index}] should be a string, got ${typeof item}`);
    } else if (itemDef.type === 'object' && itemDef.props) {
      if (typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`${parentKey}[${index}] should be an object`);
      } else {
        const nested = validateAgainstSchema(item, itemDef.props);
        errors.push(...nested.errors.map(e => `${parentKey}[${index}].${e}`));
      }
    }
  });
}

/**
 * Get the OpenRouter json_schema wrapper for a given program ID.
 * Falls back to CHAT_SCHEMA_OPENROUTER for unknown programs.
 *
 * @param {string} programId
 * @returns {Object|null} The OpenRouter schema wrapper, or null if unknown
 */
export function getSchemaForProgram(programId) {
  return PROGRAM_SCHEMA_MAP[programId] || CHAT_SCHEMA_OPENROUTER;
}

/**
 * Get the plain validation schema for a given program ID.
 * Falls back to CHAT_SCHEMA for unknown programs.
 *
 * @param {string} programId
 * @returns {Object}
 */
export function getPlainSchemaForProgram(programId) {
  return PROGRAM_SCHEMA_PLAIN_MAP[programId] || CHAT_SCHEMA;
}
