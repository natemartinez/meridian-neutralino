/**
 * Program FSM Definitions
 *
 * Each program (briefing, focus, regroup, preview, calibration) has its own
 * finite state machine. Transitions are driven by:
 *
 *   1. User input type (text, rating, selection, confirmation)
 *   2. LLM response signals (e.g., [READY] token)
 *   3. UI action completions (e.g., Pick 3 confirmed, breakdown submitted)
 *
 * The Execution Engine uses these definitions to determine:
 *   - What phase to transition to next
 *   - Whether an LLM call is required for the transition
 *   - What the deterministic response should be (if no LLM call needed)
 *
 * @module programFSM
 */

// ── Phase Constants ──────────────────────────────────────────────────────────

export const PHASES = {
  // Briefing
  BRIEFING_HEADSPACE_CHECK: 'headspace_check',
  BRIEFING_GOAL_REVIEW:     'goal_review',
  BRIEFING_PICK_3:          'pick_3',
  BRIEFING_BREAKDOWN:       'breakdown',
  BRIEFING_DONE:            'done',

  // Focus
  FOCUS_PLAN_GENERATION:    'plan_generation',
  FOCUS_EXECUTING:          'executing',
  FOCUS_REGROUP:            'regroup',
  FOCUS_COMPLETED:          'completed',

  // Regroup
  REGROUP_STUCK:            'stuck',
  REGROUP_REFOCUSING:       'refocusing',
  REGROUP_RESUMED:          'resumed',

  // Preview
  PREVIEW_PLANNING:         'planning',
  PREVIEW_CONFIRMING:       'confirming',
  PREVIEW_DONE:             'done',

  // Calibration
  CALIBRATION_QUESTIONING:  'questioning',
  CALIBRATION_SUMMARIZING:  'summarizing',
  CALIBRATION_CONFIRMING:   'confirming',
  CALIBRATION_DONE:         'done',
};

// ── Input Type Constants ─────────────────────────────────────────────────────

export const INPUT = {
  TEXT:            'text',            // Free-form user text input
  RATING:          'rating',          // Numeric rating (e.g., headspace 1-5)
  CONFIRM:         'confirm',         // User confirms/agrees
  CORRECT:         'correct',         // User corrects/disagrees
  SELECTION:       'selection',       // User selects items (Pick 3)
  BREAKDOWN_DONE:  'breakdown_done',  // User submitted task breakdown
  READY_SIGNAL:    'ready_signal',    // LLM emitted [READY] token
  PLAN_ACCEPTED:   'plan_accepted',   // User accepted the generated plan
  PLAN_REJECTED:   'plan_rejected',   // User rejected the generated plan
  STUCK_SIGNAL:    'stuck_signal',    // User reports being stuck
  REFOCUSED:       'refocused',       // User indicates they're refocused
  ALL_DONE:        'all_done',        // All steps/tasks completed
};

// ── Transition Result Helpers ────────────────────────────────────────────────

/**
 * Creates a transition result indicating the FSM should move to a new phase
 * and the Execution Engine should call the LLM.
 */
export function llmTransition(nextPhase) {
  return { nextPhase, requiresLLM: true, response: null };
}

/**
 * Creates a transition result indicating the FSM should move to a new phase
 * without calling the LLM (deterministic UI-driven transition).
 */
export function deterministicTransition(nextPhase, response = null) {
  return { nextPhase, requiresLLM: false, response };
}

/**
 * Creates a transition result indicating the FSM should stay in the current
 * phase and the LLM should be called again (e.g., invalid input → regenerate).
 */
export function retryTransition(response = null) {
  return { nextPhase: null, requiresLLM: true, response };
}

/**
 * Creates a transition result indicating the FSM should stay in the current
 * phase without calling the LLM (e.g., user sends more text during questioning).
 */
export function stayTransition(response = null) {
  return { nextPhase: null, requiresLLM: false, response };
}

// ── Program FSM Definitions ──────────────────────────────────────────────────

