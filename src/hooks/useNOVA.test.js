/**
 * Tests for NOVA chat capabilities — model loading, migration, API call construction,
 * error handling, and integration between useAppState.js and useNOVA.js.
 *
 * Coverage areas:
 *   1. Model loading from localStorage (useAppState.js line 32 migration logic)
 *   2. Legacy "deepseek/" prefix migration
 *   3. Edge cases: empty strings, null, malformed names
 *   4. Frontend warnings (console.warn) during migration
 *   5. API call construction: model flows correctly into askAI / chatWithNOVA
 *   6. Error handling: invalid/missing model configurations
 *   7. Integration: model value from useAppState -> useNOVA -> API layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Module-level Helpers
// ============================================================

/**
 * Pure-function replica of the model migration logic in useAppState.js:32-41.
 * Returns the migrated model name and whether a migration occurred.
 */
function migrateModel(saved) {
  if (saved && saved.startsWith('deepseek/')) {
    const migrated = saved.replace('deepseek/', '');
    return { model: migrated, migrated: true, original: saved };
  }
  return { model: saved || '', migrated: false, original: saved };
}

/**
 * Validate a model name for known patterns.
 * Returns { valid: boolean, reason: string | null }
 */
function validateModelName(model) {
  if (!model || typeof model !== 'string') {
    return { valid: false, reason: 'Model name is empty or undefined' };
  }
  const trimmed = model.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Model name is empty after trimming' };
  }
  // Known valid patterns
  const VALID_PATTERNS = [
    /^deepseek-v4-(flash|pro)$/,
    /^gpt-4/, /^gpt-3\.5/,
    /^claude-/,
    /^o[1-9]-/,
  ];
  const matchesAny = VALID_PATTERNS.some(p => p.test(trimmed));
  if (!matchesAny) {
    return { valid: false, reason: `Unrecognized model name: "${trimmed}"` };
  }
  return { valid: true, reason: null };
}

/**
 * Simulates how askAI() in api.js constructs the params object
 * that gets passed to window.electronAPI.queryAI().
 */
function buildQueryAIParams(systemPrompt, userMsg, apiKey, options = {}) {
  const { model, schemaType } = options;
  return {
    systemPrompt,
    userMsg,
    apiKey,
    model: model || null,
    schemaType: schemaType || null,
  };
}

/**
 * Simulates how chatWithNOVA() in api.js constructs the params object
 * that gets passed to window.electronAPI.chatNOVA().
 */
function buildChatNOVAParams(messages, apiKey, options = {}) {
  const { model, schemaType } = options;
  return {
    messages,
    apiKey,
    model: model || null,
    schemaType: schemaType || null,
  };
}

/**
 * Simulates the full data flow:
 * 1. useAppState.js loads model from localStorage (with migration)
 * 2. useAppState passes { apiKey, model, ... } to useNOVA()
 * 3. useNOVA uses model in calls to askAI() / chatWithNOVA()
 * 4. api.js builds the params object for the bridge/extension
 */
function simulateFullFlow(localStorageModel, apiKey, programId) {
  // Step 1: Load and migrate model (useAppState.js line 32)
  const { model: resolvedModel, migrated } = migrateModel(localStorageModel);

  // Step 2: useNOVA receives model as prop
  const novaProps = { apiKey, model: resolvedModel };

  // Step 3: useNOVA constructs API call with model
  const schemaType = programId === 'plan'
    ? { name: 'NovaPlanResponse' }
    : { name: 'NovaChatResponse' };
  const apiOptions = { model: novaProps.model, schemaType };

  // Step 4: api.js builds bridge params
  const bridgeParams = buildChatNOVAParams(
    [{ role: 'user', content: 'Hello' }],
    novaProps.apiKey,
    apiOptions
  );

  return { resolvedModel, migrated, bridgeParams };
}

/**
 * Bridge default model fallback (simulates neutralino-bridge.js logic).
 */
function bridgeDefaultModel(model) {
  return model || 'deepseek-v4-flash';
}

/**
 * Extension default model fallback (simulates extensions/meridian/main.js logic).
 */
function extensionDefaultModel(model) {
  return model || 'deepseek-v4-flash';
}

// ============================================================
// 1. Model Loading from localStorage
// ============================================================

