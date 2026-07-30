import { withRetry, NovaRetryError, getRetryAfter, shouldAbortRetry } from './retry.js';

/**
 * @typedef {Object} ApiKeyValidationResult
 * @property {boolean} valid - Whether the key passes validation
 * @property {string|null} reason - Human-readable failure reason, null if valid
 * @property {'missing'|'format'|'ok'} code - Machine-readable status code
 */

/**
 * Validate an API key format and presence.
 * Does NOT make network requests — purely client-side format validation.
 *
 * Supports:
 *   - OpenRouter keys: sk-or-v1-<64 hex chars>
 *   - Generic keys: sk-<alphanumeric, 32+ chars>
 * @param {string|null|undefined} key
 * @returns {ApiKeyValidationResult}
 */
export function validateApiKey(key) {
  // 1. Missing / empty / undefined check
  if (!key || typeof key !== 'string' || !key.trim()) {
    return {
      valid: false,
      reason: 'API key is required. Please enter your API key in Settings.',
      code: 'missing',
    };
  }

  const trimmed = key.trim();

  // 2. Format validation: accept OpenRouter (sk-or-v1-*) OR generic DeepSeek (sk-*) key formats
  const OPENROUTER_KEY_PATTERN = /^sk-or-v1-[0-9a-f]{64}$/;
  const GENERIC_KEY_PATTERN = /^sk-[a-zA-Z0-9]{32,}$/;
  const DEEPSEEK_KEY_PATTERN = /^sk-[a-f0-9]{32}$/;
  if (!OPENROUTER_KEY_PATTERN.test(trimmed) && !GENERIC_KEY_PATTERN.test(trimmed) && !DEEPSEEK_KEY_PATTERN.test(trimmed)) {
    // Provide specific guidance based on what's wrong
    if (!trimmed.startsWith('sk-')) {
      return {
        valid: false,
        reason: 'Invalid key format. API keys start with "sk-". Please check your key.',
        code: 'format',
      };
    }
    if (trimmed.length < 20) {
      return {
        valid: false,
        reason: 'API key is too short. Keys are typically 64+ characters long.',
        code: 'format',
      };
    }
    return {
      valid: false,
      reason: 'API key format is invalid. Expected format: sk- followed by alphanumeric characters.',
      code: 'format',
    };
  }

  // 3. Passed all checks
  return { valid: true, reason: null, code: 'ok' };
}

/**
 * Validate the API key and throw a NovaRetryError if invalid.
 * Called at the start of askAI() and chatWithNOVA() to prevent wasted requests.
 * @param {string|null|undefined} apiKey
 * @throws {NovaRetryError} If the key is missing or invalid
 */
function validateApiKeyOrThrow(apiKey) {
  const result = validateApiKey(apiKey);
  if (!result.valid) {
    throw new NovaRetryError(result.reason, {
      status: 0,
      retryable: false, // Don't retry — key won't become valid on retry
      userMessage: result.reason,
    });
  }
}

/**
 * Parse an API error response into a NovaRetryError.
 * @param {Response} response - fetch Response object
 * @returns {Promise<NovaRetryError>}
 */
async function parseApiError(response) {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  let retryAfter = getRetryAfter(response.headers);

  try {
    const body = await response.json();
    if (body?.error?.message) {
      errorMessage = body.error.message;
    }
  } catch {
    // Response body not JSON — use default message
  }

  const status = response.status;
  const retryable = !shouldAbortRetry(status);
  const userMessages = {
    429: 'Rate limit reached. Waiting before retrying...',
    500: 'API server error. Retrying...',
    502: 'API gateway error. Retrying...',
    503: 'API service temporarily unavailable. Retrying...',
    401: 'Authentication failed. Please check your API key in Settings.',
    403: 'Access denied. Please check your API key permissions.',
  };

  return new NovaRetryError(errorMessage, {
    status,
    retryable,
    userMessage: userMessages[status] || errorMessage,
    retryAfter,
  });
}

/**
 * Ask the AI a question via API with automatic retry.
 * Supports JSON schema mode for structured output.
 *
 * @param {string} systemPrompt - System instructions
 * @param {string} userMsg - User message
 * @param {string} apiKey - API key
 * @param {Object} [options]
 * @param {string} [options.model] - Model ID in OpenRouter format (e.g. "deepseek/deepseek-chat")
 * @param {Object|null} [options.schemaType] - Schema definition (triggers json_object mode)
 * @param {Object} [options.retryOptions] - passed through to withRetry
 * @returns {Promise<string>} response text
 */
export async function askAI(systemPrompt, userMsg, apiKey, options = {}) {
  // Pre-flight validation — prevents wasted API calls on invalid keys
  validateApiKeyOrThrow(apiKey);

  const { model, schemaType, retryOptions = {} } = options;

  const result = await withRetry(async (attempt) => {
    const response = await window.electronAPI?.queryAI({
      systemPrompt,
      userMsg,
      apiKey,
      model,
      schemaType: schemaType || null,
    });
    
    // electronAPI.queryAI returns the raw response string.
    // Check if it's an error string from the main process.
    if (typeof response === 'string' && response.startsWith('Error:')) {
      // Main process returned an error — parse it
      const msg = response.replace('Error: ', '');
      throw new NovaRetryError(msg, {
        status: 0,
        retryable: true,
        userMessage: msg,
      });
    }
    
    return response ?? '';
  }, {
    maxRetries: retryOptions.maxRetries ?? 5,
    baseDelayMs: retryOptions.baseDelayMs ?? 1000,
    maxDelayMs: retryOptions.maxDelayMs ?? 60000,
    ...retryOptions,
  });

  return result.data;
}

/**
 * Chat with NOVA via API with automatic retry.
 * Supports JSON schema mode for structured output.
 *
 * @param {Array} messages - array of {role, content} objects
 * @param {string} apiKey - API key
 * @param {Object} [options]
 * @param {string} [options.model] - Model ID in OpenRouter format (e.g. "deepseek/deepseek-chat")
 * @param {Object|null} [options.schemaType] - Schema definition (triggers json_object mode)
 * @param {Object} [options.retryOptions] - passed through to withRetry
 * @returns {Promise<string>} response text
 */
export async function chatWithNOVA(messages, apiKey, options = {}) {
  // Pre-flight validation — prevents wasted API calls on invalid keys
  validateApiKeyOrThrow(apiKey);

  const { model, schemaType, retryOptions = {} } = options;

  const result = await withRetry(async (attempt) => {
    const response = await window.electronAPI?.chatNOVA({
      messages,
      apiKey,
      model,
      schemaType: schemaType || null,
    });
    
    if (typeof response === 'string' && response.startsWith('Error:')) {
      const msg = response.replace('Error: ', '');
      throw new NovaRetryError(msg, {
        status: 0,
        retryable: true,
        userMessage: msg,
      });
    }
    
    return response ?? '';
  }, {
    maxRetries: retryOptions.maxRetries ?? 5,
    baseDelayMs: retryOptions.baseDelayMs ?? 1000,
    maxDelayMs: retryOptions.maxDelayMs ?? 60000,
    ...retryOptions,
  });

  return result.data;
}
