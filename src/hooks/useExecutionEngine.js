/**
 * useExecutionEngine — Hybrid Game-AI Execution Engine
 *
 * Composes three layers into a single `processUserInput` function:
 *
 *   1. **Blackboard** (read-only state aggregate) — provides the LLM with a
 *      minimal JSON snapshot of the current app state
 *   2. **Action Registry** (state-mutating interfaces) — wraps hook functions
 *      as actions with precondition checks
 *   3. **Program FSM** (deterministic state machines) — drives phase transitions
 *      based on input type, determining when LLM calls are needed vs. when
 *      transitions are deterministic
 *
 * The engine exposes:
 *   - `processUserInput(text, programId)` — the main entry point for user input
 *   - `fsmState` — current { program, phase } for the active program
 *   - `setProgram(programId)` — initialize/switch to a program
 *   - `resetProgram(programId)` — reset a program back to its initial phase
 *   - `getAvailableActions(blackboard)` — filtered actions for the current context
 *
 * @module useExecutionEngine
 */
import { useState, useCallback, useRef } from 'react';
import { resolveTransition, getInitialPhase } from '../engine/programFSM.js';
import { INPUT } from '../engine/programFSM.js';

// ── Input Type Classifier ────────────────────────────────────────────────────

/**
 * Classifies raw user text into an INPUT type for the FSM resolver.
 *
 * Heuristics:
 *   - "confirm", "yes", "ready", "looks good", "proceed" → CONFIRM
 *   - "no", "that's wrong", "actually", "not quite", "correct" → CORRECT
 *   - "stuck", "blocked", "can't focus", "lost momentum" → STUCK_SIGNAL
 *   - "done", "finished", "all done", "complete" → ALL_DONE
 *   - "refocused", "back on track", "ready to go" → REFOCUSED
 *   - "accept", "looks good", "let's do it" (in plan_generation) → PLAN_ACCEPTED
 *   - "reject", "no good", "try again", "different plan" → PLAN_REJECTED
 *   - Numeric 1-5 → RATING
 *   - Everything else → TEXT
 *
 * @param {string} text - Raw user input
 * @param {string|null} currentPhase - Current FSM phase (for context-sensitive classification)
 * @returns {string} One of the INPUT constants
 */
