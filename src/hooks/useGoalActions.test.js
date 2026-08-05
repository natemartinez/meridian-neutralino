/**
 * Tests for useGoalActions
 *
 * Covers:
 *   - deleteGoal closes the waypoint panel (Issue 1: auto-collapse after deletion)
 *   - deleteGoal removes the goal and clears selection/confirm state
 *   - completeGoal also closes the waypoint (existing contract preserved)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import useGoalActions from './useGoalActions.js';

/**
 * Minimal wrapper that renders the hook and exposes its return value via a
 * ref, so tests can inspect and call the returned handlers.
 */
function renderHookWithProps(props) {
  let latest = null;
  let captures = null;

  function Harness() {
    latest = useGoalActions(props);
    return null;
  }

  const utils = render(React.createElement(Harness));
  captures = () => latest;
  return { ...utils, current: captures };
}

function createDefaultProps(overrides = {}) {
  return {
    // State values (read)
    projects: [],
    selectedId: null,
    apiKey: 'sk-test-key',
    model: 'test-model',
    addInput: '',
    onwardForm: { title: '', hour: 9, goalId: null, priority: 'medium', duration: 60 },
    pendingDrop: null,
    onwardItems: [],
    freeformTasks: [],
    backlogItems: [],
    selected: null,
    knowledgePool: { entries: [] },
    novaState: { syncEvents: [] },
    novaInteractions: { fireEvent: vi.fn() },
    sunId: null,
    colorFor: (i) => `hsl(${i * 40}, 70%, 60%)`,

    // Setters
    setProjects: vi.fn(),
    setSelectedId: vi.fn(),
    setAiMsg: vi.fn(),
    setCompanionLoading: vi.fn(),
    setOnwardItems: vi.fn(),
    setOnwardForm: vi.fn(),
    setFreeformTasks: vi.fn(),
    setPendingDrop: vi.fn(),
    setDraggedTask: vi.fn(),
    setDragOverHour: vi.fn(),
    setPomodoroPreselect: vi.fn(),
    setFocusMode: vi.fn(),
    setSessions: vi.fn(),
    setBrainDumpEntries: vi.fn(),
    setJournalEntries: vi.fn(),
    setSkills: vi.fn(),
    setXpSkills: vi.fn(),
    setTopGoals: vi.fn(),
    setSunId: vi.fn(),
    setConfirmDelete: vi.fn(),
    setAddInput: vi.fn(),
    setBacklogItems: vi.fn(),

    // NOVA API
    addSyncEvent: vi.fn(),
    generateNovaPlan: vi.fn(),

    // Navigation helpers
    closeWaypoint: vi.fn(),
    setMainPage: vi.fn(),

    // Streak
    updateStreak: vi.fn(),

    ...overrides,
  };
}

describe('useGoalActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('deleteGoal (Issue 1: auto-collapse waypoint after deletion)', () => {
    it('calls closeWaypoint so the goals canvas auto-collapses', () => {
      const closeWaypoint = vi.fn();
      const setConfirmDelete = vi.fn();
      const r = renderHookWithProps(createDefaultProps({ closeWaypoint, setConfirmDelete }));

      act(() => {
        r.current().deleteGoal('g1');
      });

      expect(closeWaypoint).toHaveBeenCalledOnce();
    });

    it('removes the goal from projects', () => {
      const setProjects = vi.fn();
      const r = renderHookWithProps(createDefaultProps({ setProjects }));

      act(() => {
        r.current().deleteGoal('g1');
      });

      const updater = setProjects.mock.calls[0][0];
      expect(updater([{ id: 'g1' }, { id: 'g2' }])).toEqual([{ id: 'g2' }]);
    });

    it('clears the selected goal and the delete confirmation', () => {
      const setSelectedId = vi.fn();
      const setConfirmDelete = vi.fn();
      const r = renderHookWithProps(createDefaultProps({
        selectedId: 'g1',
        setSelectedId,
        setConfirmDelete,
      }));

      act(() => {
        r.current().deleteGoal('g1');
      });

      expect(setSelectedId).toHaveBeenCalledWith(null);
      expect(setConfirmDelete).toHaveBeenCalledWith(null);
    });
  });

  describe('completeGoal (existing contract)', () => {
    it('calls closeWaypoint when a goal is completed', () => {
      const closeWaypoint = vi.fn();
      const r = renderHookWithProps(createDefaultProps({ closeWaypoint }));

      act(() => {
        r.current().completeGoal('g1');
      });

      expect(closeWaypoint).toHaveBeenCalledOnce();
    });
  });
});