/**
 * Each program's FSM is a map of:
 *   currentPhase → { inputType → transitionResult }
 *
 * The Execution Engine calls `resolveTransition(programId, currentPhase, inputType)`
 * to determine what happens next.
 */
export const PROGRAM_FSMS = {

  // ── Briefing ────────────────────────────────────────────────────────────────
  //
  // [*] → HEADSPACE_CHECK
  //   HEADSPACE_CHECK → GOAL_REVIEW: user provides rating
  //   HEADSPACE_CHECK → HEADSPACE_CHECK: invalid rating (LLM retry)
  //   GOAL_REVIEW → PICK_3: user confirms understanding
  //   PICK_3 → BREAKDOWN: user selects 3 objectives
  //   BREAKDOWN → DONE: user confirms breakdown
  //   DONE → [*]
  //
  briefing: {
    initial: PHASES.BRIEFING_HEADSPACE_CHECK,

    transitions: {
      [PHASES.BRIEFING_HEADSPACE_CHECK]: {
        [INPUT.RATING]:    llmTransition(PHASES.BRIEFING_GOAL_REVIEW),
        [INPUT.TEXT]:      llmTransition(PHASES.BRIEFING_GOAL_REVIEW),  // Free-form headspace response
        [INPUT.READY_SIGNAL]: deterministicTransition(PHASES.BRIEFING_PICK_3),
        // Default: invalid rating → retry LLM
        _default:           retryTransition('Please provide a rating from 1 to 5.'),
      },

      [PHASES.BRIEFING_GOAL_REVIEW]: {
        [INPUT.CONFIRM]:   llmTransition(PHASES.BRIEFING_PICK_3),
        [INPUT.TEXT]:      llmTransition(PHASES.BRIEFING_GOAL_REVIEW),  // User discusses goals further
        [INPUT.READY_SIGNAL]: deterministicTransition(PHASES.BRIEFING_PICK_3),
        _default:          stayTransition(),
      },

      [PHASES.BRIEFING_PICK_3]: {
        [INPUT.SELECTION]: deterministicTransition(PHASES.BRIEFING_BREAKDOWN, 'Proceeding to breakdown.'),
        [INPUT.TEXT]:      stayTransition(),  // User is still discussing their 3 picks
        _default:          stayTransition(),
      },

      [PHASES.BRIEFING_BREAKDOWN]: {
        [INPUT.BREAKDOWN_DONE]: deterministicTransition(PHASES.BRIEFING_DONE, 'Briefing complete.'),
        [INPUT.TEXT]:            stayTransition(),  // User is still breaking down tasks
        _default:                stayTransition(),
      },

      [PHASES.BRIEFING_DONE]: {
        _default: stayTransition('Briefing is already complete.'),
      },
    },
  },

  // ── Focus ───────────────────────────────────────────────────────────────────
  //
  // [*] → PLAN_GENERATION
  //   PLAN_GENERATION → EXECUTING: plan accepted
  //   PLAN_GENERATION → PLAN_GENERATION: plan rejected, regenerate
  //   EXECUTING → COMPLETED: all steps done
  //   EXECUTING → REGROUP: user reports stuck
  //   COMPLETED → [*]
  //   REGROUP → EXECUTING: user refocused
  //
  focus: {
    initial: PHASES.FOCUS_PLAN_GENERATION,

    transitions: {
      [PHASES.FOCUS_PLAN_GENERATION]: {
        [INPUT.PLAN_ACCEPTED]: llmTransition(PHASES.FOCUS_EXECUTING),
        [INPUT.PLAN_REJECTED]: llmTransition(PHASES.FOCUS_PLAN_GENERATION),
        [INPUT.TEXT]:          stayTransition(),  // User discussing the plan
        _default:              stayTransition(),
      },

      [PHASES.FOCUS_EXECUTING]: {
        [INPUT.ALL_DONE]:    deterministicTransition(PHASES.FOCUS_COMPLETED, 'Focus session complete.'),
        [INPUT.STUCK_SIGNAL]: llmTransition(PHASES.FOCUS_REGROUP),
        [INPUT.TEXT]:        stayTransition(),  // User reporting progress on a step
        _default:            stayTransition(),
      },

      [PHASES.FOCUS_REGROUP]: {
        [INPUT.REFOCUSED]:   llmTransition(PHASES.FOCUS_EXECUTING),
        [INPUT.TEXT]:        stayTransition(),  // User discussing what went wrong
        _default:            stayTransition(),
      },

      [PHASES.FOCUS_COMPLETED]: {
        _default: stayTransition('Focus session is already complete.'),
      },
    },
  },

  // ── Regroup ─────────────────────────────────────────────────────────────────
  //
  // [*] → STUCK
  //   STUCK → REFOCUSING: user describes what happened
  //   REFOCUSING → RESUMED: user confirms they're ready
  //   RESUMED → [*]
  //
  regroup: {
    initial: PHASES.REGROUP_STUCK,

    transitions: {
      [PHASES.REGROUP_STUCK]: {
        [INPUT.TEXT]:      llmTransition(PHASES.REGROUP_REFOCUSING),
        _default:          stayTransition(),
      },

      [PHASES.REGROUP_REFOCUSING]: {
        [INPUT.CONFIRM]:   deterministicTransition(PHASES.REGROUP_RESUMED, 'Ready to resume.'),
        [INPUT.TEXT]:      llmTransition(PHASES.REGROUP_REFOCUSING),  // More discussion needed
        _default:          stayTransition(),
      },

      [PHASES.REGROUP_RESUMED]: {
        _default: stayTransition('Regroup complete — ready to resume focus.'),
      },
    },
  },

  // ── Preview ─────────────────────────────────────────────────────────────────
  //
  // [*] → PLANNING
  //   PLANNING → CONFIRMING: user has discussed what's ahead
  //   CONFIRMING → DONE: user confirms the plan
  //   CONFIRMING → PLANNING: user wants to adjust
  //   DONE → [*]
  //
  preview: {
    initial: PHASES.PREVIEW_PLANNING,

    transitions: {
      [PHASES.PREVIEW_PLANNING]: {
        [INPUT.CONFIRM]:   llmTransition(PHASES.PREVIEW_CONFIRMING),
        [INPUT.TEXT]:      stayTransition(),  // User discussing tomorrow's plan
        [INPUT.READY_SIGNAL]: deterministicTransition(PHASES.PREVIEW_CONFIRMING),
        _default:          stayTransition(),
      },

      [PHASES.PREVIEW_CONFIRMING]: {
        [INPUT.CONFIRM]:   deterministicTransition(PHASES.PREVIEW_DONE, 'Preview complete.'),
        [INPUT.CORRECT]:   llmTransition(PHASES.PREVIEW_PLANNING),
        [INPUT.TEXT]:      stayTransition(),  // User discussing adjustments
        _default:          stayTransition(),
      },

      [PHASES.PREVIEW_DONE]: {
        _default: stayTransition('Preview is already complete.'),
      },
    },
  },

  // ── Calibration ─────────────────────────────────────────────────────────────
  //
  // [*] → QUESTIONING
  //   QUESTIONING → QUESTIONING: next question (LLM continues)
  //   QUESTIONING → SUMMARIZING: confidence threshold met
  //   SUMMARIZING → CONFIRMING: summary presented
  //   CONFIRMING → DONE: user confirms
  //   CONFIRMING → QUESTIONING: user corrects
  //   DONE → [*]
  //
  calibration: {
    initial: PHASES.CALIBRATION_QUESTIONING,

    transitions: {
      [PHASES.CALIBRATION_QUESTIONING]: {
        [INPUT.TEXT]:      llmTransition(PHASES.CALIBRATION_QUESTIONING),  // Continue questioning
        [INPUT.READY_SIGNAL]: deterministicTransition(PHASES.CALIBRATION_SUMMARIZING),
        _default:          stayTransition(),
      },

      [PHASES.CALIBRATION_SUMMARIZING]: {
        [INPUT.CONFIRM]:   llmTransition(PHASES.CALIBRATION_CONFIRMING),
        [INPUT.TEXT]:      stayTransition(),  // User reacting to summary
        _default:          stayTransition(),
      },

      [PHASES.CALIBRATION_CONFIRMING]: {
        [INPUT.CONFIRM]:   deterministicTransition(PHASES.CALIBRATION_DONE, 'Calibration complete.'),
        [INPUT.CORRECT]:   llmTransition(PHASES.CALIBRATION_QUESTIONING),
        [INPUT.TEXT]:      stayTransition(),  // User discussing corrections
        _default:          stayTransition(),
      },

      [PHASES.CALIBRATION_DONE]: {
        _default: stayTransition('Calibration is already complete.'),
      },
    },
  },
};

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves the next FSM state given the current program, phase, and input type.
 *
 * @param {string} programId - One of 'briefing', 'focus', 'regroup', 'preview', 'calibration'
 * @param {string|null} currentPhase - Current FSM phase (null = initial)
 * @param {string} inputType - One of the INPUT constants
 * @returns {{ nextPhase: string|null, requiresLLM: boolean, response: string|null }}
 *
 * The returned object tells the Execution Engine:
 *   - nextPhase: which phase to transition to (null = stay in current phase)
 *   - requiresLLM: whether to call the LLM
 *   - response: deterministic response text (null if LLM should generate it)
 */