export function classifyInput(text, currentPhase = null) {
  if (!text || typeof text !== 'string') return INPUT.TEXT;

  const trimmed = text.trim().toLowerCase();

  // Rating detection (1-5)
  if (/^[1-5]$/.test(trimmed)) return INPUT.RATING;
  if (/^(?:a\s+)?([1-5])\s*(?:\/|out\s+of)?\s*5$/.test(trimmed)) return INPUT.RATING;

  // Stuck signal
  if (/^(?:i'?m\s+)?(?:stuck|blocked|(?:i\s+)?(?:can'?t|cannot?)\s+focus|lost\s+momentum)/.test(trimmed)) {
    return INPUT.STUCK_SIGNAL;
  }

  // Refocused
  if (/^(?:i'?m\s+)?(?:refocused|back\s+on\s+track|ready\s+to\s+go|let'?s\s+resume)/.test(trimmed)) {
    return INPUT.REFOCUSED;
  }

  // All done
  if (/^(?:all\s+)?(?:done|finished|complete)\s*$/.test(trimmed)) return INPUT.ALL_DONE;

  // Plan accepted (context-sensitive: only in plan_generation phase)
  if (currentPhase && currentPhase.includes('plan_generation')) {
    if (/^(?:accept|looks?\s+good|let'?s\s+do\s+it|proceed|start)/.test(trimmed)) {
      return INPUT.PLAN_ACCEPTED;
    }
    if (/^(?:reject|no\s+good|try\s+again|different|change|regenerate|nope?)/.test(trimmed)) {
      return INPUT.PLAN_REJECTED;
    }
  }

  // Confirm
  if (/^(?:yes|yeah|sure|ok|okay|confirm|ready|looks?\s+good|proceed|correct|that'?s?\s+right|go\s+ahead)/.test(trimmed)) {
    return INPUT.CONFIRM;
  }

  // Correct (disagreement)
  if (/^(?:no|nah|not\s+(?:quite|really|exactly)|that'?s?\s+(?:wrong|not\s+right|incorrect)|actually|wait)/.test(trimmed)) {
    return INPUT.CORRECT;
  }

  return INPUT.TEXT;
}

// ── Default Export ───────────────────────────────────────────────────────────

/**
 * Creates the Execution Engine hook.
 *
 * @param {object} options
 * @param {Function} options.chatWithLLM - Async function (messages[]) => reply string
 *   The engine calls this when the FSM determines an LLM call is needed.
 *   Expected signature: async (messages) => string
 * @param {Function} options.buildSystemPrompt - (programId, phase, blackboard) => string
 *   Builds the system prompt for the current program + phase.
 * @param {object} options.actionRegistry - The action registry from createActionRegistry()
 *   Must have: actions[], dispatch(id, params, bb), getAvailableActions(bb)
 * @param {Function} options.getBlackboard - () => blackboard object
 *   Lazily gets the current blackboard (to avoid stale closures).
 * @param {Function} options.onPhaseTransition - (programId, fromPhase, toPhase) => void
 *   Optional callback fired after each phase transition (for logging, analytics, etc.)
 * @param {Function} options.onLLMResponse - (programId, phase, response) => void
 *   Optional callback fired after each LLM response (for storing in chat history, etc.)
 * @param {Function} options.onError - (error) => void
 *   Optional error handler
 * @returns {{ fsmState, setProgram, resetProgram, processUserInput, getAvailableActions }}
 */
export function useExecutionEngine({
  chatWithLLM,
  buildSystemPrompt,
  actionRegistry,
  getBlackboard,
  onPhaseTransition,
  onLLMResponse,
  onError,
}) {
  // FSM state: { program: string|null, phase: string|null }
  const [fsmState, setFsmState] = useState({ program: null, phase: null });

  // Ref to track loading state without re-render
  const loadingRef = useRef(false);

  /**
   * Initialize or switch to a program. Resets to the program's initial phase.
   *
   * @param {string} programId - 'briefing' | 'focus' | 'regroup' | 'preview' | 'calibration'
   */
  const setProgram = useCallback((programId) => {
    const initialPhase = getInitialPhase(programId);
    setFsmState({ program: programId, phase: initialPhase });
    onPhaseTransition?.(programId, null, initialPhase);
  }, [onPhaseTransition]);

  /**
   * Reset a specific program back to its initial phase.
   *
   * @param {string} programId
   */
  const resetProgram = useCallback((programId) => {
    const initialPhase = getInitialPhase(programId);
    setFsmState(prev => {
      if (prev.program !== programId) return prev;
      onPhaseTransition?.(programId, prev.phase, initialPhase);
      return { ...prev, phase: initialPhase };
    });
  }, [onPhaseTransition]);

  /**
   * Get available actions filtered by the current blackboard state.
   *
   * @param {object} blackboard
   * @returns {Array<{ id: string, label: string, cost: number, category: string }>}
   */
  const getAvailableActions = useCallback((blackboard) => {
    if (!actionRegistry) return [];
    return actionRegistry.getAvailableActions(blackboard);
  }, [actionRegistry]);

  /**
   * Main entry point for processing user input within a program.
   *
   * Flow:
   *   1. Classify the input text into an INPUT type
   *   2. Resolve the FSM transition
   *   3. If LLM call needed: build prompt, call LLM, dispatch returned actions
   *   4. If deterministic: return the pre-defined response
   *   5. Update FSM state
   *
   * @param {string} text - The user's input text
   * @param {string} programId - The active program ID
   * @returns {Promise<{ response: string|null, requiresLLM: boolean, nextPhase: string|null, actions: Array }>}
   */
  const processUserInput = useCallback(async (text, programId) => {
    if (loadingRef.current) {
      return { response: null, requiresLLM: false, nextPhase: null, actions: [] };
    }

    const currentPhase = fsmState.program === programId ? fsmState.phase : null;

    // Step 1: Classify input
    const inputType = classifyInput(text, currentPhase);

    // Step 2: Resolve FSM transition
    const transition = resolveTransition(programId, currentPhase, inputType);

    if (!transition) {
      const err = new Error(`[Engine] No transition resolved for program="${programId}" phase="${currentPhase}" input="${inputType}"`);
      onError?.(err);
      return { response: null, requiresLLM: false, nextPhase: null, actions: [] };
    }

    const { nextPhase, requiresLLM, response: deterministicResponse } = transition;

    // Step 3: Update FSM state
    if (nextPhase && nextPhase !== currentPhase) {
      setFsmState(prev => {
        const newState = { ...prev, phase: nextPhase };
        onPhaseTransition?.(programId, currentPhase, nextPhase);
        return newState;
      });
    }

    // Step 4: Handle deterministic transitions (no LLM call)
    if (!requiresLLM) {
      return {
        response: deterministicResponse,
        requiresLLM: false,
        nextPhase,
        actions: [],
      };
    }

    // Step 5: LLM call needed
    loadingRef.current = true;
    try {
      const blackboard = getBlackboard?.() || {};
      const systemPrompt = buildSystemPrompt?.(programId, currentPhase, blackboard) || '';

      // Build message history
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ];

      const llmResponse = await chatWithLLM(messages);

      // Notify caller of the LLM response
      onLLMResponse?.(programId, currentPhase, llmResponse);

      // Parse actions from LLM response (if structured JSON)
      let actions = [];
      try {
        const parsed = JSON.parse(llmResponse.trim());
        if (Array.isArray(parsed.actions)) {
          actions = parsed.actions;
        }
      } catch {
        // Response is plain text — no structured actions
      }

      // Dispatch any actions through the registry
      const actionResults = [];
      if (actionRegistry && actions.length > 0) {
        for (const actionId of actions) {
          const result = actionRegistry.dispatch(actionId, {}, blackboard);
          actionResults.push({ actionId, ...result });
        }
      }

      return {
        response: llmResponse,
        requiresLLM: true,
        nextPhase,
        actions: actionResults,
      };
    } catch (error) {
      onError?.(error);
      return {
        response: null,
        requiresLLM: true,
        nextPhase: null,
        actions: [],
        error: error.message,
      };
    } finally {
      loadingRef.current = false;
    }
  }, [fsmState, chatWithLLM, buildSystemPrompt, actionRegistry, getBlackboard, onPhaseTransition, onLLMResponse, onError]);

  return {
    fsmState,
    setProgram,
    resetProgram,
    processUserInput,
    getAvailableActions,
  };
}
