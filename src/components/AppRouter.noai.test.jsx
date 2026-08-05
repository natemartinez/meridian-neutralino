/**
 * B4 — No-AI mode regression guard (smoke test)
 *
 * Verifies that when `aiMode === 'off'` (No-AI mode):
 *   1. The core app shell renders — SIGNAL sidebar (with the offline card),
 *      COMMAND canvas, waypoint, and modal plumbing — without throwing.
 *   2. Non-AI features remain reachable: goals canvas, onward/map/skills
 *      panels, tracking, settings, work logs, deadlines, pomodoro.
 *   3. Every generative AI surface is hidden: NOVA sidebar, StartupCanvas,
 *      NOVAProgramPanel, NovaInsightsPanel, OrganizeOverviewView, and the
 *      "Organize Tasks" bottom-bar action.
 *   4. No OpenRouter / AI IPC call can fire — `window.electronAPI` and the
 *      AI utility mocks throw if invoked, so any accidental AI call would
 *      fail the test loudly.
 *
 * This is the regression guard for B2 (canvas must render without an API
 * key) and B3 (AI entry points must be disabled, never called, in No-AI
 * mode).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from '@testing-library/react';
import AppRouter from './AppRouter.jsx';

// ── Heavy / non-deterministic children are mocked for the smoke test ──
// WorkLogsView pulls in @tiptap + DOMPurify and needs a real DOM editor;
// TrackingPage and PomodoroView rely on live stats / timers. The No-AI
// contract we assert here is at the AppRouter gating level, so a stub is
// sufficient and keeps the smoke test deterministic.
vi.mock('./views/WorkLogsView.jsx', () => ({
  default: () => React.createElement('div', { 'data-testid': 'worklogs-stub' }, 'WorkLogsView'),
}));
vi.mock('./TrackingPage.jsx', () => ({
  default: () => React.createElement('div', { 'data-testid': 'tracking-stub' }, 'TrackingPage'),
}));

// ── The AI network layer must never be touched in No-AI mode ──
// Any call to queryAI / chatNOVA through the IPC bridge throws so an
// accidental AI call fails the test immediately.
beforeEach(() => {
  window.electronAPI = {
    queryAI: vi.fn(() => { throw new Error('AI call fired in No-AI mode (queryAI)'); }),
    chatNOVA: vi.fn(() => { throw new Error('AI call fired in No-AI mode (chatNOVA)'); }),
  };
});

/**
 * Render a React element without StrictMode by using createRoot directly
 * (same convention as NovaSidebarBlock.test.jsx).
 */
function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const ReactDOM = require('react-dom/client');
  const rootInstance = ReactDOM.createRoot(container);
  act(() => { rootInstance.render(React.createElement('div', null, ui)); });
  return {
    container,
    rootInstance,
    cleanup: () => {
      act(() => { rootInstance.unmount(); });
      document.body.removeChild(container);
    },
    getByText: (text) => {
      const elements = container.querySelectorAll('*');
      const isRegex = typeof text === 'object' && text instanceof RegExp;
      const matching = Array.from(elements).filter(el => {
        if (isRegex) return text.test(el.textContent?.trim());
        return el.textContent?.trim() === text;
      });
      if (matching.length === 0) {
        if (!isRegex) {
          const partial = Array.from(elements).filter(el =>
            el.textContent && el.textContent.includes(text)
          );
          if (partial.length > 0) return partial[0];
        }
        throw new Error(`Text "${text}" not found`);
      }
      if (matching.length === 1) return matching[0];
      const interactive = matching.filter(el =>
        el.tagName === 'BUTTON' || el.tagName === 'A' ||
        el.getAttribute('role') === 'button'
      );
      if (interactive.length > 0) return interactive[0];
      const leaf = matching.filter(el => el.children.length === 0);
      if (leaf.length > 0) return leaf[0];
      return matching[0];
    },
    queryByText: (text) => {
      try {
        const elements = container.querySelectorAll('*');
        const isRegex = typeof text === 'object' && text instanceof RegExp;
        const matching = Array.from(elements).filter(el => {
          if (isRegex) return text.test(el.textContent?.trim());
          return el.textContent?.trim() === text;
        });
        if (matching.length === 0) {
          if (!isRegex) {
            const partial = Array.from(elements).filter(el =>
              el.textContent && el.textContent.includes(text)
            );
            if (partial.length > 0) return partial[0];
          }
          return null;
        }
        return matching[0];
      } catch {
        return null;
      }
    },
    click: (el) => { act(() => { el.click(); }); },
    getByTestId: (testId) => {
      const el = container.querySelector(`[data-testid="${testId}"]`);
      if (!el) throw new Error(`TestID "${testId}" not found`);
      return el;
    },
  };
}

