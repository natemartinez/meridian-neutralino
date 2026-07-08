/**
 * Program FSM Tests
 *
 * Exhaustive tests covering:
 *   1. All 5 program FSMs (briefing, focus, regroup, preview, calibration)
 *   2. Every defined transition for every phase
 *   3. Default/fallback transitions
 *   4. Edge cases: unknown program, unknown phase, unknown input, null phase
 *   5. Helper functions: getInitialPhase, getProgramPhases, isTerminalPhase, phaseRequiresLLM
 *   6. Transition helper functions: llmTransition, deterministicTransition, retryTransition, stayTransition
 */
import { describe, it, expect } from 'vitest';
import {
  PHASES,
  INPUT,
  PROGRAM_FSMS,
  resolveTransition,
  getInitialPhase,
  getProgramPhases,
  isTerminalPhase,
  phaseRequiresLLM,
  llmTransition,
  deterministicTransition,
  retryTransition,
  stayTransition,
} from './programFSM.js';

// ── Transition Helper Tests ──────────────────────────────────────────────────

describe('transition helpers', () => {
  it('llmTransition sets requiresLLM=true and response=null', () => {
    const result = llmTransition('next_phase');
    expect(result).toEqual({ nextPhase: 'next_phase', requiresLLM: true, response: null });
  });

  it('deterministicTransition sets requiresLLM=false with optional response', () => {
    const result = deterministicTransition('next_phase', 'Hello');
    expect(result).toEqual({ nextPhase: 'next_phase', requiresLLM: false, response: 'Hello' });
  });

  it('deterministicTransition defaults response to null', () => {
    const result = deterministicTransition('next_phase');
    expect(result).toEqual({ nextPhase: 'next_phase', requiresLLM: false, response: null });
  });

  it('retryTransition sets nextPhase=null and requiresLLM=true', () => {
    const result = retryTransition('Please try again.');
    expect(result).toEqual({ nextPhase: null, requiresLLM: true, response: 'Please try again.' });
  });

  it('retryTransition defaults response to null', () => {
    const result = retryTransition();
    expect(result).toEqual({ nextPhase: null, requiresLLM: true, response: null });
  });

  it('stayTransition sets nextPhase=null and requiresLLM=false', () => {
    const result = stayTransition('Waiting for input.');
    expect(result).toEqual({ nextPhase: null, requiresLLM: false, response: 'Waiting for input.' });
  });

  it('stayTransition defaults response to null', () => {
    const result = stayTransition();
    expect(result).toEqual({ nextPhase: null, requiresLLM: false, response: null });
  });
});

// ── Program FSM Structure Tests ──────────────────────────────────────────────

describe('PROGRAM_FSMS structure', () => {
  it('defines all 5 programs', () => {
    expect(Object.keys(PROGRAM_FSMS)).toEqual([
      'briefing',
      'focus',
      'regroup',
      'preview',
      'calibration',
    ]);
  });

  it('each program has an initial phase and transitions map', () => {
    for (const [progId, fsm] of Object.entries(PROGRAM_FSMS)) {
      expect(fsm.initial).toBeTypeOf('string');
      expect(fsm.transitions).toBeTypeOf('object');
    }
  });

  it('every phase in transitions is a valid PHASES constant', () => {
    const allPhaseValues = Object.values(PHASES);
    for (const fsm of Object.values(PROGRAM_FSMS)) {
      for (const phase of Object.keys(fsm.transitions)) {
        expect(allPhaseValues).toContain(phase);
      }
    }
  });

  it('every transition target is a valid PHASES constant or null', () => {
    const allPhaseValues = Object.values(PHASES);
    for (const fsm of Object.values(PROGRAM_FSMS)) {
      for (const phaseTransitions of Object.values(fsm.transitions)) {
        for (const transition of Object.values(phaseTransitions)) {
          if (transition && transition.nextPhase !== null) {
            expect(allPhaseValues).toContain(transition.nextPhase);
          }
        }
      }
    }
  });

  it('every transition has requiresLLM boolean and response nullable string', () => {
    for (const fsm of Object.values(PROGRAM_FSMS)) {
      for (const phaseTransitions of Object.values(fsm.transitions)) {
        for (const transition of Object.values(phaseTransitions)) {
          if (transition) {
            expect(typeof transition.requiresLLM).toBe('boolean');
            expect(
              transition.response === null || typeof transition.response === 'string'
            ).toBe(true);
          }
        }
      }
    }
  });
});

