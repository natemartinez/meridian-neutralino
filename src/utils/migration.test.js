/**
 * Tests for migration.js — Goals → Paths taxonomy upgrade.
 *
 * What we're testing:
 * - migrateGoalCategories: assigns `category`, backfills `pathIds`,
 *   nulls out deadlines for open goals, removes deprecated `scale`
 * - Idempotency: safe to run repeatedly on the same data
 * - matchPathByTitle: best-effort title matching for pathIds backfill
 */

import { describe, it, expect } from 'vitest';
import { migrateGoalCategories, inferCategory, matchPathByTitle } from './migration.js';

// ============================================================
// inferCategory
// ============================================================
describe('inferCategory', () => {
  it('preserves an existing valid category', () => {
    expect(inferCategory({ category: 'open' })).toBe('open');
    expect(inferCategory({ category: 'long' })).toBe('long');
    expect(inferCategory({ category: 'short' })).toBe('short');
  });

  it('maps scale "short" → short', () => {
    expect(inferCategory({ scale: 'short' })).toBe('short');
  });

  it('maps scale "medium" and "long" → long', () => {
    expect(inferCategory({ scale: 'medium' })).toBe('long');
    expect(inferCategory({ scale: 'long' })).toBe('long');
  });

  it('falls back to open when no scale and no deadline', () => {
    expect(inferCategory({})).toBe('open');
  });

  it('falls back to long when no scale but a deadline exists', () => {
    expect(inferCategory({ deadline: '2026-09-01' })).toBe('long');
  });
});

// ============================================================
// matchPathByTitle
// ============================================================
describe('matchPathByTitle', () => {
  const paths = [
    { id: 'path-1', title: 'Frontend Mastery' },
    { id: 'path-2', title: 'Health & Wellness' },
  ];

  it('matches when the goal title contains the path title', () => {
    expect(matchPathByTitle('Frontend Mastery — Learn React', paths)).toBe('path-1');
  });

  it('matches when the path title contains the goal title', () => {
    expect(matchPathByTitle('Health', paths)).toBe('path-2');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(matchPathByTitle('  frontend mastery  ', paths)).toBe('path-1');
  });

  it('returns null when there is no title overlap', () => {
    expect(matchPathByTitle('Launch a startup', paths)).toBeNull();
  });

  it('guards against trivial short-title collisions', () => {
    // "A" and "B" are too short to match reliably
    expect(matchPathByTitle('A', [{ id: 'x', title: 'B' }])).toBeNull();
  });

  it('returns null for empty paths or title', () => {
    expect(matchPathByTitle('', paths)).toBeNull();
    expect(matchPathByTitle('Anything', [])).toBeNull();
  });
});

// ============================================================
// migrateGoalCategories
// ============================================================
describe('migrateGoalCategories', () => {
  const paths = [
    { id: 'path-1', title: 'Frontend Mastery' },
    { id: 'path-2', title: 'Health & Wellness' },
  ];

  it('maps scale "medium" → category "long"', () => {
    const result = migrateGoalCategories([{ id: 'g1', title: 'Ship App', scale: 'medium' }], paths);
    expect(result[0].category).toBe('long');
    expect(result[0]).not.toHaveProperty('scale');
  });

  it('maps missing scale + no deadline → "open" with deadline null', () => {
    const result = migrateGoalCategories([{ id: 'g1', title: 'Read More' }], paths);
    expect(result[0].category).toBe('open');
    expect(result[0].deadline).toBeNull();
  });

  it('backfills pathIds by title match', () => {
    const result = migrateGoalCategories([{ id: 'g1', title: 'Frontend Mastery — Learn React' }], paths);
    expect(result[0].pathIds).toEqual(['path-1']);
  });

  it('preserves existing pathIds (no overwrite)', () => {
    const result = migrateGoalCategories([{ id: 'g1', title: 'Unrelated', pathIds: ['path-2'] }], paths);
    expect(result[0].pathIds).toEqual(['path-2']);
  });

  it('removes the deprecated scale field', () => {
    const result = migrateGoalCategories([{ id: 'g1', title: 'Goal', scale: 'short' }], paths);
    expect(result[0]).not.toHaveProperty('scale');
  });

  it('is idempotent on the second run', () => {
    const input = [
      { id: 'g1', title: 'Frontend Mastery', scale: 'medium', deadline: '2026-12-01' },
      { id: 'g2', title: 'Orphan', deadline: null },
    ];
    const once = migrateGoalCategories(input, paths);
    const twice = migrateGoalCategories(once, paths);
    expect(twice).toEqual(once);
  });

  it('handles null/undefined projects', () => {
    expect(migrateGoalCategories(null, paths)).toEqual([]);
    expect(migrateGoalCategories(undefined, paths)).toEqual([]);
  });

  it('sets deadline null for open category even when a deadline existed', () => {
    const result = migrateGoalCategories([{ id: 'g1', title: 'Open Goal', category: 'open', deadline: '2026-09-01' }], paths);
    expect(result[0].category).toBe('open');
    expect(result[0].deadline).toBeNull();
  });
});
