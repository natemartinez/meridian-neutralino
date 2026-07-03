/**
 * Tests for novaChatFormat.js
 *
 * What we're testing:
 * - parseNOVAJSONResponse: extracts content from JSON-wrapped NOVA responses
 *   - Valid JSON with content field
 *   - Valid JSON without content field (fallback)
 *   - Invalid JSON (fallback to raw text)
 *   - Null/undefined/empty input
 * - parseNOVAMessage: existing text-to-segment parser (unchanged)
 * - parseInlineFormatting: existing inline formatting parser (unchanged)
 */

import { describe, it, expect } from 'vitest';
import { parseNOVAJSONResponse, parseNOVAMessage, parseInlineFormatting } from './novaChatFormat.js';

// ============================================================
// parseNOVAJSONResponse
// ============================================================
describe('parseNOVAJSONResponse', () => {
  it('extracts content from a valid JSON response', () => {
    const json = JSON.stringify({ content: 'Hello, world!', options: null, ready: false });
    expect(parseNOVAJSONResponse(json)).toBe('Hello, world!');
  });

  it('extracts content when options array is present', () => {
    const json = JSON.stringify({
      content: 'How are you?',
      options: ['Good', 'Okay', 'Struggling'],
      ready: false,
    });
    expect(parseNOVAJSONResponse(json)).toBe('How are you?');
  });

  it('returns raw text when JSON has no content field', () => {
    const json = JSON.stringify({ foo: 'bar' });
    expect(parseNOVAJSONResponse(json)).toBe(json);
  });

  it('returns raw text for non-JSON input (backward compatibility)', () => {
    const text = 'Hello, how are you?';
    expect(parseNOVAJSONResponse(text)).toBe(text);
  });

  it('returns raw text for markdown-formatted input', () => {
    const text = '**Hello**\n\nHow are you?';
    expect(parseNOVAJSONResponse(text)).toBe(text);
  });

  it('returns empty string for null/undefined input', () => {
    expect(parseNOVAJSONResponse(null)).toBe('');
    expect(parseNOVAJSONResponse(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(parseNOVAJSONResponse('')).toBe('');
  });

  it('handles JSON with ready=true', () => {
    const json = JSON.stringify({ content: 'All set!', options: null, ready: true });
    expect(parseNOVAJSONResponse(json)).toBe('All set!');
  });

  it('handles JSON with extra properties (additionalProperties ignored)', () => {
    const json = JSON.stringify({
      content: 'Main message',
      options: ['A', 'B'],
      ready: false,
      extra_field: 'should be ignored',
    });
    expect(parseNOVAJSONResponse(json)).toBe('Main message');
  });
});

// ============================================================
// parseNOVAMessage (existing — verify still works)
// ============================================================
describe('parseNOVAMessage', () => {
  it('returns empty array for empty input', () => {
    expect(parseNOVAMessage('')).toEqual([]);
    expect(parseNOVAMessage(null)).toEqual([]);
    expect(parseNOVAMessage(undefined)).toEqual([]);
  });

  it('parses a simple paragraph', () => {
    const result = parseNOVAMessage('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('paragraph');
    expect(result[0].content).toBe('Hello world');
  });

  it('parses bullet list', () => {
    const result = parseNOVAMessage('- Item 1\n- Item 2');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('bullet');
    expect(result[0].items).toEqual(['Item 1', 'Item 2']);
  });

  it('parses numbered list', () => {
    const result = parseNOVAMessage('1. First\n2. Second');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('numbered');
    expect(result[0].items).toEqual(['First', 'Second']);
  });

  it('parses divider', () => {
    const result = parseNOVAMessage('---');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('divider');
  });

  it('parses code block', () => {
    const result = parseNOVAMessage('```js\nconsole.log("hi");\n```');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].language).toBe('js');
    expect(result[0].content).toBe('console.log("hi");');
  });

  it('parses options block', () => {
    const result = parseNOVAMessage('[OPTIONS]\nOption A\nOption B\n[/OPTIONS]');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('options');
    expect(result[0].items).toEqual(['Option A', 'Option B']);
  });
});

// ============================================================
// parseInlineFormatting (existing — verify still works)
// ============================================================
describe('parseInlineFormatting', () => {
  it('returns single token for plain text', () => {
    const result = parseInlineFormatting('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: 'Hello world', bold: false });
  });

  it('parses bold segments', () => {
    const result = parseInlineFormatting('Hello **world**');
    // The function returns 2 tokens: "Hello " (plain) + "world" (bold)
    // No trailing empty token when bold is at the end
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Hello ', bold: false });
    expect(result[1]).toEqual({ text: 'world', bold: true });
  });

  it('returns empty token for null/undefined', () => {
    expect(parseInlineFormatting(null)).toEqual([{ text: '', bold: false }]);
    expect(parseInlineFormatting(undefined)).toEqual([{ text: '', bold: false }]);
  });
});
