import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { T, NODE_PALETTE } from '../utils/theme.js';
import { uid, projectPos, DEFAULT_SKILLS } from '../utils/helpers.js';
import { INITIAL_SKILLS, addSkillEvidence, updateSkillMeta } from '../constants/skills.js';
import { computePlanningConfidence, determineAutoStartProgram } from '../utils/nova.js';
import { useNOVA } from './useNOVA.js';
import useTracking from './useTracking.js';
import useLocalStorageSync from './useLocalStorageSync.js';
import useLocalStorageState from './useLocalStorageState.js';
import useStreak from './useStreak.js';
import useDeadlineAlerts from './useDeadlineAlerts.js';
import { useOnwardScroll } from './useOnwardScroll.js';
import { useNovaInteractions } from './useNovaInteractions.js';
import { registerPatterns, useNovaInteractionStore } from '../store/novaInteractionStore.js';
import { PATTERNS } from '../constants/novaInteractions.js';
import { PROGRAM_DEFAULT_PAGES } from '../constants/programs.js';

export default function useAppState() {
  // ── Core state ──
  const [projects, setProjects]     = useLocalStorageState('meridian_projects_v2', []);
  const [selectedId, setSelectedId] = useState(null);
  const [focus, setFocus]           = useState(["", "", ""]);
  const [modal, setModal]           = useState(false);
  const [, setForm]                 = useState({ title: "", desc: "", measurable: "", achievable: "", relevant: "", deadline: "", priority: "low", scale: "short" });
  const [aiMsg, setAiMsg]           = useState("");
  const [companionLoading, setCompanionLoading] = useState(false);
  const [pan, setPan]               = useState({ x: 0, y: 0 });
  const [dragging, setDragging]     = useState(null);
  const [loaded, setLoaded]         = useState(false);
  const [apiKey, setApiKey]         = useState(() => localStorage.getItem('meridian_api_key') || null);
  const [model, setModel]           = useState(() => localStorage.getItem('meridian_model') || '');
  const [, setPlanningDay]          = useState(false);
  const [addInput, setAddInput]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Compass/page state
  const [activePage, setActivePage]           = useState('goals');
  const [onwardItems, setOnwardItems]         = useLocalStorageState('meridian_onward_v2', []);
  const [freeformTasks, setFreeformTasks]     = useLocalStorageState('meridian_freeform_tasks', []);
  const [skills, setSkills]                   = useState([]);
  const [onwardForm, setOnwardForm]           = useState({ title:'', hour:480, priority:'low', goalId:null });

  // Drag and drop state for subtasks/checkpoints to time blocks
  const [draggedTask, setDraggedTask]         = useState(null);
  const [dragOverHour, setDragOverHour]       = useState(null);
  const [pendingDrop, setPendingDrop]         = useState(null);

  // Compute available incomplete subtasks/checkpoints from all goals
  const availableTasks = useMemo(() => {
    const scheduledIds = new Set(
      onwardItems.filter(it => it.linkedId).map(it => `${it.linkedType}:${it.linkedId}`)
    );
    const tasks = [];
    projects.forEach(proj => {
      proj.subtasks?.filter(st => !st.done && !scheduledIds.has(`subtask:${st.id}`)).forEach(st => {
        tasks.push({
          type: 'subtask',
          id: st.id,
          title: st.title,
          goalId: proj.id,
          goalTitle: proj.title,
          goalColor: proj.color
        });
      });
      proj.checkpoints?.filter(cp => !cp.done && !scheduledIds.has(`checkpoint:${cp.id}`)).forEach(cp => {
        tasks.push({
          type: 'checkpoint',
          id: cp.id,
          title: cp.title,
          goalId: proj.id,
          goalTitle: proj.title,
          goalColor: proj.color
        });
      });
    });
    freeformTasks.forEach(ft => {
      const proj = projects.find(p => p.id === ft.goalId);
      tasks.push({
        type: 'freeform',
        id: ft.id,
        title: ft.title,
        goalId: ft.goalId,
        goalTitle: proj?.title || '',
        goalColor: proj?.color || '#888'
      });
    });
    return tasks;
  }, [projects, onwardItems, freeformTasks]);

  const [hoveredWeek, setHoveredWeek]         = useState(null);
  const [selectedSkillId, setSelectedSkillId] = useState(null);

  // Top-level navigation
  const [mainPage, setMainPage]           = useState('hq');
  const [showStartupCanvas, setShowStartupCanvas] = useState(true);
  const [pendingAutoStart, setPendingAutoStart]   = useState(null);
  const [intensity, setIntensity]         = useState({ low:35, medium:55, high:75 });
  const [showApiKey, setShowApiKey]       = useState(false);
  const [showMindCheckCard, setShowMindCheckCard] = useState(false);
  const [sessions, setSessions]                   = useState([]);
  const [activeSession, setActiveSession]         = useState(null);
  const [prioritizeInput, setPrioritizeInput]     = useState('');
  const [trackingPeriod, setTrackingPeriod]       = useState('day');
  const [geminiInput, setGeminiInput]             = useState('');
  const [geminiResponse, setGeminiResponse]       = useState('');
  const [geminiLoading, setGeminiLoading]         = useState(false);
  const [pomodoroPreselect, setPomodoroPreselect] = useState(null);
  const [routines, setRoutines] = useState([
    { id:'r1', phase:'before', text:'Review the goal tied to this task' },
    { id:'r2', phase:'before', text:'Clear distractions' },
    { id:'r3', phase:'during', text:'Stay focused on one thing' },
    { id:'r4', phase:'during', text:'Take short breaks if needed' },
    { id:'r5', phase:'after',  text:'Reflect on what was accomplished' },
    { id:'r6', phase:'after',  text:'Note what to pick up next' },
  ]);

  // ── Ingestion & Smart Sorting state ──
  const [focusMode, setFocusMode] = useState(null);
  const [selectedForToday, setSelectedForToday] = useLocalStorageState('meridian_selected_today', []);
  const [deferredItems, setDeferredItems] = useLocalStorageState('meridian_deferred', []);
  const [backlogItems, setBacklogItems] = useLocalStorageState('meridian_backlog', []);
  const [brainDumpEntries, setBrainDumpEntries] = useLocalStorageState('meridian_brain_dump', []);
  const [journalEntries, setJournalEntries] = useLocalStorageState('meridian_journal', []);

  const [waypointOpen, setWaypointOpen]       = useState(false);
  const [waypointContext, setWaypointContext] = useState(null);

  const [onwardClickedItem, setOnwardClickedItem] = useState(null);
  const [selectedOnwardDate, setSelectedOnwardDate] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sunId, setSunId] = useLocalStorageState('meridian_sun_id', null);
  const [companionName, setCompanionName] = useLocalStorageState('meridian_companion_name', 'AI Companion');

  // ── NOVA ──
  const {
    novaState, setNovaState,
    novaChatInput, setNovaChatInput,
    novaLoading,
    knowledgePool,
    addSyncEvent,
    onNewSession,
    addKnowledgeEntry,
    deleteKnowledgeEntry,
    editKnowledgeEntry,
    updateCorrections,
    sendNOVAMessage,
    generateNovaPlan,
    buildNOVASystemPrompt,
    scanWeeklyGoals,
    novaRetry,
    confirmInsight,
    dismissInsight,
    recordPlanAccuracy,
  } = useNOVA({ apiKey, model, projects, focus, waypointContext, loaded, pendingAutoStart, setPendingAutoStart });

  // ── NOVA Active Interactions ──
  const novaInteractions = useNovaInteractions();

  // Register interaction patterns once on mount
  useEffect(() => {
    registerPatterns(PATTERNS);
  }, []);

  const [renamingGoalId, setRenamingGoalId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [topGoals, setTopGoals] = useLocalStorageState('meridian_top_goals', []);

  // Deadline notifier
  const { showDeadlineNotifier, deadlineAlerts, dismissAlerts } = useDeadlineAlerts(projects, loaded);

  // XP-based skills (separate from slider-based skills used by canvas/SkillsPanel)
  const [xpSkills, setXpSkills] = useState(() => {
    try {
      const saved = localStorage.getItem('meridian_skills');
      if (!saved) return INITIAL_SKILLS;
      const parsed = JSON.parse(saved);

      // Migration: convert old XP-based format to new evidence-based format
      const needsMigration = Object.values(parsed).some(g =>
        Object.values(g.skills || {}).some(s => s.xp !== undefined)
      );

      if (needsMigration) {
        const migrated = structuredClone(parsed);
        for (const group of Object.values(migrated)) {
          for (const [skillName, skill] of Object.entries(group.skills || {})) {
            if (skill.xp !== undefined) {
              // Convert XP to hours (approximate: 1 XP ≈ 15 min of practice)
              const hours = Math.round(skill.xp / 4);
              group.skills[skillName] = {
                hours: hours,
                lastApplied: skill.lastCompleted,
                evidenceCount: Math.floor(skill.xp / 10),
                evidence: [],
                notes: '',
              };
            }
          }
        }
        return migrated;
      }

      return parsed;
    } catch { return INITIAL_SKILLS; }
  });

  // Streak tracking
  const { streakDays, lastActiveDate, updateStreak } = useStreak();

  // ── Refs ──
  const canvasRef     = useRef(null);
  const animRef       = useRef(null);
  const animT         = useRef(0);
  const emptyAlpha    = useRef(0);
  const starsRef      = useRef([]);
  const nodeDragged   = useRef(false);
  const mouseDownPos  = useRef(null);
  const projectsRef   = useRef([]);
  const apiKeyRef     = useRef(null);
  const selectedIdRef = useRef(null);
  const panRef        = useRef({ x: 0, y: 0 });
  const draggingRef   = useRef(null);
  const resizeRef     = useRef(null);
  const roRef         = useRef(null);
  const activePageRef     = useRef('goals');
  const onwardItemsRef    = useRef([]);
  const skillsRef         = useRef([]);
  const hoveredWeekRef    = useRef(null);
  const selectedSkillRef  = useRef(null);
  const skillsHitAreasRef  = useRef([]);
  const onwardHitAreasRef  = useRef([]);
  const pathsHitAreasRef   = useRef([]);
  const mapWeekRectsRef    = useRef([]);
  const sunIdRef         = useRef(null);
  const solarHitAreasRef  = useRef([]);
  const solarSunPosRef    = useRef({ x: 0, y: 0, R: 0, id: null });
  const goalHitAreasRef  = useRef([]);
  const topGoalsRef      = useRef([]);
  const goalDragRef      = useRef(null);
  const draggedTaskRef    = useRef(null);
  const pendingDropRef    = useRef(null);
  const dragOverHourRef   = useRef(null);
  const [resizeDrag, setResizeDrag] = useState(null);
  const resizeDragRef    = useRef(null);
  const onwardDragRef    = useRef(null);

  // ── Waypoint / navigation helpers ──
  const openWaypoint = (context) => {
    setWaypointContext(context);
    setWaypointOpen(true);
    if (context.type === 'goal') setSelectedId(context.id);
  };

  const closeWaypoint = () => {
    setWaypointOpen(false);
  };

  // ── Program open handler: sets activePage to the program's default canvas page ──
  const onOpenProgramWithPage = useCallback((progId, defaultPage) => {
    setMainPage(`program-${progId}`);
    if (defaultPage) {
      setActivePage(defaultPage);
      activePageRef.current = defaultPage;
    }
    setShowStartupCanvas(false);
  }, [setMainPage, setActivePage, setShowStartupCanvas]);

  // ── Sub-nav handler: called from NOVAProgramPanel sub-nav buttons ──
  const onSubNav = useCallback((page) => {
    setActivePage(page);
    activePageRef.current = page;
    novaInteractions.fireEvent('page_navigated', { page });
    if (page !== 'goals' && page !== 'worklogs' && page !== 'briefing-chat') {
      openWaypoint({ type: 'canvas-panel', id: page });
    } else {
      closeWaypoint();
    }
  }, [setActivePage, openWaypoint, closeWaypoint, novaInteractions]);

  // ── Tracking hook ──
  const {
    todayStr, sessionDurationMin,
    getSessionsForDay, getSessionsForWeek, getSessionsForMonth,
    getTodayStats, startSession, stopSession,
    calcStreak, getWeeklyData,
  } = useTracking({
    projects, sessions, activeSession,
    setSessions, setActiveSession, apiKey, model,
    setFocus, setPlanningDay,
  });

  // ── Load persisted state + API key + settings on mount ──
  useEffect(() => {
    const withTimeout = (promise, ms = 3000) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    const loadStatePromise = window.electronAPI?.loadState()
      ? withTimeout(window.electronAPI.loadState(), 3000)
      : Promise.resolve(null);

    const getApiKeyPromise = window.electronAPI?.getApiKey()
      ? withTimeout(window.electronAPI.getApiKey(), 3000)
      : Promise.resolve(null);

    const getModelPromise = window.electronAPI?.getModel()
      ? withTimeout(window.electronAPI.getModel(), 3000)
      : Promise.resolve(null);

    Promise.all([loadStatePromise, getApiKeyPromise, getModelPromise])
      .then(([saved, key, savedModel]) => {
        if (saved) {
          const lsProjects = localStorage.getItem('meridian_projects_v2');
          const lsOnward   = localStorage.getItem('meridian_onward_v2');
          if (!lsProjects && saved.projects)    setProjects(saved.projects);
          if (!lsOnward   && saved.onwardItems) setOnwardItems(saved.onwardItems);
          if (saved.focus)        setFocus(saved.focus);
          if (saved.skills)       setSkills(saved.skills);
          else                    setSkills(DEFAULT_SKILLS);
          if (saved.intensity)    setIntensity(saved.intensity);
          if (saved.routines)     setRoutines(saved.routines);
          if (saved.sessions)     setSessions(saved.sessions);
        } else {
          setSkills(DEFAULT_SKILLS);
        }
        if (key) setApiKey(key);
        if (savedModel) setModel(savedModel);
        setLoaded(true);

        // Determine auto-start program after loading
        const effectiveApiKey = key || apiKey;
        if (effectiveApiKey) {
          const program = determineAutoStartProgram({
            apiKey: effectiveApiKey,
            syncEvents: novaState.syncEvents,
            programChats: novaState.programChats,
            hour: new Date().getHours(),
            streakDays,
            lastActiveDate,
          });
          if (program) {
            setTimeout(() => {
              setPendingAutoStart(program);
              setMainPage(`program-${program}`);
              const defaultPage = PROGRAM_DEFAULT_PAGES[program];
              if (defaultPage) {
                setActivePage(defaultPage);
                activePageRef.current = defaultPage;
              }
            }, 500);
          }
        }

        // Fire app_opened event for NOVA interactions
        setTimeout(() => {
          useNovaInteractionStore.getState().fireEvent('app_opened', {});
        }, 1000);

      }).catch(err => {
        console.error('[DEBUG] App loading failed (falling back to localStorage):', err);
        setLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save on every projects/focus/onwardItems/skills change ──
  useEffect(() => {
    if (!loaded) return;
    window.electronAPI?.saveState({ projects, focus, onwardItems, skills, intensity, routines, sessions });
  }, [projects, focus, onwardItems, skills, intensity, routines, sessions, loaded]);

  // ── localStorage persistence ──
  useLocalStorageSync([
    [projects, 'meridian_projects_v2'],
    [onwardItems, 'meridian_onward_v2'],
    [freeformTasks, 'meridian_freeform_tasks'],
    [xpSkills, 'meridian_skills'],
    [companionName, 'meridian_companion_name'],
    [selectedForToday, 'meridian_selected_today'],
    [deferredItems, 'meridian_deferred'],
    [backlogItems, 'meridian_backlog'],
    [brainDumpEntries, 'meridian_brain_dump'],
    [journalEntries, 'meridian_journal'],
    [topGoals, 'meridian_top_goals'],
  ], loaded);

  // ── Escape key exits focus mode ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && focusMode) {
        // handleExitFocus is defined in useGoalActions, so we just set focusMode null here
        setFocusMode(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  // ── Sync refs (single effect keeps all canvas refs current) ──
  useEffect(() => {
    projectsRef.current     = projects;
    selectedIdRef.current   = selectedId;
    panRef.current          = pan;
    draggingRef.current     = dragging;
    activePageRef.current   = activePage;
    onwardItemsRef.current  = onwardItems;
    draggedTaskRef.current  = draggedTask;
    pendingDropRef.current  = pendingDrop;
    dragOverHourRef.current = dragOverHour;
    resizeDragRef.current   = resizeDrag;
    skillsRef.current       = skills;
    hoveredWeekRef.current  = hoveredWeek;
    selectedSkillRef.current = selectedSkillId;
    topGoalsRef.current     = topGoals;
  }, [
    projects, selectedId, pan, dragging, activePage,
    onwardItems, draggedTask, pendingDrop, dragOverHour, resizeDrag,
    skills, hoveredWeek, selectedSkillId, topGoals,
  ]);

  // ── Persist apiKey/model/sunId to localStorage (side-effect writes) ──
  useEffect(() => { if (apiKey) localStorage.setItem('meridian_api_key', apiKey); }, [apiKey]);
  useEffect(() => { if (model) localStorage.setItem('meridian_model', model); }, [model]);
  useEffect(() => { sunIdRef.current = sunId; if (sunId) localStorage.setItem('meridian_sun_id', sunId); }, [sunId]);

  // ── Scroll to current time + resize canvas when waypoint opens ──
  useOnwardScroll(activePage, canvasRef, resizeRef);

  // ── Sync app state into NOVA interaction store ──
  useEffect(() => {
    novaInteractions.syncAppState({
      currentStreak: streakDays,
      todayCompletedCount: onwardItems.filter(it => it.done && it.date === new Date().toDateString()).length,
      activePage,
      waypointContext,
      knowledgePool,
      confidence: computePlanningConfidence(knowledgePool?.syncEvents || []),
      projects,
      onwardItems,
      sessions,
      deferredItems: deferredItems.length,
      backlogItems: backlogItems.length,
    });
  }, [
    streakDays,
    activePage,
    waypointContext,
    knowledgePool,
    projects,
    onwardItems,
    sessions,
    deferredItems.length,
    backlogItems.length,
    novaInteractions,
  ]);

  return {
    // State values
    projects, setProjects,
    selectedId, setSelectedId,
    focus, setFocus,
    modal, setModal,
    setForm,
    aiMsg, setAiMsg,
    companionLoading, setCompanionLoading,
    pan, setPan,
    dragging, setDragging,
    loaded, setLoaded,
    apiKey, setApiKey,
    model, setModel,
    setPlanningDay,
    addInput, setAddInput,
    confirmDelete, setConfirmDelete,
    activePage, setActivePage,
    onwardItems, setOnwardItems,
    freeformTasks, setFreeformTasks,
    skills, setSkills,
    onwardForm, setOnwardForm,
    draggedTask, setDraggedTask,
    dragOverHour, setDragOverHour,
    pendingDrop, setPendingDrop,
    availableTasks,
    hoveredWeek, setHoveredWeek,
    selectedSkillId, setSelectedSkillId,
    mainPage, setMainPage,
    showStartupCanvas, setShowStartupCanvas,
    pendingAutoStart, setPendingAutoStart,
    intensity, setIntensity,
    showApiKey, setShowApiKey,
    showMindCheckCard, setShowMindCheckCard,
    sessions, setSessions,
    activeSession, setActiveSession,
    prioritizeInput, setPrioritizeInput,
    trackingPeriod, setTrackingPeriod,
    geminiInput, setGeminiInput,
    geminiResponse, setGeminiResponse,
    geminiLoading, setGeminiLoading,
    pomodoroPreselect, setPomodoroPreselect,
    routines, setRoutines,
    focusMode, setFocusMode,
    selectedForToday, setSelectedForToday,
    deferredItems, setDeferredItems,
    backlogItems, setBacklogItems,
    brainDumpEntries, setBrainDumpEntries,
    journalEntries, setJournalEntries,
    waypointOpen, setWaypointOpen,
    waypointContext, setWaypointContext,
    onwardClickedItem, setOnwardClickedItem,
    selectedOnwardDate, setSelectedOnwardDate,
    sidebarCollapsed, setSidebarCollapsed,
    sunId, setSunId,
    companionName, setCompanionName,
    renamingGoalId, setRenamingGoalId,
    renameValue, setRenameValue,
    topGoals, setTopGoals,
    xpSkills, setXpSkills,
    resizeDrag, setResizeDrag,

    // Refs
    canvasRef, animRef, animT, emptyAlpha, starsRef,
    nodeDragged, mouseDownPos, projectsRef,
    apiKeyRef, selectedIdRef, panRef, draggingRef,
    resizeRef, roRef, activePageRef, onwardItemsRef,
    skillsRef, hoveredWeekRef, selectedSkillRef,
    skillsHitAreasRef, onwardHitAreasRef, pathsHitAreasRef,
    mapWeekRectsRef, sunIdRef, solarHitAreasRef, solarSunPosRef,
    goalHitAreasRef, topGoalsRef, goalDragRef,
    draggedTaskRef, pendingDropRef, dragOverHourRef,
    resizeDragRef, onwardDragRef,

    // NOVA
    novaState, setNovaState,
    novaChatInput, setNovaChatInput,
    novaLoading, knowledgePool,
    addSyncEvent, onNewSession,
    addKnowledgeEntry, deleteKnowledgeEntry, editKnowledgeEntry,
    updateCorrections, sendNOVAMessage,
    generateNovaPlan, buildNOVASystemPrompt,
    scanWeeklyGoals, novaRetry,
    confirmInsight, dismissInsight, recordPlanAccuracy,

    // NOVA Interactions
    novaInteractions,

    // Tracking
    todayStr, sessionDurationMin,
    getSessionsForDay, getSessionsForWeek, getSessionsForMonth,
    getTodayStats, startSession, stopSession,
    calcStreak, getWeeklyData,

    // Streak
    streakDays, lastActiveDate, updateStreak,

    // Deadline alerts
    showDeadlineNotifier, deadlineAlerts, dismissAlerts,

    // Waypoint / navigation helpers
    openWaypoint, closeWaypoint,
    onOpenProgramWithPage, onSubNav,
  };
}