// ── Briefing FSM Tests ───────────────────────────────────────────────────────

describe('briefing FSM', () => {
  it('initial phase is headspace_check', () => {
    expect(getInitialPhase('briefing')).toBe(PHASES.BRIEFING_HEADSPACE_CHECK);
  });

  it('has 5 phases', () => {
    expect(getProgramPhases('briefing')).toEqual([
      PHASES.BRIEFING_HEADSPACE_CHECK,
      PHASES.BRIEFING_GOAL_REVIEW,
      PHASES.BRIEFING_PICK_3,
      PHASES.BRIEFING_BREAKDOWN,
      PHASES.BRIEFING_DONE,
    ]);
  });

  describe('headspace_check', () => {
    it('rating → goal_review (LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_HEADSPACE_CHECK, INPUT.RATING);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_GOAL_REVIEW, requiresLLM: true, response: null });
    });

    it('text → goal_review (LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_HEADSPACE_CHECK, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_GOAL_REVIEW, requiresLLM: true, response: null });
    });

    it('ready_signal → pick_3 (deterministic)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_HEADSPACE_CHECK, INPUT.READY_SIGNAL);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_PICK_3, requiresLLM: false, response: null });
    });

    it('unknown input → retry LLM with message', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_HEADSPACE_CHECK, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: true, response: 'Please provide a rating from 1 to 5.' });
    });
  });

  describe('goal_review', () => {
    it('confirm → pick_3 (LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_GOAL_REVIEW, INPUT.CONFIRM);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_PICK_3, requiresLLM: true, response: null });
    });

    it('text → goal_review (LLM, stay)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_GOAL_REVIEW, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_GOAL_REVIEW, requiresLLM: true, response: null });
    });

    it('ready_signal → pick_3 (deterministic)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_GOAL_REVIEW, INPUT.READY_SIGNAL);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_PICK_3, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_GOAL_REVIEW, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('pick_3', () => {
    it('selection → breakdown (deterministic)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_PICK_3, INPUT.SELECTION);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_BREAKDOWN, requiresLLM: false, response: 'Proceeding to breakdown.' });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_PICK_3, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_PICK_3, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('breakdown', () => {
    it('breakdown_done → done (deterministic)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_BREAKDOWN, INPUT.BREAKDOWN_DONE);
      expect(t).toEqual({ nextPhase: PHASES.BRIEFING_DONE, requiresLLM: false, response: 'Briefing complete.' });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_BREAKDOWN, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_BREAKDOWN, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('done', () => {
    it('any input → stay with message', () => {
      const t = resolveTransition('briefing', PHASES.BRIEFING_DONE, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: 'Briefing is already complete.' });
    });
  });
});

// ── Focus FSM Tests ──────────────────────────────────────────────────────────