export function resolveTransition(programId, currentPhase, inputType) {
  const fsm = PROGRAM_FSMS[programId];
  if (!fsm) {
    console.warn(`[FSM] Unknown program: "${programId}"`);
    return { nextPhase: null, requiresLLM: false, response: null };
  }

  // If no current phase, return the initial phase with an LLM call
  if (!currentPhase) {
    return { nextPhase: fsm.initial, requiresLLM: true, response: null };
  }

  const phaseTransitions = fsm.transitions[currentPhase];
  if (!phaseTransitions) {
    console.warn(`[FSM] Unknown phase "${currentPhase}" for program "${programId}"`);
    return { nextPhase: null, requiresLLM: false, response: null };
  }

  // Look up the transition for this input type
  const transition = phaseTransitions[inputType] || phaseTransitions._default;

  if (!transition) {
    console.warn(
      `[FSM] No transition defined for program="${programId}", phase="${currentPhase}", input="${inputType}"`
    );
    return { nextPhase: null, requiresLLM: false, response: null };
  }

  // Return a copy to prevent mutation
  return { ...transition };
}

/**
 * Returns the initial phase for a given program.
 *
 * @param {string} programId
 * @returns {string|null}
 */
export function getInitialPhase(programId) {
  return PROGRAM_FSMS[programId]?.initial || null;
}

