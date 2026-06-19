import { withRetry, NovaRetryError, getRetryAfter, shouldAbortRetry } from './retry.js';

/**
 * @typedef {Object} ApiKeyValidationResult
 * @property {boolean} valid - Whether the key passes validation
 * @property {string|null} reason - Human-readable failure reason, null if valid
 * @property {'missing'|'format'|'ok'} code - Machine-readable status code
 */

/**
 * Validate an OpenRouter API key format and presence.
 * Does NOT make network requests — purely client-side format validation.
 *
 * OpenRouter keys follow the pattern: sk-or-v1-<64 hex chars>
 * @param {string|null|undefined} key
 * @returns {ApiKeyValidationResult}
 */
export function validateApiKey(key) {
  // 1. Missing / empty / undefined check
  if (!key || typeof key !== 'string' || !key.trim()) {
    return {
      valid: false,
      reason: 'API key is required. Please enter your OpenRouter API key.',
      code: 'missing',
    };
  }

  const trimmed = key.trim();

  // 2. Format validation: OpenRouter keys start with "sk-or-v1-" followed by 64 hex chars
  const OPENROUTER_KEY_PATTERN = /^sk-or-v1-[0-9a-f]{64}$/;
  if (!OPENROUTER_KEY_PATTERN.test(trimmed)) {
    // Provide specific guidance based on what's wrong
    if (!trimmed.startsWith('sk-or-v1-')) {
      return {
        valid: false,
        reason: 'Invalid key format. OpenRouter API keys start with "sk-or-v1-". Please check your key at openrouter.ai/keys.',
        code: 'format',
      };
    }
    if (trimmed.length < 20) {
      return {
        valid: false,
        reason: 'API key is too short. OpenRouter keys are typically 71 characters long (sk-or-v1- followed by 64 hex characters).',
        code: 'format',
      };
    }
    return {
      valid: false,
      reason: 'API key format is invalid. Expected format: sk-or-v1- followed by 64 hexadecimal characters.',
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
 * Parse an OpenRouter API error response into a NovaRetryError.
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
    500: 'OpenRouter server error. Retrying...',
    502: 'OpenRouter gateway error. Retrying...',
    503: 'OpenRouter service temporarily unavailable. Retrying...',
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
 * Call the OpenRouter API via Electron IPC with automatic retry.
 * @param {string} systemPrompt - system prompt text
 * @param {string} userMsg - user message text
 * @param {string} apiKey - OpenRouter API key
 * @param {Object} [retryOptions] - passed through to withRetry
 * @returns {Promise<string>} response text
 */
export async function askAI(systemPrompt, userMsg, apiKey, retryOptions = {}) {
  const result = await withRetry(async (attempt) => {
    const response = await window.electronAPI?.queryAI({ systemPrompt, userMsg, apiKey });
    
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
 * Chat with NOVA via OpenRouter API with automatic retry.
 * @param {Array} messages - array of {role, content} objects
 * @param {string} apiKey - OpenRouter API key
 * @param {Object} [retryOptions] - passed through to withRetry
 * @returns {Promise<string>} response text
 */
export async function chatWithNOVA(messages, apiKey, retryOptions = {}) {
  const result = await withRetry(async (attempt) => {
    const response = await window.electronAPI?.chatNOVA({ messages, apiKey });
    
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
