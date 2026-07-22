/**
 * OpenRouter API Key Validation Module
 *
 * Provides robust, server-side validation of OpenRouter API keys with:
 *  - Format validation (sk-or-v1- prefix + 64 hex chars)
 *  - Authentication test via lightweight GET to OpenRouter /auth endpoint
 *  - Error code detection (401 unauthorized, 403 forbidden, 429 rate-limited)
 *  - Rate-limit handling with Retry-After header support
 *  - In-memory caching with configurable TTL
 *  - Secure logging (never exposes full key)
 *  - Fully async for non-blocking onboarding flows
 *
 * @module openRouterValidation
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** OpenRouter API base URL */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Endpoint used for lightweight auth verification */
const AUTH_ENDPOINT = '/auth';

/** Expected format for OpenRouter API keys */
const OPENROUTER_KEY_PATTERN = /^sk-or-v1-[0-9a-f]{64}$/;

/** Default cache TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum number of rate-limit retry attempts */
const MAX_RATE_LIMIT_RETRIES = 3;

/** Base delay for rate-limit backoff (in ms) */
const RATE_LIMIT_BASE_DELAY_MS = 1000;

/** Maximum delay for rate-limit backoff (in ms) */
const RATE_LIMIT_MAX_DELAY_MS = 30000;

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * @typedef {'valid'|'invalid_format'|'unauthorized'|'forbidden'|'rate_limited'|'server_error'|'network_error'} ValidationCode
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the key is valid and authorized
 * @property {ValidationCode} code - Machine-readable status code
 * @property {string|null} reason - Human-readable explanation, null if valid
 * @property {number|null} statusCode - HTTP status code from the API (if applicable)
 * @property {boolean} cached - Whether this result came from cache
 */

// ─── Cache ───────────────────────────────────────────────────────────────────

/**
 * In-memory cache for validation results.
 * Map<string, { result: ValidationResult, expiresAt: number }>
 * @type {Map<string, { result: ValidationResult, expiresAt: number }>}
 */
const validationCache = new Map();

/**
 * Retrieve a cached validation result if it hasn't expired.
 * @param {string} cacheKey - Deterministic key derived from the API key
 * @param {number} ttlMs - Cache TTL in milliseconds
 * @returns {ValidationResult|null} Cached result or null if not found/expired
 */
function getCachedResult(cacheKey, ttlMs) {
  const entry = validationCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    validationCache.delete(cacheKey);
    return null;
  }
  return entry.result;
}

/**
 * Store a validation result in the in-memory cache.
 * @param {string} cacheKey - Deterministic key derived from the API key
 * @param {ValidationResult} result - The result to cache
 * @param {number} ttlMs - Cache TTL in milliseconds
 */