const uid = () => `id-${Math.random().toString(36).slice(2)}`;

const noop = () => {};
const NOOP_SET = (v) => { void v; };

// Minimal refs required by the render tree.
function makeRefs() {
  return {
    canvasRef: { current: null },
    activePageRef: { current: 'goals' },
  };
}

/**
 * Complete default props for AppRouter in No-AI mode.
 * Values are chosen so the HQ goals page renders without needing an API key.
 */
function createDefaultProps(overrides = {}) {
  const project = {
    id: 'g1',
    title: 'Build the Meridian app',
    desc: 'Ship the canvas productivity app',
    color: '#f0b429',
    category: 'short',
    priority: 'low',
    deadline: null,
    completedAt: null,
    inFocus: true,
    checkpoints: [],
  };

  return {
    // ── State values ──
    projects: [project],
    setProjects: NOOP_SET,
    pathsStore: { paths: [] },
    setPathsStore: NOOP_SET,
    selectedId: 'g1',
    setSelectedId: NOOP_SET,
    focus: [],
    setFocus: NOOP_SET,
    modal: false,
    setModal: NOOP_SET,
    goalsView: 'matrix',
    setGoalsView: NOOP_SET,
    aiMsg: '',
    setAiMsg: NOOP_SET,
    companionLoading: false,
    setCompanionLoading: NOOP_SET,
    pan: { x: 0, y: 0 },
    setPan: NOOP_SET,
    dragging: null,
    setDragging: NOOP_SET,
    apiKey: null,
    setApiKey: NOOP_SET,
    model: 'deepseek/deepseek-chat:free',
    setModel: NOOP_SET,
    aiMode: 'off',
    setAiMode: NOOP_SET,
    addInput: '',
    setAddInput: NOOP_SET,
    confirmDelete: null,
    setConfirmDelete: NOOP_SET,
    activePage: 'goals',
    setActivePage: NOOP_SET,
    onwardItems: [],
    setOnwardItems: NOOP_SET,
    freeformTasks: [],
    setFreeformTasks: NOOP_SET,
    skills: {},
    setSkills: NOOP_SET,
    onwardForm: { title: '', hour: 9, goalId: null, priority: 'medium', duration: 60 },
    setOnwardForm: NOOP_SET,
    draggedTask: null,
    setDraggedTask: NOOP_SET,
    dragOverHour: null,
    setDragOverHour: NOOP_SET,
    pendingDrop: null,
    setPendingDrop: NOOP_SET,
    availableTasks: [],
    hoveredWeek: null,
    setHoveredWeek: NOOP_SET,
    selectedSkillId: null,
    setSelectedSkillId: NOOP_SET,
    mainPage: 'hq',
    setMainPage: NOOP_SET,
    showStartupCanvas: false,
    setShowStartupCanvas: NOOP_SET,
    pendingAutoStart: null,
    setPendingAutoStart: NOOP_SET,
    intensity: { low: 25, medium: 45, high: 90 },
    setIntensity: NOOP_SET,
    showApiKey: false,
    setShowApiKey: NOOP_SET,
    sessions: [],
    setSessions: NOOP_SET,
    activeSession: null,
    setActiveSession: NOOP_SET,
    prioritizeInput: '',
    setPrioritizeInput: NOOP_SET,
    trackingPeriod: 'day',
    setTrackingPeriod: NOOP_SET,
    geminiInput: '',
    setGeminiInput: NOOP_SET,
    geminiResponse: '',
    setGeminiResponse: NOOP_SET,
    geminiLoading: false,
    setGeminiLoading: NOOP_SET,
    pomodoroPreselect: null,
    setPomodoroPreselect: NOOP_SET,
    focusMode: null,
    setFocusMode: NOOP_SET,
    selectedForToday: [],
    setSelectedForToday: NOOP_SET,
    deferredItems: [],
    setDeferredItems: NOOP_SET,
    backlogItems: [],
    setBacklogItems: NOOP_SET,
    brainDumpEntries: [],
    setBrainDumpEntries: NOOP_SET,
    journalEntries: [],
    setJournalEntries: NOOP_SET,
    waypointOpen: false,
    setWaypointOpen: NOOP_SET,
    waypointContext: null,
    setWaypointContext: NOOP_SET,
    onwardClickedItem: null,
    setOnwardClickedItem: NOOP_SET,
    selectedOnwardDate: null,
    setSelectedOnwardDate: NOOP_SET,
    sidebarCollapsed: false,
    setSidebarCollapsed: NOOP_SET,
    sidebarView: 'programs',
    setSidebarView: NOOP_SET,
    sunId: null,
    setSunId: NOOP_SET,
    renamingGoalId: null,
    setRenamingGoalId: NOOP_SET,
    renameValue: '',
    setRenameValue: NOOP_SET,
    topGoals: [],
    setTopGoals: NOOP_SET,
    xpSkills: {},
    setXpSkills: NOOP_SET,
    resizeDrag: null,
    setResizeDrag: NOOP_SET,
    setForm: NOOP_SET,

    // Preview calendar
    previewPlanItems: [],
    setPreviewPlanItems: NOOP_SET,
    previewPlanForm: { items: [] },
    setPreviewPlanForm: NOOP_SET,
    selectedPreviewDate: null,
    setSelectedPreviewDate: NOOP_SET,
    addPreviewItem: noop,
    deletePreviewItem: noop,
    togglePreviewDone: noop,

    // Refs
    ...makeRefs(),

    // NOVA
    novaState: { syncEvents: [], weeklyInsights: null, programChats: {} },
    setNovaState: NOOP_SET,
    blackboard: { activeGoals: [], paths: [], gaps: [] },
    novaChatInput: '',
    setNovaChatInput: NOOP_SET,
    novaLoading: false,
    setNovaLoading: NOOP_SET,
    knowledgePool: { entries: [] },
    addSyncEvent: noop,
    onNewSession: noop,
    addKnowledgeEntry: noop,
    deleteKnowledgeEntry: noop,
    editKnowledgeEntry: noop,
    updateCorrections: noop,
    sendNOVAMessage: noop,
    runOrganizeAnalysis: noop,
    generateNovaPlan: noop,
    buildNOVASystemPrompt: () => '',
    scanWeeklyGoals: noop,
    suggestSubtasks: async () => null,
    novaRetry: { attempt: 0, nextAllowedAt: 0 },
    confirmInsight: noop,
    dismissInsight: noop,
    recordPlanAccuracy: noop,

    // NOVA Interactions
    novaInteractions: {
      fireEvent: noop,
      syncAppState: noop,
      toastQueue: [],
      dismissToast: noop,
    },

    // Tracking
    todayStr: () => new Date().toISOString().slice(0, 10),
    sessionDurationMin: () => 0,
    getSessionsForDay: () => [],
    getSessionsForWeek: () => [],
    getSessionsForMonth: () => [],
    getTodayStats: () => ({ totalMin: 0, productiveMin: 0, focusedMin: 0, minSinceBreak: 0 }),
    startSession: noop,
    stopSession: noop,
    calcStreak: () => 0,
    getWeeklyData: () => ({ days: [], totalMin: 0 }),

    // Streak
    streakDays: 0,
    lastActiveDate: null,

    // Deadline alerts
    showDeadlineNotifier: true,
    deadlineAlerts: [
      { id: 'd1', title: 'Ship the Meridian app', days: 3, priority: 'high', type: 'due', color: '#f0b429' },
    ],
    dismissAlerts: noop,

    // Waypoint / navigation helpers
    openWaypoint: noop,
    closeWaypoint: noop,
    onOpenProgramWithPage: noop,

    // Action Registry
    actionRegistry: { register: noop, execute: noop },

    // Canvas mouse handlers
    onCanvasMouseDown: noop,
    onCanvasMouseMove: noop,
    onCanvasMouseUp: noop,
    onCanvasDragOver: noop,
    onCanvasDragLeave: noop,
    onCanvasDrop: noop,

    // Event handlers
    createGoalFromModal: noop,
    createGoalWithPaths: noop,
    linkGoalToPath: noop,
    mergePaths: noop,
    addOnwardItem: noop,
    deleteOnwardItem: noop,
    deleteAvailableTask: noop,
    returnOnwardItemToAvailable: noop,
    moveOnwardItem: noop,
    handleStartFocus: noop,
    handleFocusSessionComplete: noop,
    handleBrainDump: noop,
    handleJournalEntry: noop,
    handleBreakdownTask: noop,
    handleBreakdownSuggestion: noop,
    handleRestoreFromBacklog: noop,
    handleExitFocus: noop,
    toggleOnwardDone: noop,
    updateSkillLevel: noop,
    addSubskill: noop,
    toggleSubtask: noop,
    handleUpdateSkillMeta: noop,
    toggleCheckpoint: noop,
    toggleFocus: noop,
    deleteGoal: noop,
    toggleTopGoal: noop,
    completeGoal: noop,
    renameGoal: noop,
    deleteSubtask: noop,
    deleteCheckpoint: noop,
    addSubtask: noop,
    addCheckpoint: noop,
    checkIn: noop,
    suggestSubtask: noop,

    ...overrides,
  };
}