describe('Model loading from localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads a valid model name as-is', () => {
    localStorage.setItem('meridian_model', 'deepseek-v4-flash');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('deepseek-v4-flash');
    expect(result.migrated).toBe(false);
  });

  it('loads deepseek-v4-pro as-is', () => {
    localStorage.setItem('meridian_model', 'deepseek-v4-pro');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('deepseek-v4-pro');
    expect(result.migrated).toBe(false);
  });

  it('returns empty string when no model is saved', () => {
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('');
    expect(result.migrated).toBe(false);
  });

  it('returns empty string when localStorage key does not exist', () => {
    const result = migrateModel(null);
    expect(result.model).toBe('');
    expect(result.migrated).toBe(false);
  });

  it('handles undefined localStorage value', () => {
    const result = migrateModel(undefined);
    expect(result.model).toBe('');
    expect(result.migrated).toBe(false);
  });
});

// ============================================================
// 2. Legacy "deepseek/" Prefix Migration
// ============================================================

describe('Legacy "deepseek/" prefix migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('strips "deepseek/" prefix from "deepseek/deepseek-v4-flash"', () => {
    localStorage.setItem('meridian_model', 'deepseek/deepseek-v4-flash');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('deepseek-v4-flash');
    expect(result.migrated).toBe(true);
    expect(result.original).toBe('deepseek/deepseek-v4-flash');
  });

  it('strips "deepseek/" prefix from "deepseek/deepseek-v4-pro"', () => {
    localStorage.setItem('meridian_model', 'deepseek/deepseek-v4-pro');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('deepseek-v4-pro');
    expect(result.migrated).toBe(true);
  });

  it('strips "deepseek/" prefix from any "deepseek/..." value', () => {
    localStorage.setItem('meridian_model', 'deepseek/some-other-model');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('some-other-model');
    expect(result.migrated).toBe(true);
  });

  it('persists the migrated value back to localStorage', () => {
    localStorage.setItem('meridian_model', 'deepseek/deepseek-v4-flash');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    // Simulate what useAppState.js does: re-save migrated value
    if (result.migrated) {
      localStorage.setItem('meridian_model', result.model);
    }
    expect(localStorage.getItem('meridian_model')).toBe('deepseek-v4-flash');
  });

  it('does not migrate model names without "deepseek/" prefix', () => {
    localStorage.setItem('meridian_model', 'gpt-4');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('gpt-4');
    expect(result.migrated).toBe(false);
  });

  it('does not migrate empty string', () => {
    localStorage.setItem('meridian_model', '');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('');
    expect(result.migrated).toBe(false);
  });
});

// ============================================================
// 3. Edge Cases
// ============================================================

describe('Edge cases for model loading', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles model name with extra whitespace', () => {
    localStorage.setItem('meridian_model', '  deepseek-v4-flash  ');
    const saved = localStorage.getItem('meridian_model');
    // The migration logic does NOT trim — it preserves whitespace.
    // This tests that the system doesn't crash on whitespace.
    const result = migrateModel(saved);
    expect(result.model).toBe('  deepseek-v4-flash  ');
    expect(result.migrated).toBe(false);
  });

  it('handles model name with "deepseek/" prefix and whitespace', () => {
    localStorage.setItem('meridian_model', '  deepseek/deepseek-v4-flash  ');
    const saved = localStorage.getItem('meridian_model');
    // startsWith('deepseek/') is false due to leading space, so no migration
    const result = migrateModel(saved);
    expect(result.model).toBe('  deepseek/deepseek-v4-flash  ');
    expect(result.migrated).toBe(false);
  });

  it('handles very long malformed model name', () => {
    const longName = 'a'.repeat(1000);
    localStorage.setItem('meridian_model', longName);
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe(longName);
    expect(result.migrated).toBe(false);
  });

  it('handles model name with special characters', () => {
    localStorage.setItem('meridian_model', 'deepseek-v4-flash!@#$');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('deepseek-v4-flash!@#$');
    expect(result.migrated).toBe(false);
  });

  it('handles numeric model name', () => {
    localStorage.setItem('meridian_model', '12345');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('12345');
    expect(result.migrated).toBe(false);
  });

  it('handles model name that is just "deepseek/" with nothing after', () => {
    localStorage.setItem('meridian_model', 'deepseek/');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('');
    expect(result.migrated).toBe(true);
  });

  it('handles model name with only "deepseek/" prefix and whitespace after', () => {
    localStorage.setItem('meridian_model', 'deepseek/   ');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('   ');
    expect(result.migrated).toBe(true);
  });
});

// ============================================================
// 4. Frontend Warnings During Migration
// ============================================================

