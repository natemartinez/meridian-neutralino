/**
 * Tests for openRouterValidation.js
 *
 * What we're testing:
 * - validateKeyFormat: format validation (prefix, length, hex characters)
 * - maskApiKey: secure key masking for logs
 * - validateOpenRouterKey: full validation pipeline (format → cache → auth → cache)
 * - clearValidationCache / clearCachedKey: cache management
 * - Rate-limit retry behavior
 * - Error code detection (401, 403, 429, 5xx)
 * - Network error handling
 * - Cache TTL and bypass
 * - Security: key never exposed in logs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateKeyFormat,
  maskApiKey,
  validateOpenRouterKey,
  clearValidationCache,
  clearCachedKey,
} from './openRouterValidation.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a valid OpenRouter API key for testing */
function validKey() {
  return 'sk-or-v1-' + 'a'.repeat(64);
}

/** Generate a valid OpenRouter API key with different hex content */
function validKeyB() {
  return 'sk-or-v1-' + 'b'.repeat(64);
}

/** Create a mock fetch response */
function mockResponse(status, options = {}) {
  const { headers = new Map(), body = null } = options;
  return {
    status,
    headers: {
      get: (name) => headers.get(name) ?? null,
    },
    json: async () => (body ? JSON.parse(body) : {}),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// ============================================================
// validateKeyFormat
// ============================================================
describe('validateKeyFormat', () => {
  it('rejects null, undefined, and empty strings', () => {
    expect(validateKeyFormat(null).valid).toBe(false);
    expect(validateKeyFormat(undefined).valid).toBe(false);
    expect(validateKeyFormat('').valid).toBe(false);
    expect(validateKeyFormat('   ').valid).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(validateKeyFormat(123).valid).toBe(false);
    expect(validateKeyFormat({}).valid).toBe(false);
    expect(validateKeyFormat([]).valid).toBe(false);
  });

  it('rejects keys without sk-or-v1- prefix', () => {
    const result = validateKeyFormat('sk-abc123');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('start with "sk-or-v1-"');
  });

  it('rejects keys with wrong prefix (sk-or-v2-)', () => {
    const result = validateKeyFormat('sk-or-v2-' + 'a'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('start with "sk-or-v1-"');
  });

  it('rejects keys with incorrect length after prefix', () => {
    const result = validateKeyFormat('sk-or-v1-' + 'a'.repeat(63));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid key length');
    expect(result.reason).toContain('63');
  });

  it('rejects keys with non-hex characters after prefix', () => {
    const result = validateKeyFormat('sk-or-v1-' + 'a'.repeat(63) + 'z');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('non-hexadecimal');
  });

  it('rejects keys with uppercase hex characters', () => {
    // Pattern only allows lowercase [0-9a-f]
    const result = validateKeyFormat('sk-or-v1-' + 'A'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('non-hexadecimal');
  });

  it('accepts a valid OpenRouter key', () => {
    const result = validateKeyFormat(validKey());
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('accepts a key with mixed hex characters', () => {
    const hex = 'a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0bc';
    expect(hex.length).toBe(64);
    const key = 'sk-or-v1-' + hex;
    const result = validateKeyFormat(key);
    expect(result.valid).toBe(true);
  });

  it('trims whitespace before validation', () => {
    const result = validateKeyFormat('  ' + validKey() + '  ');
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// maskApiKey
// ============================================================
describe('maskApiKey', () => {
  it('returns "(empty)" for null/undefined/empty', () => {
    expect(maskApiKey(null)).toBe('(empty)');
    expect(maskApiKey(undefined)).toBe('(empty)');
    expect(maskApiKey('')).toBe('(empty)');
  });

  it('shows first 8 and last 4 characters for a full key', () => {
    const key = validKey();
    const masked = maskApiKey(key);
    expect(masked).toBe(key.substring(0, 8) + '...' + key.substring(key.length - 4));
  });

  it('handles short keys gracefully', () => {
    expect(maskApiKey('short')).toBe('shor...');
  });

  it('never exposes the full key', () => {
    const key = validKey();
    const masked = maskApiKey(key);
    // The middle portion should be replaced with '...'
    const middle = key.substring(8, key.length - 4);
    expect(masked).not.toContain(middle);
  });
});

// ============================================================
// validateOpenRouterKey — Full Validation Pipeline
// ============================================================
describe('validateOpenRouterKey', () => {
  beforeEach(() => {
    clearValidationCache();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearValidationCache();
  });

  // ── Format validation failures ──────────────────────────────

  it('returns invalid_format for a missing key', async () => {
    const result = await validateOpenRouterKey(null);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('invalid_format');
    expect(result.cached).toBe(false);
  });

  it('returns invalid_format for a key with wrong prefix', async () => {
    const result = await validateOpenRouterKey('sk-abc123');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('invalid_format');
  });

  it('returns invalid_format for a key with wrong length', async () => {
    const result = await validateOpenRouterKey('sk-or-v1-' + 'a'.repeat(10));
    expect(result.valid).toBe(false);
    expect(result.code).toBe('invalid_format');
  });

  // ── Successful authentication ───────────────────────────────

  it('returns valid when OpenRouter responds with 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(true);
    expect(result.code).toBe('valid');
    expect(result.statusCode).toBe(200);
    expect(result.cached).toBe(false);
  });

  it('makes request to the correct endpoint with Bearer token', async () => {
    const key = validKey();
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    await validateOpenRouterKey(key);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/auth',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${key}`,
        }),
      })
    );
  });

  // ── Authentication failures ─────────────────────────────────

  it('returns unauthorized for 401 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(401));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('unauthorized');
    expect(result.statusCode).toBe(401);
    expect(result.reason).toContain('invalid or has been revoked');
  });

  it('returns forbidden for 403 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(403));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('forbidden');
    expect(result.statusCode).toBe(403);
    expect(result.reason).toContain('permissions');
  });

  // ── Rate limiting ───────────────────────────────────────────

  it('returns rate_limited for 429 response', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(429));

    const promise = validateOpenRouterKey(validKey());
    // Fast-forward through all retry delays
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(30000);
    }

    const result = await promise;
    expect(result.valid).toBe(false);
    expect(result.code).toBe('rate_limited');
    expect(result.statusCode).toBe(429);

    vi.useRealTimers();
  });

  it('includes Retry-After duration in rate limit message', async () => {
    // Use vi.useFakeTimers to avoid real delays
    vi.useFakeTimers();
    const headers = new Map();
    headers.set('Retry-After', '30');
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(429, { headers }));

    // Start the validation (it will hang on setTimeout)
    const promise = validateOpenRouterKey(validKey());

    // Fast-forward through all retry delays
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(30000);
    }

    const result = await promise;
    expect(result.valid).toBe(false);
    expect(result.code).toBe('rate_limited');
    expect(result.reason).toContain('30 seconds');

    vi.useRealTimers();
  });

  it('retries on rate limit and succeeds on subsequent attempt', async () => {
    vi.useFakeTimers();
    const headers = new Map();
    headers.set('Retry-After', '1');
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(mockResponse(429, { headers }))
      .mockResolvedValueOnce(mockResponse(200));

    const promise = validateOpenRouterKey(validKey());
    // Fast-forward through the retry delay
    await vi.advanceTimersByTimeAsync(30000);

    const result = await promise;
    expect(result.valid).toBe(true);
    expect(result.code).toBe('valid');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('gives up on rate limit after max retries', async () => {
    vi.useFakeTimers();
    const headers = new Map();
    headers.set('Retry-After', '1');
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(429, { headers }));

    const promise = validateOpenRouterKey(validKey());

    // Fast-forward through all retry delays
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(30000);
    }

    const result = await promise;
    expect(result.valid).toBe(false);
    expect(result.code).toBe('rate_limited');
    // Initial attempt + MAX_RATE_LIMIT_RETRIES (3) retries = 4 calls
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  // ── Server errors ───────────────────────────────────────────

  it('returns server_error for 500 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(500));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('server_error');
    expect(result.statusCode).toBe(500);
  });

  it('returns server_error for 502 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(502));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('server_error');
    expect(result.statusCode).toBe(502);
  });

  it('returns server_error for 503 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(503));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('server_error');
    expect(result.statusCode).toBe(503);
  });

  // ── Network errors ──────────────────────────────────────────

  it('returns network_error when fetch throws (no internet)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('network_error');
    expect(result.reason).toContain('Could not reach OpenRouter');
  });

  it('returns network_error on request timeout', async () => {
    // Create an AbortError by aborting the controller
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const result = await validateOpenRouterKey(validKey(), { timeoutMs: 100 });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('network_error');
    expect(result.reason).toContain('timed out');
  });

  // ── Caching behavior ────────────────────────────────────────

  it('caches a valid result and returns cached on subsequent calls', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    // First call — should hit the API
    const result1 = await validateOpenRouterKey(validKey());
    expect(result1.valid).toBe(true);
    expect(result1.cached).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second call — should return cached result
    const result2 = await validateOpenRouterKey(validKey());
    expect(result2.valid).toBe(true);
    expect(result2.cached).toBe(true);
    // fetch should NOT have been called again
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('caches unauthorized result and returns cached on subsequent calls', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(401));

    const result1 = await validateOpenRouterKey(validKey());
    expect(result1.valid).toBe(false);
    expect(result1.code).toBe('unauthorized');
    expect(result1.cached).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const result2 = await validateOpenRouterKey(validKey());
    expect(result2.valid).toBe(false);
    expect(result2.code).toBe('unauthorized');
    expect(result2.cached).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache transient errors (rate_limited, server_error, network_error)', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(429));

    const promise1 = validateOpenRouterKey(validKey());
    // Fast-forward through all retry delays
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(30000);
    }
    const result1 = await promise1;
    expect(result1.code).toBe('rate_limited');

    // Second call — should NOT be cached, should hit API again
    const promise2 = validateOpenRouterKey(validKey());
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(30000);
    }
    const result2 = await promise2;
    expect(result2.code).toBe('rate_limited');

    // fetch was called 4 times for first call (1 initial + 3 retries)
    // and should be called again for second call
    expect(globalThis.fetch).toHaveBeenCalledTimes(8); // 4 + 4

    vi.useRealTimers();
  });

  it('bypasses cache when bypassCache option is true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    // First call — cache the result
    await validateOpenRouterKey(validKey());
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second call with bypassCache — should hit API again
    await validateOpenRouterKey(validKey(), { bypassCache: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('respects cache TTL and re-validates after expiry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    // Use a very short TTL (10ms)
    await validateOpenRouterKey(validKey(), { cacheTtlMs: 10 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    // Should hit API again since cache expired
    await validateOpenRouterKey(validKey(), { cacheTtlMs: 10 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('uses separate cache entries for different keys', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    const keyA = validKey();
    const keyB = validKeyB();

    await validateOpenRouterKey(keyA);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Different key — should hit API
    await validateOpenRouterKey(keyB);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // First key again — should be cached
    await validateOpenRouterKey(keyA);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // ── Cache management ────────────────────────────────────────

  it('clearValidationCache removes all cached entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    await validateOpenRouterKey(validKey());
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    clearValidationCache();

    // Should hit API again since cache was cleared
    await validateOpenRouterKey(validKey());
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('clearCachedKey removes a specific key from cache', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));

    const keyA = validKey();
    const keyB = validKeyB();

    await validateOpenRouterKey(keyA);
    await validateOpenRouterKey(keyB);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Clear only keyA
    clearCachedKey(keyA);

    // keyA should hit API again
    await validateOpenRouterKey(keyA);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    // keyB should still be cached
    await validateOpenRouterKey(keyB);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  // ── Security: key not exposed in logs ───────────────────────

  it('does not expose the full key in console logs on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));
    const key = validKey();

    await validateOpenRouterKey(key);

    // Check that console.log was called with masked key, not full key
    const logCalls = console.log.mock.calls;
    const allLogArgs = logCalls.map(args => args.join(' ')).join(' ');
    expect(allLogArgs).not.toContain(key);
    // Should contain masked version
    expect(allLogArgs).toContain(maskApiKey(key));
  });

  it('does not expose the full key in console warns on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(401));
    const key = validKey();

    await validateOpenRouterKey(key);

    const warnCalls = console.warn.mock.calls;
    const allWarnArgs = warnCalls.map(args => args.join(' ')).join(' ');
    expect(allWarnArgs).not.toContain(key);
    expect(allWarnArgs).toContain(maskApiKey(key));
  });

  it('does not expose the full key in console warns on format rejection', async () => {
    const key = 'sk-invalid';
    await validateOpenRouterKey(key);

    const warnCalls = console.warn.mock.calls;
    const allWarnArgs = warnCalls.map(args => args.join(' ')).join(' ');
    expect(allWarnArgs).not.toContain(key);
    expect(allWarnArgs).toContain(maskApiKey(key));
  });

  // ── AbortSignal support ─────────────────────────────────────

  it('supports external AbortSignal for cancellation', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    // Abort immediately
    controller.abort();

    const result = await validateOpenRouterKey(validKey(), { signal: controller.signal });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('network_error');
  });

  // ── Edge cases ──────────────────────────────────────────────

  it('handles unexpected status codes gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(418)); // I'm a teapot

    const result = await validateOpenRouterKey(validKey());
    expect(result.valid).toBe(false);
    expect(result.code).toBe('server_error');
    expect(result.statusCode).toBe(418);
  });

  it('handles concurrent validation of the same key without race conditions', async () => {
    // Both calls should hit the API (not cached yet), but both should succeed
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      // Simulate slight delay
      await new Promise(resolve => setTimeout(resolve, 5));
      return mockResponse(200);
    });

    const [result1, result2] = await Promise.all([
      validateOpenRouterKey(validKey()),
      validateOpenRouterKey(validKey()),
    ]);

    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
    // Both calls should have been made (first one caches, second may or may not hit API)
    // At minimum, at least one call was made
    expect(callCount).toBeGreaterThanOrEqual(1);
  });
});
