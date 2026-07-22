import { useState, useCallback, useRef } from 'react';
import { validateApiKey } from '../utils/api.js';
import { validateOpenRouterKey, clearCachedKey } from '../utils/openRouterValidation.js';

/**
 * @typedef {import('../utils/api.js').ApiKeyValidationResult} ApiKeyValidationResult
 */

/**
 * @typedef {Object} ServerValidationResult
 * @property {boolean} valid - Whether the key is valid
 * @property {'valid'|'invalid_format'|'unauthorized'|'forbidden'|'rate_limited'|'server_error'|'network_error'} code
 * @property {string|null} reason - Human-readable explanation
 * @property {number|null} statusCode - HTTP status code from the API
 * @property {boolean} cached - Whether result came from cache
 */

/**
 * Hook for managing API key validation state.
 *
 * Provides:
 *  - validationResult: current client-side validation state ({ valid, reason, code })
 *  - serverValidationResult: current server-side validation state (from OpenRouter API)
 *  - validate(key): run client-side format validation on a key
 *  - validateWithServer(key, options): run full server-side validation (format + auth test)
 *  - clearValidation(): reset all validation state to default
 *  - maskKey(key): return a masked version of the key for safe logging
 *
 * @returns {{
 *   validationResult: ApiKeyValidationResult,
 *   serverValidationResult: ServerValidationResult|null,
 *   isValidating: boolean,
 *   validate: (key: string|null|undefined) => ApiKeyValidationResult,
 *   validateWithServer: (key: string, options?: object) => Promise<ServerValidationResult>,
 *   clearValidation: () => void,
 *   maskKey: (key: string|null|undefined) => string,
 * }}
 */
export function useApiKeyValidation() {
  const [validationResult, setValidationResult] = useState({
    valid: false,
    reason: null,
    code: 'missing',
  });
  const [serverValidationResult, setServerValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const abortControllerRef = useRef(null);

  /**
   * Validate an API key format and update state.
   * Client-side only — does NOT make network requests.
   * @param {string|null|undefined} key
   * @returns {ApiKeyValidationResult}
   */
  const validate = useCallback((key) => {
    const result = validateApiKey(key);
    setValidationResult(result);

    // Log without exposing the full key
    if (!result.valid) {
      const prefix =
        key && typeof key === 'string'
          ? key.trim().substring(0, 8) + '...'
          : '(empty)';
      console.warn(
        `[ApiKeyValidation] Key rejected (${result.code}): ${prefix} — ${result.reason}`
      );
    } else {
      console.log('[ApiKeyValidation] Key format validation passed');
    }

    return result;
  }, []);

  /**
   * Validate an API key with full server-side verification.
   * Performs format check, then tests authentication against OpenRouter API.
   * Results are cached in memory for the configured TTL.
   *
   * @param {string} key - The API key to validate
   * @param {object} [options]
   * @param {number} [options.cacheTtlMs=300000] - Cache TTL in milliseconds
   * @param {boolean} [options.bypassCache=false] - Force re-validation
   * @param {number} [options.timeoutMs=10000] - Request timeout
   * @returns {Promise<ServerValidationResult>}
   */
  const validateWithServer = useCallback(async (key, options = {}) => {
    // Cancel any in-flight validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsValidating(true);

    try {
      const result = await validateOpenRouterKey(key, {
        ...options,
        signal: controller.signal,
      });

      // Map the server result to our state
      const mappedResult = {
        valid: result.valid,
        code: result.code,
        reason: result.reason,
        statusCode: result.statusCode,
        cached: result.cached,
      };

      setServerValidationResult(mappedResult);

      // Also update client-side validation state
      if (!result.valid && (result.code === 'invalid_format' || result.code === 'unauthorized' || result.code === 'forbidden')) {
        setValidationResult({
          valid: false,
          reason: result.reason,
          code: result.code === 'invalid_format' ? 'format' : result.code,
        });
      } else if (result.valid) {
        setValidationResult({ valid: true, reason: null, code: 'ok' });
      }

      return mappedResult;
    } finally {
      setIsValidating(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  /**
   * Reset validation state to default (missing).
   * Also clears the server-side validation cache for the given key.
   * @param {string} [apiKey] - Optional key to clear from cache
   */
  const clearValidation = useCallback((apiKey) => {
    setValidationResult({ valid: false, reason: null, code: 'missing' });
    setServerValidationResult(null);
    setIsValidating(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (apiKey) {
      clearCachedKey(apiKey);
    }
  }, []);

  /**
   * Return a masked version of the key for safe logging/display.
   * Shows first 8 chars + last 4 chars, masks the middle.
   * @param {string|null|undefined} key
   * @returns {string}
   */
  const maskKey = useCallback((key) => {
    if (!key || typeof key !== 'string') return '(empty)';
    const trimmed = key.trim();
    if (trimmed.length < 12) return trimmed.substring(0, 4) + '...';
    return trimmed.substring(0, 8) + '...' + trimmed.substring(trimmed.length - 4);
  }, []);

  return {
    validationResult,
    serverValidationResult,
    isValidating,
    validate,
    validateWithServer,
    clearValidation,
    maskKey,
  };
}