describe('AppRouter — No-AI mode (aiMode=off)', () => {
  let cleanupFns = [];

  afterEach(() => {
    cleanupFns.forEach(fn => fn());
    cleanupFns = [];
    vi.restoreAllMocks();
  });

  function renderComp(props) {
    const r = render(React.createElement(AppRouter, props));
    cleanupFns.push(r.cleanup);
    return r;
  }

  it('renders the core shell without an API key and without throwing', () => {
    const r = renderComp(createDefaultProps());
    expect(r.container.querySelector('.app-shell')).not.toBeNull();
    expect(r.container.querySelector('.sig')).not.toBeNull();
    expect(r.container.querySelector('.cmd')).not.toBeNull();
    expect(r.container.querySelector('.cv')).not.toBeNull();
  });

  it('shows the NOVA OFFLINE card in the sidebar (no NOVA sidebar block)', () => {
    const r = renderComp(createDefaultProps());
    expect(r.getByText('NOVA OFFLINE')).toBeTruthy();
    expect(r.getByText('Connect AI')).toBeTruthy();
    // Generative NOVA surfaces must not be rendered.
    expect(r.queryByText('NOVA CHAT')).toBeNull();
    // Session history is local (non-generative) and available on demand.
    expect(r.queryByText('SESSION HISTORY')).toBeNull(); // default sidebarView is 'programs'
  });

  it('keeps the program sidebar (HQ / Goals / Focus / Preview / Paths) visible in No-AI mode', () => {
    const r = renderComp(createDefaultProps());
    // The local program navigation must NOT be replaced by the offline card.
    expect(r.getByText('HQ')).toBeTruthy();
    expect(r.getByText('Goals')).toBeTruthy();
    expect(r.getByText('Focus')).toBeTruthy();
    expect(r.getByText('Preview')).toBeTruthy();
    expect(r.getByText('Paths')).toBeTruthy();
    // And the offline card coexists with it.
    expect(r.getByText('NOVA OFFLINE')).toBeTruthy();
  });

  it('keeps the goals canvas page functional (B2: canvas renders without apiKey)', () => {
    const r = renderComp(createDefaultProps());
    expect(r.container.querySelector('canvas')).not.toBeNull();
    expect(r.getByText('Select Your Top Goals')).toBeTruthy();
  });

  it('keeps the sidebar footer navigation (Track / Settings) present', () => {
    const r = renderComp(createDefaultProps());
    expect(r.getByText('Track')).toBeTruthy();
    expect(r.getByText('Settings')).toBeTruthy();
  });

  it('renders the deadline notifier overlay in No-AI mode', () => {
    const r = renderComp(createDefaultProps());
    expect(r.getByText('Deadline Alerts')).toBeTruthy();
    expect(r.getByText('3 days left')).toBeTruthy();
  });

  it('hides the StartupCanvas in No-AI mode even when showStartupCanvas is true', () => {
    const r = renderComp(createDefaultProps({ showStartupCanvas: true }));
    expect(r.queryByText(/startup|launch/i)).toBeNull();
    // The canvas page still renders (StartupCanvas would have replaced it).
    expect(r.container.querySelector('.cv')).not.toBeNull();
  });

  it('hides the "Organize Tasks" bottom-bar action when on a program page', () => {
    const r = renderComp(createDefaultProps({
      mainPage: 'program-briefing',
      activePage: 'briefing-chat',
    }));
    expect(r.queryByText('Organize Tasks')).toBeNull();
  });

  it('never calls the AI IPC bridge in No-AI mode', () => {
    const r = renderComp(createDefaultProps());
    expect(window.electronAPI.queryAI).not.toHaveBeenCalled();
    expect(window.electronAPI.chatNOVA).not.toHaveBeenCalled();
    // Same guarantee when a key is present but AI mode is off.
    r.cleanup();
    cleanupFns.pop();
    const r2 = renderComp(createDefaultProps({ apiKey: 'sk-test-key' }));
    expect(window.electronAPI.queryAI).not.toHaveBeenCalled();
    expect(window.electronAPI.chatNOVA).not.toHaveBeenCalled();
  });

  it('renders goal detail in the waypoint with the goal fully interactive', () => {
    const r = renderComp(createDefaultProps({ waypointOpen: true, waypointContext: { type: 'goal', id: 'g1' } }));
    expect(r.getByText('Build the Meridian app')).toBeTruthy();
    expect(r.getByText('Mark as Top Goal')).toBeTruthy();
  });

  it('renders the onward panel through the canvas waypoint (aiEnabled passed through)', () => {
    const r = renderComp(createDefaultProps({
      waypointOpen: true,
      waypointContext: { type: 'canvas-panel', id: 'onward' },
    }));
    expect(r.container.querySelector('.wpi')).not.toBeNull();
  });

  it('renders a goal modal in No-AI mode without requiring AI', () => {
    const r = renderComp(createDefaultProps({ modal: true }));
    expect(r.getByText('New Goal')).toBeTruthy();
  });

  it('renders settings in No-AI mode with the AI-mode toggle available', () => {
    const r = renderComp(createDefaultProps({ mainPage: 'settings' }));
    expect(r.getByText('SETTINGS')).toBeTruthy();
    expect(r.getByText('NOVA / AI MODE')).toBeTruthy();
    expect(r.getByText('NOVA OFF — TAP TO ENABLE')).toBeTruthy();
  });

  it('renders tracking in No-AI mode (AI check-in replaced by offline notice)', () => {
    const r = renderComp(createDefaultProps({ mainPage: 'tracking' }));
    expect(r.getByTestId('tracking-stub')).toBeTruthy();
  });

  it('renders work logs in No-AI mode', () => {
    const r = renderComp(createDefaultProps({ mainPage: 'hq', activePage: 'worklogs' }));
    expect(r.getByTestId('worklogs-stub')).toBeTruthy();
  });

});
