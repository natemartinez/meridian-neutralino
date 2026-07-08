import { useCallback } from 'react';
import { T } from '../utils/theme.js';
import { askAI } from '../utils/api.js';
import { uid, projectPos, inferInitialQuadrant, quadrantCenter } from '../utils/helpers.js';
import { addSkillEvidence, updateSkillMeta } from '../constants/skills.js';
import { buildLightKnowledgeContext } from '../utils/knowledge.js';

/**
 * useGoalActions — encapsulates all event handlers for goal, onward, skill,
 * focus, and AI-assisted actions.
 *
 * Accepts all dependencies (state values, setters, NOVA API, navigation helpers)
 * as a single options object and returns the handler functions.
 */
export default function useGoalActions({
  // State values (read)
  projects,
  selectedId,
  apiKey,
  model,
  addInput,
  onwardForm,
  pendingDrop,
  onwardItems,
  freeformTasks,
  backlogItems,
  selected,
  knowledgePool,
  novaState,
  novaInteractions,
  sunId,
  colorFor,

  // Setters
  setProjects,
  setSelectedId,
  setAiMsg,
  setCompanionLoading,
  setOnwardItems,
  setOnwardForm,
  setFreeformTasks,
  setPendingDrop,
  setDraggedTask,
  setDragOverHour,
  setPomodoroPreselect,
  setFocusMode,
  setSessions,
  setBrainDumpEntries,
  setJournalEntries,
  setShowMindCheckCard,
  setSkills,
  setXpSkills,
  setTopGoals,
  setSunId,
  setConfirmDelete,
  setAddInput,

  // NOVA API
  addSyncEvent,
  generateNovaPlan,

  // Navigation helpers
  closeWaypoint,
  setMainPage,

  // Streak
  updateStreak,
}) {
  // Handler for GoalModal onCreate — creates a goal from the new two-stage modal
  const createGoalFromModal = useCallback((goalData) => {
    const id    = uid();
    const color = colorFor(projects.length);
    // Infer initial quadrant from goal metadata (deadline, priority, scale)
    const quadrant = inferInitialQuadrant(goalData);
    // Place goal in the center of its inferred quadrant
    // Use a default canvas size of 1200x800 for initial placement;
    // the actual canvas dimensions will recalculate on first render
    const pos = quadrantCenter(quadrant, 600, 400);
    const newProject = {
      id, color, pos, quadrant,
      title:       goalData.title || 'Untitled Goal',
      desc:        goalData.desc || '',
      measurable:  goalData.measurable || '',
      achievable:  goalData.achievable || '',
      relevant:    goalData.relevant || '',
      deadline:    goalData.deadline || '',
      priority:    goalData.priority || 'low',
      scale:       goalData.scale || 'short',
      inFocus:     false,
      completedAt: null,
      subtasks:    (goalData.subtasks || []).map(st => ({ id: uid(), title: st.title, done: false, skill: st.skill || null })),
      checkpoints: (goalData.checkpoints || []).map(cp => ({ id: uid(), title: cp.title, done: false })),
    };
    setProjects(prev => [...prev, newProject]);
    setSelectedId(id);
    // Fire NOVA interaction event
    novaInteractions.fireEvent('goal_created', {
      id: newProject.id,
      title: newProject.title,
      deadline: newProject.deadline,
      subtaskCount: (goalData.subtasks || []).length,
    });
    if (goalData.subtasks?.length || goalData.checkpoints?.length) {
      setAiMsg(`✦ ${(goalData.subtasks?.length || 0) + (goalData.checkpoints?.length || 0)} items generated for "${newProject.title}"`);
    }
  }, [projects.length, novaInteractions, colorFor, setProjects, setSelectedId, setAiMsg]);

  // Onward item handlers
  const addOnwardItem = () => {
    if (!onwardForm.title.trim()) return;
    const item = { id: uid(), title: onwardForm.title.trim(), hour: onwardForm.hour, done: false, priority: onwardForm.priority, goalId: onwardForm.goalId, date: new Date().toDateString(), duration: onwardForm.duration || 60 };
    setOnwardItems(prev => [...prev, item]);
    setOnwardForm(f => ({ ...f, title: '', goalId: null, duration: 60 }));
  };

  // Confirm a dropped subtask/checkpoint into a time block
  const confirmPendingDrop = () => {
    if (!pendingDrop) return;
    const { task, hour } = pendingDrop;
    const item = {
      id: uid(),
      title: task.title,
      hour,
      done: false,
      priority: 'low',
      goalId: task.goalId,
      date: new Date().toDateString(),
      duration: 60,
      ...(task.type !== 'freeform' && { linkedType: task.type, linkedId: task.id }),
    };
    setOnwardItems(prev => [...prev, item]);
    if (task.type === 'freeform') {
      setFreeformTasks(prev => prev.filter(ft => ft.id !== task.id));
    }
    setPendingDrop(null);
    setDraggedTask(null);
    setDragOverHour(null);
  };

  const cancelPendingDrop = () => {
    setPendingDrop(null);
    setDraggedTask(null);
    setDragOverHour(null);
  };

  const deleteOnwardItem = (id) => setOnwardItems(prev => prev.filter(it => it.id !== id));

  // Resize an onward item's duration (from drag handle on time-block grid)
  const resizeOnwardItem = (id, newDuration) => {
    setOnwardItems(prev => prev.map(it =>
      it.id === id ? { ...it, duration: Math.max(15, Math.min(240, newDuration)) } : it
    ));
  };

  const deleteAvailableTask = (task) => {
    if (task.type === 'subtask') {
      setProjects(prev => prev.map(p => ({
        ...p,
        subtasks: p.subtasks?.filter(st => st.id !== task.id) || [],
      })));
    } else if (task.type === 'checkpoint') {
      setProjects(prev => prev.map(p => ({
        ...p,
        checkpoints: p.checkpoints?.filter(cp => cp.id !== task.id) || [],
      })));
    } else if (task.type === 'freeform') {
      setFreeformTasks(prev => prev.filter(ft => ft.id !== task.id));
    }
  };

  const returnOnwardItemToAvailable = (id) => {
    const item = onwardItems.find(it => it.id === id);
    if (!item) return;
    if (!item.linkedId) {
      setFreeformTasks(prev => [...prev, { id: item.id, title: item.title, goalId: item.goalId || null }]);
    }
    setOnwardItems(prev => prev.filter(it => it.id !== id));
  };

  const moveOnwardItem = (id, dir) => {
    setOnwardItems(prev => {
      const sorted = [...prev].sort((a, b) => a.hour - b.hour);
      const idx = sorted.findIndex(it => it.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const hourA = sorted[idx].hour;
      const hourB = sorted[swapIdx].hour;
      return prev.map(it => {
        if (it.id === sorted[idx].id) return { ...it, hour: hourB };
        if (it.id === sorted[swapIdx].id) return { ...it, hour: hourA };
        return it;
      });
    });
  };

  const handleStartFocus = (item) => {
    const POMODORO_KEY = 'meridian_pomodoro'; // must match STORAGE_KEY in PomodoroView.jsx
    try {
      const current = JSON.parse(localStorage.getItem(POMODORO_KEY) || 'null') || {};
      localStorage.setItem(POMODORO_KEY, JSON.stringify({
        ...current,
        linkedGoalId: item.goalId ?? null,
        linkedTaskId: item.id,
        running: false,
      }));
    } catch { /* empty — localStorage parse failure is non-critical */ }
    setPomodoroPreselect({ goalId: item.goalId ?? null, taskId: item.id });
    // Route to Track page's Pomodoro timer instead of immersive FocusScreen
    setMainPage('tracking');
  };

  // ── New Ingestion & Smart Sorting handlers ──
  const handleFocusSessionComplete = (session) => {
    setSessions(prev => [...prev, session]);
    // Fire NOVA interaction event
    novaInteractions.fireEvent('session_completed', {
      label: session.label,
      goalId: session.goalId,
      duration: session.duration,
    });
    // Check if task overran estimate → fire journal prompt
    const onwardItem = onwardItems.find(it => it.id === session.goalId || it.title === session.label);
    if (onwardItem && onwardItem.duration) {
      const estimated = onwardItem.duration;
      if (session.duration > estimated * 1.2) {
        novaInteractions.fireEvent('session_overran', {
          label: session.label,
          estimated,
          actual: session.duration,
        });
      }
    }
  };

  const handleBrainDump = (entry) => {
    setBrainDumpEntries(prev => [...prev, entry]);
  };

  const handleJournalEntry = (entry) => {
    setJournalEntries(prev => [...prev, entry]);
  };

  const handleBreakdownTask = (task, subTasks) => {
    // Find or create a project for this task, then add subtasks
    const existingProject = projects.find(p => p.id === task.goalId);
    if (existingProject) {
      // Add subtasks to the existing project
      const newSubtasks = subTasks.map(st => ({
        id: uid(),
        title: st.trim(),
        done: false,
        createdAt: Date.now(),
      }));
      setProjects(prev => prev.map(p =>
        p.id === existingProject.id
          ? { ...p, subtasks: [...p.subtasks, ...newSubtasks] }
          : p
      ));
    } else {
      // Create a new project for this task
      const newProject = {
        id: uid(),
        title: task.title,
        desc: '',
        color: T.accent,
        priority: task.priority || 'low',
        scale: 'short',
        deadline: '',
        measurable: '',
        achievable: '',
        relevant: '',
        completedAt: null,
        createdAt: Date.now(),
        subtasks: subTasks.map(st => ({
          id: uid(),
          title: st.trim(),
          done: false,
          createdAt: Date.now(),
        })),
        checkpoints: [],
      };
      setProjects(prev => [...prev, newProject]);
    }
  };

  const handleBreakdownSuggestion = (taskLabel) => {
    // Open the Briefing program's breakdown phase for this task
    const task = onwardItems.find(it => it.title === taskLabel);
    if (task) {
      handleBreakdownTask(task, [`${taskLabel} — Part 1`, `${taskLabel} — Part 2`]);
    }
  };

  const handleRestoreFromBacklog = (itemId) => {
    const item = backlogItems.find(b => b.id === itemId);
    if (!item) return;
    // Remove from backlog
    setBacklogItems(prev => prev.filter(b => b.id !== itemId));
    // Add back to onwardItems with a default time
    setOnwardItems(prev => [...prev, {
      id: uid(),
      title: item.title,
      hour: 480, // 8:00 AM default
      priority: item.priority || 'low',
      goalId: item.goalId || null,
      done: false,
      createdAt: Date.now(),
    }]);
  };

  const handleExitFocus = () => {
    setFocusMode(null);
  };

  const toggleOnwardDone = (id) => {
    const item = onwardItems.find(it => it.id === id);
    if (item?.novaTaskId && !item.done) {
      addSyncEvent('task_completed', item.title);
    }
    setOnwardItems(prev => prev.map(it => it.id === id ? { ...it, done: !it.done } : it));
    // Fire NOVA interaction event for task completion
    if (item && !item.done) {
      novaInteractions.fireEvent('task_completed', {
        id: item.id,
        title: item.title,
        goalId: item.goalId,
      });
      setShowMindCheckCard(true);
    }
    const remainingNovaItems = onwardItems.filter(it => it.novaTaskId && !it.done && it.id !== id).length;
    if (novaState.dailyPlan && remainingNovaItems < 5 && !novaState.planGenLoading) {
      generateNovaPlan();
    }
  };

  // Skills handlers
  const updateSkillLevel = (groupId, subId, level) =>
    setSkills(prev => prev.map(g => g.id !== groupId ? g : {
      ...g, subskills: g.subskills.map(ss => ss.id === subId ? { ...ss, level } : ss)
    }));

  const addSubskill = (groupId, name) =>
    setSkills(prev => prev.map(g => g.id !== groupId ? g : {
      ...g, subskills: [...g.subskills, { id: uid(), name, level: 1 }]
    }));

  const toggleSubtask = (projId, stId) => {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projId) return p;
      return {
        ...p, subtasks: p.subtasks.map((s) => {
          if (s.id !== stId) return s;
          const nowCompleting = !s.done;

          if (s.skill && nowCompleting) {
            // Find which group contains this skill and record evidence
            setXpSkills(prevSkills => {
              for (const [groupName, group] of Object.entries(prevSkills)) {
                if (group.skills[s.skill] !== undefined) {
                  return addSkillEvidence(prevSkills, groupName, s.skill, 0, p.title);
                }
              }
              return prevSkills;
            });
          }

          if (nowCompleting) updateStreak();
          return { ...s, done: nowCompleting, completedAt: nowCompleting ? new Date().toISOString() : null };
        }),
      };
    }));
  };

  // Note: updateStreak is passed in separately since it comes from useStreak
  // We need to accept it as a parameter
  // Let's handle this differently - we'll accept updateStreak in the options

  const handleUpdateSkillMeta = (groupName, skillName, updates) => {
    setXpSkills(prev => updateSkillMeta(prev, groupName, skillName, updates));
  };

  const toggleCheckpoint = (projId, cpId) =>
    setProjects((prev) => prev.map((p) => p.id !== projId ? p : {
      ...p, checkpoints: p.checkpoints.map((c) => c.id === cpId
        ? { ...c, done: !c.done, completedAt: !c.done ? new Date().toISOString() : null }
        : c)
    }));

  const toggleFocus = (projId) =>
    setProjects(prev => prev.map(p => p.id !== projId ? p : { ...p, inFocus: !p.inFocus }));

  const deleteGoal = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    setConfirmDelete(null);
  };

  const toggleTopGoal = (id) => {
    setTopGoals(prev => prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]);
  };

  const completeGoal = (id) => {
    setProjects(prev => prev.map(p => p.id !== id ? p : { ...p, completedAt: new Date().toISOString() }));
    if (sunId === id) setSunId(null);
    closeWaypoint();
    setSelectedId(null);
  };

  const renameGoal = (id, newTitle) => {
    if (!newTitle.trim()) return;
    setProjects(prev => prev.map(p => p.id !== id ? p : { ...p, title: newTitle.trim() }));
  };

  const deleteSubtask = (projId, stId) =>
    setProjects(prev => prev.map(p => p.id !== projId ? p : { ...p, subtasks: p.subtasks.filter(s => s.id !== stId) }));

  const deleteCheckpoint = (projId, cpId) =>
    setProjects(prev => prev.map(p => p.id !== projId ? p : { ...p, checkpoints: p.checkpoints.filter(c => c.id !== cpId) }));

  const addSubtask = () => {
    const t = addInput.trim();
    if (!t || !selected) return;
    setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, subtasks: [...p.subtasks, { id: uid(), title: t, done: false }] } : p));
    setAddInput('');
  };

  const addCheckpoint = () => {
    const t = addInput.trim();
    if (!t || !selected) return;
    setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, checkpoints: [...p.checkpoints, { id: uid(), title: t, done: false }] } : p));
    setAddInput('');
  };

  const checkIn = async () => {
    if (!selected) { setAiMsg('Open a goal first to use Check In.'); return; }
    if (!apiKey)   { setAiMsg('Add your OpenRouter API key in Settings.'); return; }
    setCompanionLoading(true);
    setAiMsg("");
    try {
      const subtasks    = selected.subtasks    ?? [];
      const checkpoints = selected.checkpoints ?? [];
      const done   = subtasks.filter((s) => s.done).length;
      const total  = subtasks.length;
      const cpDone = checkpoints.filter((c) => c.done).length;
      const lightCtx = buildLightKnowledgeContext(knowledgePool);
      const system = (`You are a thoughtful, non-pushy productivity companion named NOVA. Keep check-ins brief (2–3 sentences), warm, and psychologically honest. No toxic positivity. Focus on reflection and clarity, not pressure.${lightCtx ? ' ' + lightCtx : ''}`).trim();
      const msg = await askAI(system, `Goal: "${selected.title}". Progress: ${done}/${total} subtasks done, ${cpDone}/${checkpoints.length} checkpoints reached. Do a brief check-in.`, apiKey, { model });
      setAiMsg(msg || 'No response from AI. Check your API key in Settings.');
    } finally {
      setCompanionLoading(false);
    }
  };

  const suggestSubtask = async () => {
    if (!selected) { setAiMsg('Open a goal first to get suggestions.'); return; }
    if (!apiKey)   { setAiMsg('Add your OpenRouter API key in Settings.'); return; }
    setCompanionLoading(true);
    try {
      const subtasks = selected.subtasks ?? [];
      const existing = subtasks.map((s) => s.title).join(", ");
      const lightCtx = buildLightKnowledgeContext(knowledgePool);
      const system = (`You are a JSON API. Respond with ONLY a raw JSON object and nothing else. No markdown, no code fences, no explanation. Example: {"title":"Buy groceries"}${lightCtx ? ' ' + lightCtx : ''}`).trim();
      const raw = await askAI(system, `Goal: "${selected.title}". Existing subtasks: ${existing || "none"}. Reply with exactly one JSON object {"title":"<next subtask>"}.`, apiKey, { model });
      try {
        const cleaned = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
        const item = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
        if (!item.title) throw new Error('no title');
        setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, subtasks: [...(p.subtasks ?? []), { id: uid(), title: item.title, done: false }] } : p));
        setAiMsg(`✦ Added: "${item.title}"`);
      } catch {
        setAiMsg(`Couldn't parse the suggestion. Raw: ${raw?.slice(0,120)}`);
      }
    } finally {
      setCompanionLoading(false);
    }
  };

  return {
    createGoalFromModal,
    addOnwardItem,
    confirmPendingDrop,
    cancelPendingDrop,
    deleteOnwardItem,
    resizeOnwardItem,
    deleteAvailableTask,
    returnOnwardItemToAvailable,
    moveOnwardItem,
    handleStartFocus,
    handleFocusSessionComplete,
    handleBrainDump,
    handleJournalEntry,
    handleBreakdownTask,
    handleBreakdownSuggestion,
    handleRestoreFromBacklog,
    handleExitFocus,
    toggleOnwardDone,
    updateSkillLevel,
    addSubskill,
    toggleSubtask,
    handleUpdateSkillMeta,
    toggleCheckpoint,
    toggleFocus,
    deleteGoal,
    toggleTopGoal,
    completeGoal,
    renameGoal,
    deleteSubtask,
    deleteCheckpoint,
    addSubtask,
    addCheckpoint,
    checkIn,
    suggestSubtask,
  };
}
