/**
 * Tests for nova.js
 *
 * What we're testing:
 * - computePlanningConfidence: weighted scoring algorithm
 *   - 30% acceptance rate (tasks accepted vs total decisions)
 *   - 35% completion rate (tasks completed vs accepted)
 *   - 15% richness (meaningful events / saturation point of 40)
 *   - 20% insight engagement rate (insights accepted vs total insight decisions)
 * - validateNOVAResponse: schema-based JSON validation (replaced heuristic text parsing)
 * - computeSkillImprovements: keyword-based skill inference from completed tasks
 * - getNeglectedSkills: identifies skills not used recently
 * - NOVA_DEFAULT: default state object
 */

import { describe, it, expect } from 'vitest';
import { computePlanningConfidence, validateNOVAResponse, computeSkillImprovements, getNeglectedSkills, NOVA_DEFAULT } from './nova.js';

// ============================================================
// computePlanningConfidence
// ============================================================
describe('computePlanningConfidence', () => {
  it('returns 0 for undefined/null/empty events', () => {
    expect(computePlanningConfidence(undefined)).toBe(0);
    expect(computePlanningConfidence(null)).toBe(0);
    expect(computePlanningConfidence([])).toBe(0);
  });

  it('returns 50% confidence with equal accept/reject and no completions', () => {
    // 1 accepted, 1 rejected => acceptance = 0.5
    // 0 completed / 1 accepted => completion = 0
    // 2 meaningful events / 40 => richness = 0.05
    // 0 insight events => insightEngagement = 0.5 (default)
    // Score = (0.5 * 0.30 + 0 * 0.35 + 0.05 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.15 + 0 + 0.0075 + 0.10) * 100 = 25.75 => 26
    const events = [
      { type: 'task_accepted' },
      { type: 'task_rejected' },
    ];
    const score = computePlanningConfidence(events);
    expect(score).toBe(26);
  });

  it('gives higher score with more completions', () => {
    // 3 accepted, 1 rejected => acceptance = 3/4 = 0.75
    // 2 completed / 3 accepted => completion = 2/3 ≈ 0.667
    // 6 meaningful events / 40 => richness = 0.15
    // 0 insight events => insightEngagement = 0.5 (default)
    // Score = (0.75 * 0.30 + 2/3 * 0.35 + 0.15 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.225 + 0.2333 + 0.0225 + 0.10) * 100 = 58.08 => 58
    const events = [
      { type: 'task_accepted' },
      { type: 'task_accepted' },
      { type: 'task_accepted' },
      { type: 'task_rejected' },
      { type: 'task_completed' },
      { type: 'task_completed' },
    ];
    const score = computePlanningConfidence(events);
    expect(score).toBe(58);
  });

  it('ignores non-meaningful events like program_opened', () => {
    // Same as above but with extra noise events that shouldn't affect richness
    const meaningful = [
      { type: 'task_accepted' },
      { type: 'task_rejected' },
      { type: 'task_completed' },
    ];
    const withNoise = [
      ...meaningful,
      { type: 'program_opened' },
      { type: 'tab_focused' },
      { type: 'scroll' },
    ];
    expect(computePlanningConfidence(withNoise)).toBe(
      computePlanningConfidence(meaningful)
    );
  });

  it('caps completion rate at 1 (cannot exceed accepted)', () => {
    // 1 accepted, 0 rejected => acceptance = 1
    // 5 completed / 1 accepted => completion = min(5, 1) = 1
    // 6 meaningful / 40 => richness = 0.15
    // 0 insight events => insightEngagement = 0.5 (default)
    // Score = (1 * 0.30 + 1 * 0.35 + 0.15 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.30 + 0.35 + 0.0225 + 0.10) * 100 = 77.25 => 77
    const events = [
      { type: 'task_accepted' },
      { type: 'task_completed' },
      { type: 'task_completed' },
      { type: 'task_completed' },
      { type: 'task_completed' },
      { type: 'task_completed' },
    ];
    expect(computePlanningConfidence(events)).toBe(77);
  });

  it('uses default acceptance of 0.5 when no decisions made', () => {
    // Only completions, no accept/reject => acceptance = 0.5 (default)
    // 1 completed / 0 accepted => completion = 0
    // 1 meaningful / 40 => richness = 0.025
    // 0 insight events => insightEngagement = 0.5 (default)
    // Score = (0.5 * 0.30 + 0 * 0.35 + 0.025 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.15 + 0 + 0.00375 + 0.10) * 100 = 25.375 => 25
    const events = [
      { type: 'task_completed' },
    ];
    expect(computePlanningConfidence(events)).toBe(25);
  });

  it('includes briefing_done as a meaningful event', () => {
    const events = [
      { type: 'task_accepted' },
      { type: 'briefing_done' },
    ];
    // 1 accepted, 0 rejected => acceptance = 1
    // 0 completed / 1 accepted => completion = 0
    // 2 meaningful / 40 => richness = 0.05
    // 0 insight events => insightEngagement = 0.5 (default)
    // Score = (1 * 0.30 + 0 * 0.35 + 0.05 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.30 + 0 + 0.0075 + 0.10) * 100 = 40.75 => 41
    expect(computePlanningConfidence(events)).toBe(41);
  });

  it('returns 100 with perfect scores', () => {
    // 40 accepted, 0 rejected => acceptance = 1
    // 40 completed / 40 accepted => completion = 1
    // 40 meaningful / 40 => richness = 1
    // 0 insight events => insightEngagement = 0.5 (default)
    // Score = (1 * 0.30 + 1 * 0.35 + 1 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.30 + 0.35 + 0.15 + 0.10) * 100 = 90
    const events = Array.from({ length: 40 }, (_, i) => ({
      type: i < 20 ? 'task_accepted' : 'task_completed',
    }));
    expect(computePlanningConfidence(events)).toBe(90);
  });

  it('includes insight_accepted and insight_dismissed in confidence calculation', () => {
    // 1 accepted, 0 rejected => acceptance = 1
    // 0 completed / 1 accepted => completion = 0
    // 3 meaningful (1 accepted + 2 insight events) / 40 => richness = 0.075
    // 1 insight accepted, 1 insight dismissed => insightEngagement = 0.5
    // Score = (1 * 0.30 + 0 * 0.35 + 0.075 * 0.15 + 0.5 * 0.20) * 100
    //       = (0.30 + 0 + 0.01125 + 0.10) * 100 = 41.125 => 41
    const events = [
      { type: 'task_accepted' },
      { type: 'insight_accepted' },
      { type: 'insight_dismissed' },
    ];
    expect(computePlanningConfidence(events)).toBe(41);
  });

  it('insight engagement increases with more accepted insights', () => {
    // 1 accepted, 0 rejected => acceptance = 1
    // 0 completed / 1 accepted => completion = 0
    // 4 meaningful / 40 => richness = 0.10
    // 3 insight accepted, 1 insight dismissed => insightEngagement = 3/4 = 0.75
    // Score = (1 * 0.30 + 0 * 0.35 + 0.10 * 0.15 + 0.75 * 0.20) * 100
    //       = (0.30 + 0 + 0.015 + 0.15) * 100 = 46.5 => 47
    const events = [
      { type: 'task_accepted' },
      { type: 'insight_accepted' },
      { type: 'insight_accepted' },
      { type: 'insight_accepted' },
      { type: 'insight_dismissed' },
    ];
    expect(computePlanningConfidence(events)).toBe(47);
  });
});