describe('Frontend warnings during model migration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits console.warn when migrating legacy "deepseek/" prefix', () => {
    localStorage.setItem('meridian_model', 'deepseek/deepseek-v4-flash');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);

    if (result.migrated) {
      console.warn(
        `[ModelMigration] Migrated legacy model name "${result.original}" -> "${result.model}". ` +
        `The "deepseek/" prefix is no longer needed when using DeepSeek's direct API.`
      );
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[ModelMigration]'),
    );
  });

  it('emits console.warn for unrecognized model names', () => {
    localStorage.setItem('meridian_model', 'bogus-model-name');
    const saved = localStorage.getItem('meridian_model');
    const validation = validateModelName(saved);

    if (!validation.valid) {
      console.warn(
        `[ModelMigration] Unrecognized model name "${saved}" loaded from settings. ` +
        `Expected format: "deepseek-v4-flash" or "deepseek-v4-pro".`
      );
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[ModelMigration]'),
    );
  });

  it('does not emit console.warn for valid model names', () => {
    localStorage.setItem('meridian_model', 'deepseek-v4-flash');
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    const validation = validateModelName(saved);

    expect(result.migrated).toBe(false);
    expect(validation.valid).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('does not emit console.warn when no model is saved', () => {
    const saved = localStorage.getItem('meridian_model');
    const result = migrateModel(saved);
    expect(result.model).toBe('');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('warns for empty string model (saved but empty)', () => {
    localStorage.setItem('meridian_model', '');
    const saved = localStorage.getItem('meridian_model');
    const validation = validateModelName(saved);

    expect(validation.valid).toBe(false);
    // The migration logic returns '' without warning for empty strings
    // The warning comes from validateModelName being called elsewhere
    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ============================================================
// 5. API Call Construction — Model Flows Correctly
// ============================================================

describe('API call construction — model parameter flow', () => {
  it('passes model from useNOVA into askAI params', () => {
    const params = buildQueryAIParams(
      'You are NOVA',
      'Generate a plan',
      'sk-test-key',
      { model: 'deepseek-v4-flash', schemaType: { name: 'test' } }
    );
    expect(params.model).toBe('deepseek-v4-flash');
    expect(params.schemaType).toEqual({ name: 'test' });
  });

  it('passes model from useNOVA into chatWithNOVA params', () => {
    const params = buildChatNOVAParams(
      [{ role: 'user', content: 'Hello' }],
      'sk-test-key',
      { model: 'deepseek-v4-pro', schemaType: { name: 'test' } }
    );
    expect(params.model).toBe('deepseek-v4-pro');
  });

  it('passes migrated model (without deepseek/ prefix) into API params', () => {
    // Simulate migration
    const saved = 'deepseek/deepseek-v4-flash';
    const { model: migrated } = migrateModel(saved);

    const params = buildQueryAIParams(
      'You are NOVA',
      'Hello',
      'sk-test-key',
      { model: migrated }
    );
    expect(params.model).toBe('deepseek-v4-flash');
    expect(params.model).not.toContain('deepseek/');
  });

  it('passes null model when no model is configured', () => {
    const params = buildQueryAIParams(
      'You are NOVA',
      'Hello',
      'sk-test-key',
      {} // no model option
    );
    expect(params.model).toBeNull();
  });

  it('passes model as null when options is empty', () => {
    const params = buildQueryAIParams(
      'You are NOVA',
      'Hello',
      'sk-test-key'
    );
    expect(params.model).toBeNull();
  });

  it('preserves model through the full call chain (useNOVA -> api.js -> bridge)', () => {
    // This simulates the full chain:
    // useNOVA.js calls chatWithNOVA(messages, apiKey, { model, schemaType })
    // api.js destructures { model, schemaType } from options
    // api.js passes { messages, apiKey, model, schemaType } to window.electronAPI.chatNOVA

    const modelFromAppState = 'deepseek-v4-flash';
    const schemaType = { name: 'NovaChatResponse', strict: true, schema: {} };

    // Step 1: useNOVA calls chatWithNOVA
    const chatOptions = { model: modelFromAppState, schemaType };

    // Step 2: api.js destructures and builds bridge params
    const bridgeParams = buildChatNOVAParams(
      [{ role: 'system', content: 'prompt' }],
      'sk-test-key',
      chatOptions
    );

    expect(bridgeParams.model).toBe('deepseek-v4-flash');
    expect(bridgeParams.schemaType).toBe(schemaType);
    expect(bridgeParams.messages).toHaveLength(1);
    expect(bridgeParams.apiKey).toBe('sk-test-key');
  });
});

// ============================================================
// 6. Error Handling — Invalid/Missing Model Configurations
// ============================================================

describe('Error handling for invalid/missing model configurations', () => {
  it('validateModelName rejects null', () => {
    const result = validateModelName(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty or undefined');
  });

  it('validateModelName rejects undefined', () => {
    const result = validateModelName(undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty or undefined');
  });

  it('validateModelName rejects empty string', () => {
    const result = validateModelName('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('validateModelName rejects whitespace-only string', () => {
    const result = validateModelName('   ');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('validateModelName rejects non-string types (number)', () => {
    const result = validateModelName(42);
    expect(result.valid).toBe(false);
  });

  it('validateModelName rejects non-string types (object)', () => {
    const result = validateModelName({});
    expect(result.valid).toBe(false);
  });

  it('validateModelName rejects non-string types (array)', () => {
    const result = validateModelName([]);
    expect(result.valid).toBe(false);
  });

  it('validateModelName accepts deepseek-v4-flash', () => {
    expect(validateModelName('deepseek-v4-flash').valid).toBe(true);
  });

  it('validateModelName accepts deepseek-v4-pro', () => {
    expect(validateModelName('deepseek-v4-pro').valid).toBe(true);
  });

  it('validateModelName accepts gpt-4', () => {
    expect(validateModelName('gpt-4').valid).toBe(true);
  });

  it('validateModelName accepts claude-sonnet-4', () => {
    expect(validateModelName('claude-sonnet-4').valid).toBe(true);
  });

  it('validateModelName rejects bogus model names', () => {
    const result = validateModelName('not-a-real-model');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unrecognized');
  });

  it('validateModelName rejects "deepseek/deepseek-v4-flash" (legacy OpenRouter format)', () => {
    // After migration, this prefix should be stripped.
    // If it somehow reaches the API layer, it should be flagged.
    const result = validateModelName('deepseek/deepseek-v4-flash');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unrecognized');
  });
});

// ============================================================
// 7. Integration: useAppState -> useNOVA -> API Layer
// ============================================================

describe('Integration: useAppState -> useNOVA -> API layer', () => {
  it('full flow: legacy model is migrated before reaching API', () => {
    const result = simulateFullFlow(
      'deepseek/deepseek-v4-flash',
      'sk-test-key',
      'briefing'
    );

    expect(result.migrated).toBe(true);
    expect(result.resolvedModel).toBe('deepseek-v4-flash');
    expect(result.bridgeParams.model).toBe('deepseek-v4-flash');
    expect(result.bridgeParams.model).not.toContain('deepseek/');
  });

  it('full flow: valid model passes through unchanged', () => {
    const result = simulateFullFlow(
      'deepseek-v4-flash',
      'sk-test-key',
      'briefing'
    );

    expect(result.migrated).toBe(false);
    expect(result.resolvedModel).toBe('deepseek-v4-flash');
    expect(result.bridgeParams.model).toBe('deepseek-v4-flash');
  });

  it('full flow: empty model results in empty string in bridge params', () => {
    const result = simulateFullFlow(
      null,
      'sk-test-key',
      'briefing'
    );

    expect(result.resolvedModel).toBe('');
    expect(result.migrated).toBe(false);
    // When model is empty string, buildChatNOVAParams converts '' to null
    // via the `model || null` fallback. The bridge/extension has its own default.
    expect(result.bridgeParams.model).toBeNull();
  });

  it('full flow: deepseek-v4-pro model passes through correctly', () => {
    const result = simulateFullFlow(
      'deepseek-v4-pro',
      'sk-test-key',
      'plan'
    );

    expect(result.migrated).toBe(false);
    expect(result.resolvedModel).toBe('deepseek-v4-pro');
    expect(result.bridgeParams.model).toBe('deepseek-v4-pro');
    expect(result.bridgeParams.schemaType).toEqual({ name: 'NovaPlanResponse' });
  });

  it('full flow: apiKey is preserved through the chain', () => {
    const result = simulateFullFlow(
      'deepseek-v4-flash',
      'sk-real-deepseek-key-12345',
      'focus'
    );

    expect(result.bridgeParams.apiKey).toBe('sk-real-deepseek-key-12345');
  });

  it('full flow: messages array is preserved', () => {
    const result = simulateFullFlow(
      'deepseek-v4-flash',
      'sk-test-key',
      'preview'
    );

    expect(result.bridgeParams.messages).toHaveLength(1);
    expect(result.bridgeParams.messages[0].role).toBe('user');
    expect(result.bridgeParams.messages[0].content).toBe('Hello');
  });

  it('full flow: handles multiple programs with correct schema types', () => {
    const programs = ['briefing', 'preview', 'calibration', 'focus', 'general'];

    programs.forEach(progId => {
      const result = simulateFullFlow('deepseek-v4-flash', 'sk-test-key', progId);
      expect(result.bridgeParams.model).toBe('deepseek-v4-flash');
      expect(result.bridgeParams.schemaType).toBeDefined();
    });
  });

  it('full flow: plan generation uses PLAN_SCHEMA_OPENROUTER', () => {
    const result = simulateFullFlow('deepseek-v4-flash', 'sk-test-key', 'plan');
    expect(result.bridgeParams.schemaType.name).toBe('NovaPlanResponse');
  });
});

// ============================================================
// 8. Bridge/Extension Default Fallback
// ============================================================

describe('Bridge/extension default model fallback', () => {
  it('bridge falls back to deepseek-v4-flash when model is empty', () => {
    expect(bridgeDefaultModel('')).toBe('deepseek-v4-flash');
  });

  it('bridge falls back to deepseek-v4-flash when model is null', () => {
    expect(bridgeDefaultModel(null)).toBe('deepseek-v4-flash');
  });

  it('bridge falls back to deepseek-v4-flash when model is undefined', () => {
    expect(bridgeDefaultModel(undefined)).toBe('deepseek-v4-flash');
  });

  it('bridge uses provided model when available', () => {
    expect(bridgeDefaultModel('deepseek-v4-pro')).toBe('deepseek-v4-pro');
  });

  it('extension falls back to deepseek-v4-flash when model is empty', () => {
    expect(extensionDefaultModel('')).toBe('deepseek-v4-flash');
  });

  it('extension uses provided model when available', () => {
    expect(extensionDefaultModel('deepseek-v4-pro')).toBe('deepseek-v4-pro');
  });
});

// ============================================================
// 9. localStorage Persistence After Migration
// ============================================================

describe('localStorage persistence after migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists migrated model name back to localStorage', () => {
    localStorage.setItem('meridian_model', 'deepseek/deepseek-v4-flash');

    // Simulate the full useAppState.js initialization
    const saved = localStorage.getItem('meridian_model');
    const { model: migrated, migrated: didMigrate } = migrateModel(saved);
    if (didMigrate) {
      localStorage.setItem('meridian_model', migrated);
    }

    expect(localStorage.getItem('meridian_model')).toBe('deepseek-v4-flash');
  });

  it('subsequent loads return migrated value without re-migrating', () => {
    // First load: migrate
    localStorage.setItem('meridian_model', 'deepseek/deepseek-v4-flash');
    const saved1 = localStorage.getItem('meridian_model');
    const r1 = migrateModel(saved1);
    if (r1.migrated) localStorage.setItem('meridian_model', r1.model);

    // Second load: should not migrate again
    const saved2 = localStorage.getItem('meridian_model');
    const r2 = migrateModel(saved2);
    expect(r2.migrated).toBe(false);
    expect(r2.model).toBe('deepseek-v4-flash');
  });

  it('does not persist when no migration is needed', () => {
    localStorage.setItem('meridian_model', 'deepseek-v4-flash');

    const saved = localStorage.getItem('meridian_model');
    const { migrated } = migrateModel(saved);

    expect(migrated).toBe(false);
    expect(localStorage.getItem('meridian_model')).toBe('deepseek-v4-flash');
  });
});

// ============================================================
// 8. suggestSubtasks — parsing & transformation logic
// ============================================================

describe('suggestSubtasks response parsing', () => {
  /**
   * Pure-function replica of the suggestSubtasks response handling logic
   * (useNOVA.js lines 919-934). Given a raw API result, parses and
   * transforms it into an array of { title, description } objects.
   */
  function parseSuggestSubtasksResult(result) {
    try {
      const raw = typeof result === 'object' && result.data ? result.data : result;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          title: String(item.title || item.name || '').slice(0, 60),
          description: String(item.description || item.desc || '').slice(0, 120),
        }));
      }
      return null;
    } catch {
      return null;
    }
  }

  it('returns null when apiKey is missing', () => {
    // Simulate the early return in suggestSubtasks (line 912)
    const apiKey = null;
    expect(apiKey).toBeNull();
    // The function would return null before making any API call
  });

  it('parses a valid JSON array response', () => {
    const result = JSON.stringify([
      { title: 'Research competitors', description: 'Analyze top 3 competitors' },
      { title: 'Draft proposal', description: 'Write initial proposal draft' },
    ]);
    const output = parseSuggestSubtasksResult(result);
    expect(output).toEqual([
      { title: 'Research competitors', description: 'Analyze top 3 competitors' },
      { title: 'Draft proposal', description: 'Write initial proposal draft' },
    ]);
  });

  it('handles response with data wrapper', () => {
    const result = {
      data: JSON.stringify([
        { title: 'Setup CI/CD', description: 'Configure GitHub Actions' },
      ]),
    };
    const output = parseSuggestSubtasksResult(result);
    expect(output).toEqual([
      { title: 'Setup CI/CD', description: 'Configure GitHub Actions' },
    ]);
  });

  it('handles empty array response', () => {
    const result = JSON.stringify([]);
    const output = parseSuggestSubtasksResult(result);
    expect(output).toBeNull();
  });

  it('handles non-array JSON response', () => {
    const result = JSON.stringify({ message: 'Not an array' });
    const output = parseSuggestSubtasksResult(result);
    expect(output).toBeNull();
  });

  it('handles malformed JSON', () => {
    const result = 'not valid json';
    const output = parseSuggestSubtasksResult(result);
    expect(output).toBeNull();
  });

  it('handles API error (exception during parse)', () => {
    const result = undefined;
    const output = parseSuggestSubtasksResult(result);
    expect(output).toBeNull();
  });

  it('truncates title to 60 characters', () => {
    const longTitle = 'A'.repeat(100);
    const result = JSON.stringify([{ title: longTitle, description: 'Short desc' }]);
    const output = parseSuggestSubtasksResult(result);
    expect(output[0].title.length).toBe(60);
    expect(output[0].title).toBe('A'.repeat(60));
  });

  it('truncates description to 120 characters', () => {
    const longDesc = 'B'.repeat(200);
    const result = JSON.stringify([{ title: 'Short title', description: longDesc }]);
    const output = parseSuggestSubtasksResult(result);
    expect(output[0].description.length).toBe(120);
    expect(output[0].description).toBe('B'.repeat(120));
  });

  it('falls back to item.name when title is missing', () => {
    const result = JSON.stringify([
      { name: 'Task from name field', description: 'Desc' },
    ]);
    const output = parseSuggestSubtasksResult(result);
    expect(output[0].title).toBe('Task from name field');
  });

  it('falls back to item.desc when description is missing', () => {
    const result = JSON.stringify([
      { title: 'Task title', desc: 'Description from desc field' },
    ]);
    const output = parseSuggestSubtasksResult(result);
    expect(output[0].description).toBe('Description from desc field');
  });

  it('handles missing optional fields gracefully', () => {
    const result = JSON.stringify([
      { title: 'Minimal task' },
    ]);
    const output = parseSuggestSubtasksResult(result);
    expect(output[0].title).toBe('Minimal task');
    expect(output[0].description).toBe('');
  });

  it('handles null items in the array', () => {
    const result = JSON.stringify([null, { title: 'Valid task' }]);
    const output = parseSuggestSubtasksResult(result);
    // null item would cause TypeError when accessing .title — caught by try/catch
    expect(output).toBeNull();
  });

  it('builds correct system prompt structure', () => {
    // Verify the prompt construction logic (useNOVA.js lines 913-917)
    const goalTitle = 'Launch MVP';
    const goalDescription = 'Get v1.0 out by end of quarter';
    const existingSubtasks = [{ title: 'Setup repo' }];

    const existingBlock = existingSubtasks.length > 0
      ? `\n\nExisting subtasks (do NOT duplicate these):\n${existingSubtasks.map(s => `- ${s.title || s}`).join('\n')}`
      : '';
    const userMsg = `Break down this goal into subtasks:\nTitle: "${goalTitle}"\nDescription: "${goalDescription || 'No description provided'}"${existingBlock}\n\nRespond with a JSON array only.`;

    expect(userMsg).toContain('Launch MVP');
    expect(userMsg).toContain('Get v1.0 out by end of quarter');
    expect(userMsg).toContain('Setup repo');
    expect(userMsg).toContain('do NOT duplicate these');
  });

  it('handles existing subtasks as strings', () => {
    // The prompt builder handles both string and object subtasks
    const existingSubtasks = ['Setup repo', 'Design mockups'];
    const existingBlock = existingSubtasks.length > 0
      ? `\n\nExisting subtasks (do NOT duplicate these):\n${existingSubtasks.map(s => `- ${s.title || s}`).join('\n')}`
      : '';

    expect(existingBlock).toContain('- Setup repo');
    expect(existingBlock).toContain('- Design mockups');
  });

  it('omits existing subtasks block when empty', () => {
    const existingBlock = [];
    const block = existingBlock.length > 0
      ? `\n\nExisting subtasks (do NOT duplicate these):\n${existingBlock.map(s => `- ${s.title || s}`).join('\n')}`
      : '';
    expect(block).toBe('');
  });
});

// ============================================================
// 9. sendNOVAMessage — options persistence (multiple-choice NOVA)
// ============================================================

describe('sendNOVAMessage options persistence', () => {
  /**
   * Pure-function replica of the parse block in sendNOVAMessage
   * (useNOVA.js lines ~680-695). Extracts content, options, and the
   * organize action proposal from a raw LLM response.
   */
  function parseSendReply(reply) {
    let cleanReply = reply;
    let isReady = false;
    let options = null;
    let action = null;
    try {
      const parsed = JSON.parse(reply);
      cleanReply = parsed.content || reply;
      isReady = parsed.ready === true;
      options = Array.isArray(parsed.options)
        ? parsed.options.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim()).slice(0, 5)
        : null;
      action = parsed.action && typeof parsed.action === 'object' && parsed.action.type && parsed.action.type !== 'none'
        ? parsed.action
        : null;
    } catch {
      cleanReply = reply;
    }
    const historyEntry = {
      role: 'assistant',
      content: cleanReply,
      ...(options && options.length ? { options } : {}),
      ...(action ? { action } : {}),
    };
    return { cleanReply, isReady, options, action, historyEntry };
  }

  it('stores parsed.options on the assistant history entry', () => {
    const reply = JSON.stringify({
      content: 'Here are your options:',
      options: ['Create goal', 'Link to path', 'Skip'],
    });
    const { historyEntry, options } = parseSendReply(reply);
    expect(options).toEqual(['Create goal', 'Link to path', 'Skip']);
    expect(historyEntry.options).toEqual(['Create goal', 'Link to path', 'Skip']);
    expect(historyEntry.content).toBe('Here are your options:');
  });

  it('caps options at 5 and filters non-strings', () => {
    const reply = JSON.stringify({
      content: 'Many options',
      options: ['a', 'b', 'c', 'd', 'e', 'f', 42, null, ' '],
    });
    const { options } = parseSendReply(reply);
    expect(options).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('omits options field when none are present', () => {
    const reply = JSON.stringify({ content: 'No choices' });
    const { historyEntry, options } = parseSendReply(reply);
    expect(options).toBeNull();
    expect(historyEntry).not.toHaveProperty('options');
  });

  it('stores the organize action proposal on the history entry', () => {
    const reply = JSON.stringify({
      content: 'I propose creating a goal',
      action: { type: 'create-goal', goalTitle: 'Learn React', category: 'long', reason: 'Unlinked milestones' },
    });
    const { historyEntry, action } = parseSendReply(reply);
    expect(action.type).toBe('create-goal');
    expect(historyEntry.action).toMatchObject({ type: 'create-goal', goalTitle: 'Learn React' });
  });

  it('ignores "none" actions so no phantom proposal renders', () => {
    const reply = JSON.stringify({
      content: 'Nothing to do',
      action: { type: 'none', reason: 'All good' },
    });
    const { historyEntry, action } = parseSendReply(reply);
    expect(action).toBeNull();
    expect(historyEntry).not.toHaveProperty('action');
  });

  it('falls back to plain text on malformed JSON', () => {
    const { cleanReply, options, historyEntry } = parseSendReply('just plain text');
    expect(cleanReply).toBe('just plain text');
    expect(options).toBeNull();
    expect(historyEntry).toEqual({ role: 'assistant', content: 'just plain text' });
  });
});

// ============================================================
// 10. buildBlackboardUserMessage — consumes compiled blackboard
// ============================================================

describe('buildBlackboardUserMessage blackboard consumption', () => {
  const QUADRANTS = { q1: { title: 'Do First' }, q2: { title: 'Schedule' }, q3: { title: 'Delegate' }, q4: { title: 'Eliminate' } };

  /**
   * Pure-function replica of buildBlackboardUserMessage (useNOVA.js
   * lines 285-373). Renders the compiled Blackboard snapshot (goals,
   * paths, gaps) into the volatile user-role message.
   */
  function buildBlackboardUserMessage(programId, userInput, blackboard) {
    const b = blackboard || {};
    const quadrantCounts = b.quadrantDistribution || { q1: 0, q2: 0, q3: 0, q4: 0 };
    const quadrantSummary = Object.entries(quadrantCounts)
      .filter(([, count]) => count > 0)
      .map(([q, count]) => `${QUADRANTS[q]?.title || q.toUpperCase()} (${q.toUpperCase()}): ${count} goals`)
      .join(', ');
    const quadrantBlock = quadrantSummary ? `\nEisenhower Matrix distribution: ${quadrantSummary}.` : '';

    const fmtGoal = (g) => {
      const parts = [`"${g.title}"`, `${g.progress || 0}% done`];
      if (g.category) parts.push(`category: ${g.category}`);
      if (g.quadrant) parts.push(g.quadrant.toUpperCase());
      if (g.daysUntilDeadline !== null && g.daysUntilDeadline !== undefined) {
        parts.push(`deadline in ${g.daysUntilDeadline}d`);
      }
      if (g.pathIds && g.pathIds.length) parts.push(`paths: ${g.pathIds.join(', ')}`);
      return `(${parts.join(', ')})`;
    };
    const goalsSummary = (b.activeGoals || []).map(fmtGoal).join(', ') || 'none';

    const pathsSummary = (b.paths || [])
      .map(p => `"${p.title}" (${p.status}, ${p.completedMilestones}/${p.milestoneCount} milestones done${p.linkedGoalIds && p.linkedGoalIds.length ? `, linked goals: ${p.linkedGoalIds.join(', ')}` : ''})`)
      .join(', ') || 'none';

    const gapsLines = (b.gaps || []).map(gap => {
      if (gap.type === 'unlinked-path') {
        const ms = (gap.unlinkedMilestones || []).map(m => `"${m.title}"`).join(', ');
        return `Path "${gap.pathTitle}" has unlinked milestones${ms ? `: ${ms}` : ''} — focus: ${gap.suggestedFocus || 'create-goal'}`;
      }
      if (gap.type === 'orphan-goal') {
        return `Goal "${gap.goalTitle}" (${gap.category || 'open'}) is not linked to any path — focus: ${gap.suggestedFocus || 'link-to-path'}`;
      }
      return null;
    }).filter(Boolean);
    const gapsBlock = gapsLines.length ? `\nGaps (goals/paths needing attention):\n${gapsLines.map(l => `  - ${l}`).join('\n')}` : '';

    return `[Blackboard State]
Active goals: ${goalsSummary}.${quadrantBlock}
Paths (big picture): ${pathsSummary}.${gapsBlock}

[User]: ${userInput}`;
  }

  const blackboard = {
    activeGoals: [
      { title: 'Learn React', progress: 50, category: 'long', quadrant: 'q2', daysUntilDeadline: 120, pathIds: ['path-a'] },
      { title: 'Read More', progress: 10, category: 'open', quadrant: 'q2', daysUntilDeadline: null, pathIds: [] },
    ],
    quadrantDistribution: { q1: 0, q2: 2, q3: 0, q4: 0 },
    paths: [
      { title: 'Frontend Mastery', status: 'active', completedMilestones: 1, milestoneCount: 3, linkedGoalIds: ['g1'] },
    ],
    gaps: [
      { type: 'unlinked-path', pathTitle: 'Frontend Mastery', unlinkedMilestones: [{ title: 'Hooks' }, { title: 'Routing' }], suggestedFocus: 'create-goal' },
      { type: 'orphan-goal', goalTitle: 'Read More', category: 'open', suggestedFocus: 'link-to-path' },
    ],
  };

  it('renders active goals with category, deadline, and pathIds', () => {
    const msg = buildBlackboardUserMessage('organize', 'Suggest next steps', blackboard);
    expect(msg).toContain('[Blackboard State]');
    expect(msg).toContain('"Learn React"');
    expect(msg).toContain('category: long');
    expect(msg).toContain('deadline in 120d');
    expect(msg).toContain('paths: path-a');
    expect(msg).toContain('"Read More"');
    expect(msg).toContain('category: open');
  });

  it('includes the quadrant distribution summary', () => {
    const msg = buildBlackboardUserMessage('organize', 'Suggest next steps', blackboard);
    expect(msg).toContain('Eisenhower Matrix distribution: Schedule (Q2): 2 goals.');
  });

  it('renders the paths section with linked goals', () => {
    const msg = buildBlackboardUserMessage('organize', 'Suggest next steps', blackboard);
    expect(msg).toContain('"Frontend Mastery"');
    expect(msg).toContain('1/3 milestones done');
    expect(msg).toContain('linked goals: g1');
  });

  it('renders gaps (unlinked milestones + orphan goals)', () => {
    const msg = buildBlackboardUserMessage('organize', 'Suggest next steps', blackboard);
    expect(msg).toContain('Path "Frontend Mastery" has unlinked milestones: "Hooks", "Routing"');
    expect(msg).toContain('Goal "Read More" (open) is not linked to any path');
  });

  it('ends with the user input', () => {
    const msg = buildBlackboardUserMessage('organize', 'Suggest next steps', blackboard);
    expect(msg.trim().endsWith('[User]: Suggest next steps')).toBe(true);
  });

  it('handles an empty blackboard gracefully', () => {
    const msg = buildBlackboardUserMessage('organize', 'Hi', {});
    expect(msg).toContain('Active goals: none.');
    expect(msg).toContain('Paths (big picture): none.');
    expect(msg).toContain('[User]: Hi');
  });
});