function setCachedResult(cacheKey, result, ttlMs) {
  validationCache.set(cacheKey, {
    result,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clear all cached validation results.
 * Useful for testing or when the user explicitly wants to re-validate.
 */
export function clearValidationCache() {
  validationCache.clear();
}

/**
 * Remove a specific key from the validation cache.
 * @param {string} apiKey - The API key to remove from cache
 */
export function clearCachedKey(apiKey) {
  const cacheKey = deriveCacheKey(apiKey);
  validationCache.delete(cacheKey);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic cache key from an API key.
 * Uses a SHA-256-like approach (simple hash) to avoid storing the raw key.
 * In production, this could use the Web Crypto API's subtle.digest.
 *
 * @param {string} apiKey - The API key
 * @returns {string} Deterministic hash for cache lookup
 */
function deriveCacheKey(apiKey) {
  // Simple hash function — sufficient for cache key derivation
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return `or-v-${Math.abs(hash).toString(36)}`;
}

/**
 * Mask an API key for safe logging.
 * Shows first 8 chars + last 4 chars, masks the middle.
 * @param {string} key - The API key to mask
 * @returns {string} Masked key (e.g., "sk-or-v1...abcd")
 */
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '(empty)';
  const trimmed = key.trim();
  if (trimmed.length < 12) return trimmed.substring(0, 4) + '...';
  return trimmed.substring(0, 8) + '...' + trimmed.substring(trimmed.length - 4);
}

/**
 * Validate the format of an OpenRouter API key.
 * Checks for the `sk-or-v1-` prefix followed by exactly 64 hex characters.
 *
 * @param {string} key - The API key to validate
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateKeyFormat(key) {
  if (!key || typeof key !== 'string' || !key.trim()) {
    return {
      valid: false,
      reason: 'API key is required. Please enter your OpenRouter API key.',
    };
  }

  const trimmed = key.trim();

  if (!trimmed.startsWith('sk-or-v1-')) {
    return {
      valid: false,
      reason: 'Invalid key format. OpenRouter keys start with "sk-or-v1-". Please check your key.',
    };
  }

  if (!OPENROUTER_KEY_PATTERN.test(trimmed)) {
    // Determine specific issue for helpful messaging
    const afterPrefix = trimmed.slice(9); // After 'sk-or-v1-'
    if (afterPrefix.length !== 64) {
      return {
        valid: false,
        reason: `Invalid key length. Expected 64 hex characters after "sk-or-v1-", got ${afterPrefix.length}.`,
      };
    }
    return {
      valid: false,
      reason: 'Invalid key format. The key contains non-hexadecimal characters after "sk-or-v1-".',
    };
  }

  return { valid: true, reason: null };
}

/**
 * Compute exponential backoff delay with full jitter.
 * @param {number} attempt - Zero-based attempt number
 * @param {number} [baseMs=1000] - Base delay in ms
 * @param {number} [maxMs=30000] - Maximum delay in ms
 * @returns {number} Delay in milliseconds
 */
function computeBackoff(attempt, baseMs = RATE_LIMIT_BASE_DELAY_MS, maxMs = RATE_LIMIT_MAX_DELAY_MS) {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exponential * jitter);
}

/**
 * Parse the Retry-After header value.
 * @param {Headers} headers - Response headers
 * @returns {number|null} Seconds to wait, or null if not present
 */
function parseRetryAfter(headers) {
  const val = headers?.get?.('Retry-After');
  if (!val) return null;
  const seconds = parseInt(val, 10);
  if (!isNaN(seconds)) return seconds;
  // Handle HTTP-date format
  const date = new Date(val);
  if (!isNaN(date.getTime())) {
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
  }
  return null;
}

// ─── Core Validation ─────────────────────────────────────────────────────────

/**
 * Perform a lightweight authentication test against the OpenRouter API.
 * Makes a GET request to the /auth endpoint to verify the key is valid.
 *
 * Handles:
 *  - 200: Key is valid
 *  - 401: Unauthorized (key is invalid or revoked)
 *  - 403: Forbidden (key lacks permissions)
 *  - 429: Rate-limited (with optional Retry-After)
 *  - 5xx: Server errors (retryable)
 *  - Network errors
 *
 * @param {string} apiKey - The API key to test
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for timeout/cancellation
 * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
 * @returns {Promise<ValidationResult>}
 */
async function testAuthentication(apiKey, options = {}) {
  const { signal: externalSignal, timeoutMs = 10000 } = options;

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Combine external signal with timeout signal
  const signal = externalSignal
    ? combineAbortSignals(externalSignal, controller.signal)
    : controller.signal;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}${AUTH_ENDPOINT}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    const statusCode = response.status;

    switch (statusCode) {
      case 200: {
        return {
          valid: true,
          code: 'valid',
          reason: null,
          statusCode: 200,
          cached: false,
        };
      }

      case 401: {
        return {
          valid: false,
          code: 'unauthorized',
          reason: 'Authentication failed. Your API key is invalid or has been revoked. Please generate a new key at openrouter.ai/keys.',
          statusCode: 401,
          cached: false,
        };
      }

      case 403: {
        return {
          valid: false,
          code: 'forbidden',
          reason: 'Access denied. Your API key does not have the required permissions. Please check your key settings at openrouter.ai/keys.',
          statusCode: 403,
          cached: false,
        };
      }

      case 429: {
        const retryAfter = parseRetryAfter(response.headers);
        return {
          valid: false,
          code: 'rate_limited',
          reason: retryAfter
            ? `Rate limited. Please wait ${retryAfter} seconds before trying again.`
            : 'Rate limited. Too many requests. Please try again later.',
          statusCode: 429,
          cached: false,
        };
      }

      default: {
        if (statusCode >= 500) {
          return {
            valid: false,
            code: 'server_error',
            reason: `OpenRouter server error (${statusCode}). The service may be temporarily unavailable. Please try again later.`,
            statusCode,
            cached: false,
          };
        }
        // Unexpected status code
        return {
          valid: false,
          code: 'server_error',
          reason: `Unexpected response from OpenRouter (${statusCode}). Please try again.`,
          statusCode,
          cached: false,
        };
      }
    }
  } catch (error) {
    // Handle abort (timeout or user cancellation)
    if (error.name === 'AbortError') {
      return {
        valid: false,
        code: 'network_error',
        reason: 'Request timed out. Please check your internet connection and try again.',
        statusCode: null,
        cached: false,
      };
    }

    // Handle network errors (fetch failed, DNS, etc.)
    return {
      valid: false,
      code: 'network_error',
      reason: 'Could not reach OpenRouter servers. Please check your internet connection.',
      statusCode: null,
      cached: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Combine two AbortSignals into one.
 * If either signal is aborted, the combined signal is aborted.
 * @param {AbortSignal} s1
 * @param {AbortSignal} s2
 * @returns {AbortSignal}
 */
function combineAbortSignals(s1, s2) {
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  s1.addEventListener('abort', onAbort);
  s2.addEventListener('abort', onAbort);

  // Clean up listeners when the combined signal is aborted
  controller.signal.addEventListener('abort', () => {
    s1.removeEventListener('abort', onAbort);
    s2.removeEventListener('abort', onAbort);
  });

  return controller.signal;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate an OpenRouter API key with full server-side verification.
 *
 * Performs the following checks in order:
 *  1. Format validation (sk-or-v1- prefix + 64 hex chars)
 *  2. Cache lookup (returns cached result if valid and not expired)
 *  3. Authentication test (lightweight GET to OpenRouter /auth)
 *  4. Rate-limit handling with exponential backoff (up to 3 retries)
 *  5. Cache the result for configurable duration
 *
 * The key is NEVER exposed in logs — only a masked version is logged.
 *
 * @param {string} apiKey - The OpenRouter API key to validate
 * @param {object} [options]
 * @param {number} [options.cacheTtlMs=300000] - Cache TTL in milliseconds (default: 5 minutes)
 * @param {boolean} [options.bypassCache=false] - Force re-validation even if cached
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for cancellation
 * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
 * @returns {Promise<ValidationResult>}
 *
 * @example
 * // Basic usage
 * const result = await validateOpenRouterKey('sk-or-v1-abc...');
 * if (result.valid) {
 *   console.log('Key is valid!');
 * } else {
 *   console.error(result.reason);
 * }
 *
 * @example
 * // With custom cache TTL (30 seconds)
 * const result = await validateOpenRouterKey(key, { cacheTtlMs: 30000 });
 *
 * @example
 * // Bypass cache and force re-validation
 * const result = await validateOpenRouterKey(key, { bypassCache: true });
 */
export async function validateOpenRouterKey(apiKey, options = {}) {
  const {
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    bypassCache = false,
    signal,
    timeoutMs = 10000,
  } = options;

  // ── Step 1: Format validation ──────────────────────────────────────────
  const formatResult = validateKeyFormat(apiKey);
  if (!formatResult.valid) {
    const masked = maskApiKey(apiKey);
    console.warn(`[OpenRouterValidation] Format rejected: ${masked} — ${formatResult.reason}`);

    return {
      valid: false,
      code: 'invalid_format',
      reason: formatResult.reason,
      statusCode: null,
      cached: false,
    };
  }

  // ── Step 2: Cache lookup ───────────────────────────────────────────────
  if (!bypassCache) {
    const cacheKey = deriveCacheKey(apiKey);
    const cached = getCachedResult(cacheKey, cacheTtlMs);
    if (cached) {
      console.log('[OpenRouterValidation] Returning cached validation result');
      return { ...cached, cached: true };
    }
  }

  // ── Step 3: Authentication test with rate-limit retry ──────────────────
  let lastResult = null;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) {
      // Log retry attempt without exposing the key
      console.log(`[OpenRouterValidation] Retrying auth test (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1})`);
    }

    lastResult = await testAuthentication(apiKey, { signal, timeoutMs });

    // If rate-limited, wait and retry
    if (lastResult.code === 'rate_limited' && attempt < MAX_RATE_LIMIT_RETRIES) {
      const delayMs = computeBackoff(attempt);
      console.warn(`[OpenRouterValidation] Rate limited, waiting ${Math.round(delayMs / 1000)}s before retry`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      continue;
    }

    // For all other results (success, auth failure, server error, network error), stop retrying
    break;
  }

  // ── Step 4: Log result (masked) ────────────────────────────────────────
  const masked = maskApiKey(apiKey);
  if (lastResult.valid) {
    console.log(`[OpenRouterValidation] Key validated successfully: ${masked}`);
  } else {
    console.warn(`[OpenRouterValidation] Key rejected (${lastResult.code}): ${masked} — ${lastResult.reason}`);
  }

  // ── Step 5: Cache the result ───────────────────────────────────────────
  if (lastResult.valid || lastResult.code === 'unauthorized' || lastResult.code === 'forbidden') {
    // Cache definitive results (valid, unauthorized, forbidden)
    // Don't cache transient errors (rate_limited, server_error, network_error)
    const cacheKey = deriveCacheKey(apiKey);
    setCachedResult(cacheKey, lastResult, cacheTtlMs);
  }

  return lastResult;
}