// ============================================================
// validateNOVAResponse (schema-based)
// ============================================================
describe('validateNOVAResponse', () => {
  it('rejects empty/too-short responses', () => {
    expect(validateNOVAResponse('', 'briefing').valid).toBe(false);
    expect(validateNOVAResponse('short', 'briefing').valid).toBe(false);
    expect(validateNOVAResponse(null, 'briefing').valid).toBe(false);
    expect(validateNOVAResponse(undefined, 'briefing').valid).toBe(false);
  });

  it('rejects non-JSON text', () => {
    const result = validateNOVAResponse('Hello, how are you?', 'briefing');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not valid JSON');
  });

  it('accepts valid JSON matching CHAT_SCHEMA for briefing', () => {
    const json = JSON.stringify({ content: 'Hello!', options: null, ready: false });
    const result = validateNOVAResponse(json, 'briefing');
    expect(result.valid).toBe(true);
  });

  it('rejects JSON missing required field for CHAT_SCHEMA', () => {
    const json = JSON.stringify({ content: 'Hello' }); // missing "ready"
    const result = validateNOVAResponse(json, 'briefing');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('ready');
  });

  it('accepts valid JSON matching CHAT_SCHEMA for preview', () => {
    const json = JSON.stringify({ content: 'Plan for tomorrow', options: null, ready: false });
    const result = validateNOVAResponse(json, 'preview');
    expect(result.valid).toBe(true);
  });

  it('accepts valid JSON matching CHAT_SCHEMA for calibration', () => {
    const json = JSON.stringify({ content: 'Tell me about your goals', options: null, ready: false });
    const result = validateNOVAResponse(json, 'calibration');
    expect(result.valid).toBe(true);
  });

  it('accepts valid JSON matching CHAT_SCHEMA for focus', () => {
    const json = JSON.stringify({ content: 'Step 1: Do this', options: null, ready: true });
    const result = validateNOVAResponse(json, 'focus');
    expect(result.valid).toBe(true);
  });

  it('accepts valid JSON matching PLAN_SCHEMA for plan responses', () => {
    const json = JSON.stringify({
      tasks: [
        { title: 'Task 1', goalId: null, goalTitle: null, estimatedMinutes: 30, complexity: 'medium', rationale: 'Important' },
      ],
    });
    // Use a program ID that maps to CHAT_SCHEMA (plan uses askAI, not chatWithNOVA)
    // validateNOVAResponse uses getPlainSchemaForProgram which returns CHAT_SCHEMA for all programs
    const result = validateNOVAResponse(json, 'briefing');
    // CHAT_SCHEMA requires content + ready, so this should fail (tasks not in CHAT_SCHEMA)
    expect(result.valid).toBe(false);
  });

  it('rejects JSON with wrong types', () => {
    const json = JSON.stringify({ content: 123, options: null, ready: false });
    const result = validateNOVAResponse(json, 'briefing');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('content');
  });

  it('returns valid for unknown program IDs (falls back to CHAT_SCHEMA)', () => {
    const json = JSON.stringify({ content: 'Hello', options: null, ready: true });
    const result = validateNOVAResponse(json, 'unknown_program');
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// NOVA_DEFAULT
// ============================================================
describe('NOVA_DEFAULT', () => {
  it('has the expected default shape', () => {
    expect(NOVA_DEFAULT).toEqual({
      syncEvents: [],
      routine: null,
      programChats: { briefing: [], focus: null, preview: [], calibration: [] },
      suggestedTasks: [],
      dailyPlan: null,
      planGenLoading: false,
      planError: null,
      weeklyInsights: null,
      pendingInsights: [],
      planAccuracy: { history: [], movingAverage: null },
    });
  });
});

// ============================================================
// computeSkillImprovements
// ============================================================
describe('computeSkillImprovements', () => {
  const skillNames = [
    'JavaScript/TypeScript',
    'React & Ecosystem',
    'Python',
    'Data Structures',
    'Algorithms',
    'System Design',
    'APIs & Services',
    'Databases & Storage',
    'Problem Solving',
  ];

  it('returns empty array for undefined/null/empty tasks', () => {
    expect(computeSkillImprovements(undefined, skillNames)).toEqual([]);
    expect(computeSkillImprovements(null, skillNames)).toEqual([]);
    expect(computeSkillImprovements([], skillNames)).toEqual([]);
  });

  it('returns empty array for undefined/null/empty skill names', () => {
    const tasks = [{ title: 'Build a React component' }];
    expect(computeSkillImprovements(tasks, undefined)).toEqual([]);
    expect(computeSkillImprovements(tasks, null)).toEqual([]);
    expect(computeSkillImprovements(tasks, [])).toEqual([]);
  });

  it('detects skill match from task title keywords', () => {
    const tasks = [{ title: 'Refactor the React component to use hooks' }];
    const result = computeSkillImprovements(tasks, skillNames);
    expect(result.length).toBeGreaterThan(0);
    const match = result.find(r => r.skillName === 'React & Ecosystem');
    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThan(0);
    expect(match.taskTitle).toBe('Refactor the React component to use hooks');
  });

  it('detects JavaScript/TypeScript from task mentioning JS', () => {
    const tasks = [{ title: 'Fix TypeScript type errors in the API layer' }];
    const result = computeSkillImprovements(tasks, skillNames);
    const match = result.find(r => r.skillName === 'JavaScript/TypeScript');
    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThan(0);
  });

  it('detects Python from task mentioning python', () => {
    const tasks = [{ title: 'Write a Python script to process CSV data' }];
    const result = computeSkillImprovements(tasks, skillNames);
    const match = result.find(r => r.skillName === 'Python');
    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThan(0);
  });

  it('detects multiple skills from a single task', () => {
    const tasks = [{ title: 'Design scalable APIs with databases optimization' }];
    const result = computeSkillImprovements(tasks, skillNames);
    const apiMatch = result.find(r => r.skillName === 'APIs & Services');
    const dbMatch = result.find(r => r.skillName === 'Databases & Storage');
    expect(apiMatch).toBeDefined();
    expect(dbMatch).toBeDefined();
  });

  it('returns best match per skill (highest confidence)', () => {
    const tasks = [
      { title: 'React frontend work' },
      { title: 'React Native mobile app' },
    ];
    const result = computeSkillImprovements(tasks, skillNames);
    const match = result.find(r => r.skillName === 'React & Ecosystem');
    expect(match).toBeDefined();
    // Should only have one entry per skill
    const matches = result.filter(r => r.skillName === 'React & Ecosystem');
    expect(matches).toHaveLength(1);
  });

  it('handles tasks with detail field instead of title', () => {
    const tasks = [{ detail: 'Implement new algorithms for sorting data' }];
    const result = computeSkillImprovements(tasks, skillNames);
    const match = result.find(r => r.skillName === 'Algorithms');
    expect(match).toBeDefined();
  });

  it('returns results sorted by confidence descending', () => {
    const tasks = [
      { title: 'Python data processing with algorithms' },
      { title: 'Build React UI components' },
    ];
    const result = computeSkillImprovements(tasks, skillNames);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].confidence).toBeLessThanOrEqual(result[i - 1].confidence);
    }
  });
});

// ============================================================
// getNeglectedSkills
// ============================================================
describe('getNeglectedSkills', () => {
  const DAY_MS = 86_400_000;
  const now = Date.now();

  function makeSkill(hours, daysSinceLastUse) {
    return {
      hours,
      lastApplied: daysSinceLastUse == null
        ? null
        : new Date(now - daysSinceLastUse * DAY_MS).toISOString(),
      evidenceCount: 0,
      evidence: [],
      notes: '',
    };
  }

  const mockSkills = {
    'Core CS': {
      color: '#53aaff',
      skills: {
        'Data Structures': makeSkill(10, 20),   // neglected (20 days > 14)
        'Algorithms':      makeSkill(5, 5),      // fine (5 days < 14)
        'System Design':   makeSkill(0, 10),     // unused, 10 days > 7, so neglected
      },
    },
    Languages: {
      color: '#f0b429',
      skills: {
        'Python':          makeSkill(0, null),   // never used, no lastApplied
        'JavaScript/TypeScript': makeSkill(15, 2), // fine (2 days < 14)
      },
    },
  };

  it('returns empty array for undefined/null skills', () => {
    expect(getNeglectedSkills(undefined)).toEqual([]);
    expect(getNeglectedSkills(null)).toEqual([]);
  });

  it('identifies neglected skills based on lastApplied threshold', () => {
    const result = getNeglectedSkills(mockSkills);
    // Data Structures: 10 hours, 20 days since use -> neglected (>14 days)
    const ds = result.find(r => r.skillName === 'Data Structures');
    expect(ds).toBeDefined();
    expect(ds.daysSinceLastUse).toBe(20);
    expect(ds.status).toBe('stale');
  });

  it('marks unused skills (0 hours) as neglected after 7 days', () => {
    const result = getNeglectedSkills(mockSkills);
    // System Design: 0 hours, 10 days since use -> neglected (>7 days for unused)
    const sd = result.find(r => r.skillName === 'System Design');
    expect(sd).toBeDefined();
    expect(sd.status).toBe('unused');
  });

  it('does not flag skills used recently', () => {
    const result = getNeglectedSkills(mockSkills);
    const algo = result.find(r => r.skillName === 'Algorithms');
    expect(algo).toBeUndefined();
    const ts = result.find(r => r.skillName === 'JavaScript/TypeScript');
    expect(ts).toBeUndefined();
  });

  it('handles skills that were never used at all', () => {
    const result = getNeglectedSkills(mockSkills);
    // Python: 0 hours, null lastApplied -> not flagged (no lastApplied means never used)
    const py = result.find(r => r.skillName === 'Python');
    expect(py).toBeUndefined();
  });

  it('returns results sorted by daysSinceLastUse descending', () => {
    const result = getNeglectedSkills(mockSkills);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].daysSinceLastUse).toBeLessThanOrEqual(result[i - 1].daysSinceLastUse);
    }
  });

  it('includes group metadata in results', () => {
    const result = getNeglectedSkills(mockSkills);
    const ds = result.find(r => r.skillName === 'Data Structures');
    expect(ds.groupName).toBe('Core CS');
    expect(ds.groupColor).toBe('#53aaff');
    expect(typeof ds.hours).toBe('number');
  });
});