describe('focus FSM', () => {
  it('initial phase is plan_generation', () => {
    expect(getInitialPhase('focus')).toBe(PHASES.FOCUS_PLAN_GENERATION);
  });

  it('has 4 phases', () => {
    expect(getProgramPhases('focus')).toEqual([
      PHASES.FOCUS_PLAN_GENERATION,
      PHASES.FOCUS_EXECUTING,
      PHASES.FOCUS_REGROUP,
      PHASES.FOCUS_COMPLETED,
    ]);
  });

  describe('plan_generation', () => {
    it('plan_accepted → executing (LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_PLAN_GENERATION, INPUT.PLAN_ACCEPTED);
      expect(t).toEqual({ nextPhase: PHASES.FOCUS_EXECUTING, requiresLLM: true, response: null });
    });

    it('plan_rejected → plan_generation (LLM, regenerate)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_PLAN_GENERATION, INPUT.PLAN_REJECTED);
      expect(t).toEqual({ nextPhase: PHASES.FOCUS_PLAN_GENERATION, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_PLAN_GENERATION, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_PLAN_GENERATION, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('executing', () => {
    it('all_done → completed (deterministic)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_EXECUTING, INPUT.ALL_DONE);
      expect(t).toEqual({ nextPhase: PHASES.FOCUS_COMPLETED, requiresLLM: false, response: 'Focus session complete.' });
    });

    it('stuck_signal → regroup (LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_EXECUTING, INPUT.STUCK_SIGNAL);
      expect(t).toEqual({ nextPhase: PHASES.FOCUS_REGROUP, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_EXECUTING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_EXECUTING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('regroup', () => {
    it('refocused → executing (LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_REGROUP, INPUT.REFOCUSED);
      expect(t).toEqual({ nextPhase: PHASES.FOCUS_EXECUTING, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_REGROUP, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_REGROUP, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('completed', () => {
    it('any input → stay with message', () => {
      const t = resolveTransition('focus', PHASES.FOCUS_COMPLETED, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: 'Focus session is already complete.' });
    });
  });
});

// ── Regroup FSM Tests ────────────────────────────────────────────────────────

describe('regroup FSM', () => {
  it('initial phase is stuck', () => {
    expect(getInitialPhase('regroup')).toBe(PHASES.REGROUP_STUCK);
  });

  it('has 3 phases', () => {
    expect(getProgramPhases('regroup')).toEqual([
      PHASES.REGROUP_STUCK,
      PHASES.REGROUP_REFOCUSING,
      PHASES.REGROUP_RESUMED,
    ]);
  });

  describe('stuck', () => {
    it('text → refocusing (LLM)', () => {
      const t = resolveTransition('regroup', PHASES.REGROUP_STUCK, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: PHASES.REGROUP_REFOCUSING, requiresLLM: true, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('regroup', PHASES.REGROUP_STUCK, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('refocusing', () => {
    it('confirm → resumed (deterministic)', () => {
      const t = resolveTransition('regroup', PHASES.REGROUP_REFOCUSING, INPUT.CONFIRM);
      expect(t).toEqual({ nextPhase: PHASES.REGROUP_RESUMED, requiresLLM: false, response: 'Ready to resume.' });
    });

    it('text → refocusing (LLM, more discussion)', () => {
      const t = resolveTransition('regroup', PHASES.REGROUP_REFOCUSING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: PHASES.REGROUP_REFOCUSING, requiresLLM: true, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('regroup', PHASES.REGROUP_REFOCUSING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('resumed', () => {
    it('any input → stay with message', () => {
      const t = resolveTransition('regroup', PHASES.REGROUP_RESUMED, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: 'Regroup complete — ready to resume focus.' });
    });
  });
});

// ── Preview FSM Tests ────────────────────────────────────────────────────────

describe('preview FSM', () => {
  it('initial phase is planning', () => {
    expect(getInitialPhase('preview')).toBe(PHASES.PREVIEW_PLANNING);
  });

  it('has 3 phases', () => {
    expect(getProgramPhases('preview')).toEqual([
      PHASES.PREVIEW_PLANNING,
      PHASES.PREVIEW_CONFIRMING,
      PHASES.PREVIEW_DONE,
    ]);
  });

  describe('planning', () => {
    it('confirm → confirming (LLM)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_PLANNING, INPUT.CONFIRM);
      expect(t).toEqual({ nextPhase: PHASES.PREVIEW_CONFIRMING, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_PLANNING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('ready_signal → confirming (deterministic)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_PLANNING, INPUT.READY_SIGNAL);
      expect(t).toEqual({ nextPhase: PHASES.PREVIEW_CONFIRMING, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_PLANNING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('confirming', () => {
    it('confirm → done (deterministic)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_CONFIRMING, INPUT.CONFIRM);
      expect(t).toEqual({ nextPhase: PHASES.PREVIEW_DONE, requiresLLM: false, response: 'Preview complete.' });
    });

    it('correct → planning (LLM, adjust)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_CONFIRMING, INPUT.CORRECT);
      expect(t).toEqual({ nextPhase: PHASES.PREVIEW_PLANNING, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_CONFIRMING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_CONFIRMING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('done', () => {
    it('any input → stay with message', () => {
      const t = resolveTransition('preview', PHASES.PREVIEW_DONE, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: 'Preview is already complete.' });
    });
  });
});

// ── Calibration FSM Tests ────────────────────────────────────────────────────

describe('calibration FSM', () => {
  it('initial phase is questioning', () => {
    expect(getInitialPhase('calibration')).toBe(PHASES.CALIBRATION_QUESTIONING);
  });

  it('has 4 phases', () => {
    expect(getProgramPhases('calibration')).toEqual([
      PHASES.CALIBRATION_QUESTIONING,
      PHASES.CALIBRATION_SUMMARIZING,
      PHASES.CALIBRATION_CONFIRMING,
      PHASES.CALIBRATION_DONE,
    ]);
  });

  describe('questioning', () => {
    it('text → questioning (LLM, continue)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_QUESTIONING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: PHASES.CALIBRATION_QUESTIONING, requiresLLM: true, response: null });
    });

    it('ready_signal → summarizing (deterministic)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_QUESTIONING, INPUT.READY_SIGNAL);
      expect(t).toEqual({ nextPhase: PHASES.CALIBRATION_SUMMARIZING, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_QUESTIONING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('summarizing', () => {
    it('confirm → confirming (LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_SUMMARIZING, INPUT.CONFIRM);
      expect(t).toEqual({ nextPhase: PHASES.CALIBRATION_CONFIRMING, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_SUMMARIZING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_SUMMARIZING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('confirming', () => {
    it('confirm → done (deterministic)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_CONFIRMING, INPUT.CONFIRM);
      expect(t).toEqual({ nextPhase: PHASES.CALIBRATION_DONE, requiresLLM: false, response: 'Calibration complete.' });
    });

    it('correct → questioning (LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_CONFIRMING, INPUT.CORRECT);
      expect(t).toEqual({ nextPhase: PHASES.CALIBRATION_QUESTIONING, requiresLLM: true, response: null });
    });

    it('text → stay (no LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_CONFIRMING, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });

    it('unknown input → stay (no LLM)', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_CONFIRMING, 'unknown');
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
    });
  });

  describe('done', () => {
    it('any input → stay with message', () => {
      const t = resolveTransition('calibration', PHASES.CALIBRATION_DONE, INPUT.TEXT);
      expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: 'Calibration is already complete.' });
    });
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('resolveTransition with null phase returns initial phase with LLM', () => {
    const t = resolveTransition('briefing', null, INPUT.TEXT);
    expect(t).toEqual({ nextPhase: PHASES.BRIEFING_HEADSPACE_CHECK, requiresLLM: true, response: null });
  });

  it('resolveTransition with unknown program returns no-op', () => {
    const t = resolveTransition('nonexistent', PHASES.BRIEFING_HEADSPACE_CHECK, INPUT.TEXT);
    expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
  });

  it('resolveTransition with unknown phase returns no-op', () => {
    const t = resolveTransition('briefing', 'nonexistent_phase', INPUT.TEXT);
    expect(t).toEqual({ nextPhase: null, requiresLLM: false, response: null });
  });

  it('getInitialPhase returns null for unknown program', () => {
    expect(getInitialPhase('nonexistent')).toBeNull();
  });

  it('getProgramPhases returns empty array for unknown program', () => {
    expect(getProgramPhases('nonexistent')).toEqual([]);
  });
});

// ── Helper Function Tests ────────────────────────────────────────────────────

describe('isTerminalPhase', () => {
  it('returns true for briefing done', () => {
    expect(isTerminalPhase(PHASES.BRIEFING_DONE)).toBe(true);
  });

  it('returns true for focus completed', () => {
    expect(isTerminalPhase(PHASES.FOCUS_COMPLETED)).toBe(true);
  });

  it('returns true for regroup resumed', () => {
    expect(isTerminalPhase(PHASES.REGROUP_RESUMED)).toBe(true);
  });

  it('returns true for preview done', () => {
    expect(isTerminalPhase(PHASES.PREVIEW_DONE)).toBe(true);
  });

  it('returns true for calibration done', () => {
    expect(isTerminalPhase(PHASES.CALIBRATION_DONE)).toBe(true);
  });

  it('returns false for non-terminal phases', () => {
    expect(isTerminalPhase(PHASES.BRIEFING_HEADSPACE_CHECK)).toBe(false);
    expect(isTerminalPhase(PHASES.FOCUS_EXECUTING)).toBe(false);
    expect(isTerminalPhase(PHASES.REGROUP_STUCK)).toBe(false);
    expect(isTerminalPhase(PHASES.PREVIEW_PLANNING)).toBe(false);
    expect(isTerminalPhase(PHASES.CALIBRATION_QUESTIONING)).toBe(false);
  });

  it('returns false for unknown phase', () => {
    expect(isTerminalPhase('nonexistent')).toBe(false);
  });
});

describe('phaseRequiresLLM', () => {
  it('returns true for briefing headspace_check (has LLM transitions)', () => {
    expect(phaseRequiresLLM('briefing', PHASES.BRIEFING_HEADSPACE_CHECK)).toBe(true);
  });

  it('returns true for briefing goal_review (has LLM transitions)', () => {
    expect(phaseRequiresLLM('briefing', PHASES.BRIEFING_GOAL_REVIEW)).toBe(true);
  });

  it('returns false for briefing pick_3 (all deterministic)', () => {
    expect(phaseRequiresLLM('briefing', PHASES.BRIEFING_PICK_3)).toBe(false);
  });

  it('returns false for briefing breakdown (all deterministic)', () => {
    expect(phaseRequiresLLM('briefing', PHASES.BRIEFING_BREAKDOWN)).toBe(false);
  });

  it('returns false for briefing done (all deterministic)', () => {
    expect(phaseRequiresLLM('briefing', PHASES.BRIEFING_DONE)).toBe(false);
  });

  it('returns true for focus plan_generation', () => {
    expect(phaseRequiresLLM('focus', PHASES.FOCUS_PLAN_GENERATION)).toBe(true);
  });

  it('returns true for focus executing (has stuck_signal LLM)', () => {
    expect(phaseRequiresLLM('focus', PHASES.FOCUS_EXECUTING)).toBe(true);
  });

  it('returns true for focus regroup (has refocused LLM)', () => {
    expect(phaseRequiresLLM('focus', PHASES.FOCUS_REGROUP)).toBe(true);
  });

  it('returns true for calibration questioning', () => {
    expect(phaseRequiresLLM('calibration', PHASES.CALIBRATION_QUESTIONING)).toBe(true);
  });

  it('returns true for calibration summarizing', () => {
    expect(phaseRequiresLLM('calibration', PHASES.CALIBRATION_SUMMARIZING)).toBe(true);
  });

  it('returns true for calibration confirming (has correct LLM)', () => {
    expect(phaseRequiresLLM('calibration', PHASES.CALIBRATION_CONFIRMING)).toBe(true);
  });

  it('returns false for unknown program', () => {
    expect(phaseRequiresLLM('nonexistent', PHASES.BRIEFING_HEADSPACE_CHECK)).toBe(false);
  });

  it('returns false for unknown phase', () => {
    expect(phaseRequiresLLM('briefing', 'nonexistent')).toBe(false);
  });
});

// ── Cross-Program Consistency ────────────────────────────────────────────────

describe('cross-program consistency', () => {
  it('every program initial phase is in its own transitions map', () => {
    for (const [progId, fsm] of Object.entries(PROGRAM_FSMS)) {
      expect(fsm.transitions).toHaveProperty(fsm.initial);
    }
  });

  it('every terminal phase only has a _default stay transition', () => {
    const terminalPhases = [
      PHASES.BRIEFING_DONE,
      PHASES.FOCUS_COMPLETED,
      PHASES.REGROUP_RESUMED,
      PHASES.PREVIEW_DONE,
      PHASES.CALIBRATION_DONE,
    ];
    for (const [progId, fsm] of Object.entries(PROGRAM_FSMS)) {
      for (const [phase, transitions] of Object.entries(fsm.transitions)) {
        if (terminalPhases.includes(phase)) {
          // Terminal phases should only have _default
          const keys = Object.keys(transitions);
          expect(keys).toEqual(['_default']);
          expect(transitions._default.requiresLLM).toBe(false);
          expect(transitions._default.nextPhase).toBeNull();
        }
      }
    }
  });

  it('every non-terminal phase has at least one LLM or deterministic transition', () => {
    const terminalPhases = [
      PHASES.BRIEFING_DONE,
      PHASES.FOCUS_COMPLETED,
      PHASES.REGROUP_RESUMED,
      PHASES.PREVIEW_DONE,
      PHASES.CALIBRATION_DONE,
    ];
    for (const [progId, fsm] of Object.entries(PROGRAM_FSMS)) {
      for (const [phase, transitions] of Object.entries(fsm.transitions)) {
        if (terminalPhases.includes(phase)) continue;
        // Must have at least one transition that goes somewhere (nextPhase !== null)
        const hasForwardTransition = Object.values(transitions).some(
          t => t && t.nextPhase !== null
        );
        expect(hasForwardTransition).toBe(true);
      }
    }
  });

  it('no transition references a phase outside its own program', () => {
    // Build a map of which phases belong to which program
    const programPhaseMap = {};
    for (const [progId, fsm] of Object.entries(PROGRAM_FSMS)) {
      programPhaseMap[progId] = Object.keys(fsm.transitions);
    }

    for (const [progId, fsm] of Object.entries(PROGRAM_FSMS)) {
      const validPhases = programPhaseMap[progId];
      for (const phaseTransitions of Object.values(fsm.transitions)) {
        for (const transition of Object.values(phaseTransitions)) {
          if (transition && transition.nextPhase !== null) {
            expect(validPhases).toContain(transition.nextPhase);
          }
        }
      }
    }
  });
});
