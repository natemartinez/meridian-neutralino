import { useState, useCallback } from 'react';
import { validateApiKey } from '../utils/api.js';

/**
 * @typedef {import('../utils/api.js').ApiKeyValidationResult} ApiKeyValidationResult
 */

/**
 * Hook for managing API key validation state.
 *
 * Provides:
 *  - validationResult: current validation state ({ valid, reason, code })
 *  - validate(key): run validation on a key, returns the result
 *  - clearValidation(): reset validation state to default
 *  - maskKey(key): return a masked version of the key for safe logging
 *
 * @returns {{
 *   validationResult: ApiKeyValidationResult,
 *   validate: (key: string|null|undefined) => ApiKeyValidationResult,
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

  /**
   * Validate an API key and update state.
   * Logs validation outcome without exposing the full key.
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
   * Reset validation state to default (missing).
   */
  const clearValidation = useCallback(() => {
    setValidationResult({ valid: false, reason: null, code: 'missing' });
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

  return { validationResult, validate, clearValidation, maskKey };
}