/**
 * Returns all valid phases for a given program.
 *
 * @param {string} programId
 * @returns {string[]}
 */
export function getProgramPhases(programId) {
  const fsm = PROGRAM_FSMS[programId];
  if (!fsm) return [];
  return Object.keys(fsm.transitions);
}

/**
 * Returns true if the given phase is a terminal (done/completed) phase.
 *
 * @param {string} phase
 * @returns {boolean}
 */
export function isTerminalPhase(phase) {
  return (
    phase === PHASES.BRIEFING_DONE ||
    phase === PHASES.FOCUS_COMPLETED ||
    phase === PHASES.REGROUP_RESUMED ||
    phase === PHASES.PREVIEW_DONE ||
    phase === PHASES.CALIBRATION_DONE
  );
}

/**
 * Returns true if the given phase requires an LLM call to generate the initial message.
 *
 * @param {string} programId
 * @param {string} phase
 * @returns {boolean}
 */
export function phaseRequiresLLM(programId, phase) {
  const fsm = PROGRAM_FSMS[programId];
  if (!fsm) return false;
  const transitions = fsm.transitions[phase];
  if (!transitions) return false;

  // A phase requires an LLM call if at least one of its transitions
  // has requiresLLM: true (the initial entry into this phase needs LLM)
  return Object.values(transitions).some(t => t && t.requiresLLM);
}
