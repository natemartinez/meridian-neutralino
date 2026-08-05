// src/utils/csp.test.js
// Evidence for Security Checklist #3 (CSP hardening):
//  - script-src must NOT contain 'unsafe-eval' (removed — codebase has no
//    eval/new Function/Function() sinks).
//  - script-src must NOT contain 'unsafe-inline' in the production source
//    index.html (Vite dev relaxes it only at serve-time via cspDev plugin).
//  - The production build output (dist/index.html) must be strict too.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function readIndex(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf-8');
}

// Extract the CSP meta tag content first so the explanatory HTML comment
// (which intentionally mentions the literal words 'unsafe-inline' /
// 'unsafe-eval') is never captured by the directive regexes below.
function cspMetaContent(html) {
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/i);
  return meta ? meta[1] : '';
}

function scriptSrcDirective(html) {
  const content = cspMetaContent(html);
  const match = content.match(/script-src\s+([^;]+);/);
  return match ? match[1] : '';
}

describe('CSP: script-src is strict (no unsafe-eval / no unsafe-inline)', () => {
  it('index.html source has no unsafe-eval in script-src', () => {
    const html = readIndex('index.html');
    expect(scriptSrcDirective(html)).not.toContain('unsafe-eval');
  });

  it('index.html source has no unsafe-inline in script-src', () => {
    const html = readIndex('index.html');
    expect(scriptSrcDirective(html)).not.toContain('unsafe-inline');
  });

  it('built dist/index.html has no unsafe-eval or unsafe-inline in script-src', () => {
    const distPath = path.join(ROOT, 'dist', 'index.html');
    if (!fs.existsSync(distPath)) {
      // Allow running tests before a build — skip gracefully.
      return;
    }
    const html = readIndex('dist/index.html');
    const src = scriptSrcDirective(html);
    expect(src).not.toContain('unsafe-eval');
    expect(src).not.toContain('unsafe-inline');
  });

  it('connect-src only allows the AI providers', () => {
    const html = readIndex('index.html');
    const content = cspMetaContent(html);
    const connectMatch = content.match(/connect-src\s+([^;]+);/);
    expect(connectMatch).toBeTruthy();
    expect(connectMatch[1]).toContain("'self'");
    expect(connectMatch[1]).toContain('https://openrouter.ai');
    // No wildcard / data: exfiltration targets
    expect(connectMatch[1]).not.toContain('*');
  });
});

// ── Evidence for Security Checklist #5 + #7 (doc/config checks) ──
// #5: better-sqlite3 is pinned to a supported (12.x) version in BOTH the
//     extension (the native module consumer) and the root workspace.
// #7: README ships the promised "Data & Privacy" section.

describe('Security checklist doc/config evidence', () => {
  it('#5 — extension pins better-sqlite3 to a supported 12.x version', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'extensions', 'meridian', 'package.json'), 'utf-8'),
    );
    expect(pkg.dependencies['better-sqlite3']).toMatch(/^12\./);
  });

  it('#5 — root workspace pins better-sqlite3 to a supported 12.x version', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'),
    );
    expect(pkg.dependencies['better-sqlite3']).toMatch(/^[\^~]?12\./);
  });

  it('#7 — README contains the Data & Privacy section', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
    expect(readme).toContain('## Data & Privacy');
    expect(readme).toContain('### What leaves your device');
    expect(readme).toContain('No telemetry');
  });
});
