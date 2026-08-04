/**
 * Tests for sanitize.js
 *
 * What we're testing:
 * - sanitizeHTML: strips script tags, event handlers, javascript: URLs and
 *   forbidden tags while preserving safe formatting markup
 * - sanitizeText: strips HTML-like markup and control characters, trims and
 *   length-limits plain text (folder names, log titles)
 * - sanitizeWorkLogsState: deep-sanitizes the { folders, logs } store shape
 *   used by WorkLogsView on both write and read-back
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeText, sanitizeWorkLogsState } from './sanitize.js';

// ============================================================
// sanitizeHTML
// ============================================================
describe('sanitizeHTML', () => {
  it('returns an empty string for non-string input', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML(42)).toBe('');
    expect(sanitizeHTML({})).toBe('');
  });

  it('preserves safe formatting markup', () => {
    const html = '<p>Hello <strong>bold</strong> and <em>italic</em></p>';
    expect(sanitizeHTML(html)).toBe(html);
  });

  it('removes script tags', () => {
    const html = '<p>safe</p><script>alert("xss")</script>';
    expect(sanitizeHTML(html)).not.toContain('<script');
    expect(sanitizeHTML(html)).toContain('<p>safe</p>');
  });

  it('removes event handler attributes', () => {
    const html = '<p onclick="alert(1)" onerror="steal()">safe</p>';
    const out = sanitizeHTML(html);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onerror');
    expect(out).toContain('<p>safe</p>');
  });

  it('removes javascript: URLs in href/src', () => {
    const html = '<a href="javascript:alert(1)">link</a>';
    expect(sanitizeHTML(html)).not.toContain('javascript:');
  });

  it('removes forbidden tags like iframe, form and style', () => {
    const html = '<p>ok</p><iframe src="https://evil.example"></iframe><form><input></form><style>body{display:none}</style>';
    const out = sanitizeHTML(html);
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('form');
    expect(out).not.toContain('<style');
    expect(out).toContain('<p>ok</p>');
  });
});

// ============================================================
// sanitizeText
// ============================================================
describe('sanitizeText', () => {
  it('returns an empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(0)).toBe('');
    expect(sanitizeText(['a'])).toBe('');
  });

  it('strips HTML-like markup', () => {
    expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
    expect(sanitizeText('<b>bold</b> text')).toBe('bold text');
    expect(sanitizeText('<img src=x onerror=steal()>')).toBe('');
  });

  it('strips control characters', () => {
    expect(sanitizeText('a\x00b\x1Fc')).toBe('abc');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  padded  ')).toBe('padded');
  });

  it('respects the max length limit', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcde');
    expect(sanitizeText('short', 100)).toBe('short');
  });
});

// ============================================================
// sanitizeWorkLogsState
// ============================================================
describe('sanitizeWorkLogsState', () => {
  it('returns empty shape when called without arguments', () => {
    expect(sanitizeWorkLogsState()).toEqual({ folders: [], logs: {} });
  });

  it('sanitizes folder names', () => {
    const state = sanitizeWorkLogsState({
      folders: [
        { id: 1, name: 'My <script>Folder</script>' },
        { id: 2, name: '  Deep Work  ' },
      ],
    });
    expect(state.folders[0].name).toBe('My Folder');
    expect(state.folders[1].name).toBe('Deep Work');
  });

  it('drops non-array folders', () => {
    expect(sanitizeWorkLogsState({ folders: 'nope' }).folders).toEqual([]);
    expect(sanitizeWorkLogsState({ folders: null }).folders).toEqual([]);
  });

  it('sanitizes log titles and HTML content', () => {
    const state = sanitizeWorkLogsState({
      logs: {
        1: [
          {
            id: 11,
            title: '<img src=x onerror=alert(1)>Sprint',
            content: '<p>ok</p><script>evil()</script>',
          },
          { id: 12, title: null, content: 'plain' },
        ],
      },
    });
    expect(state.logs['1'][0].title).toBe('Sprint');
    expect(state.logs['1'][0].content).not.toContain('<script');
    expect(state.logs['1'][0].content).toContain('<p>ok</p>');
    // Non-string title falls back to a safe default
    expect(state.logs['1'][1].title).toBe('Untitled Log');
  });

  it('skips non-array log lists and preserves unrelated keys', () => {
    const state = sanitizeWorkLogsState({
      logs: {
        1: 'not-an-array',
        2: [{ id: 21, title: 'x', content: '<b>hi</b>' }],
      },
    });
    expect(state.logs['1']).toBeUndefined();
    expect(state.logs['2'][0].title).toBe('x');
    expect(state.logs['2'][0].content).toBe('<b>hi</b>');
  });
});
