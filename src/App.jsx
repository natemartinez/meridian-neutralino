import { useState, useRef, useCallback, useMemo } from 'react';
import { T, NODE_PALETTE } from './utils/theme.js';
import { askAI } from './utils/api.js';
import { uid, projectPos, DEFAULT_SKILLS } from './utils/helpers.js';

import CompassWidget from './components/CompassWidget.jsx';
import OnwardPanel from './components/OnwardPanel.jsx';
import MapPanel from './components/MapPanel.jsx';
import SkillsPanel from './components/SkillsPanel.jsx';
import ApiKeyScreen from './components/ApiKeyScreen.jsx';
import TrackingPage from './components/TrackingPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import MindCheckPage from './components/MindCheckPage.jsx';
import KnowledgePoolPage from './components/KnowledgePoolPage.jsx';
import MindCheckCard from './components/MindCheckCard.jsx';
import SkillsView from './components/views/SkillsView.jsx';
import PathsView from './components/views/PathsView.jsx';
import WorkLogsView from './components/views/WorkLogsView.jsx';
import GoalModal from './components/panels/GoalModal.jsx';
import FocusScreen from './components/views/FocusScreen.jsx';
import DeadlineNotifier from './components/DeadlineNotifier.jsx';
import OnwardTaskPopover from './components/OnwardTaskPopover.jsx';
import GoalDetailPanel from './components/panels/GoalDetailPanel.jsx';
import CanvasPanelWrapper from './components/panels/CanvasPanelWrapper.jsx';
import NovaSidebarBlock from './components/nova/NovaSidebarBlock.jsx';
import ProgramsList from './components/nova/ProgramsList.jsx';
import NovaInsightsPanel from './components/nova/NovaInsightsPanel.jsx';
import { INITIAL_SKILLS, addSkillEvidence, updateSkillMeta } from './constants/skills.js';
import { buildLightKnowledgeContext } from './utils/knowledge.js';
import { computePlanningConfidence, determineAutoStartProgram, getLastActiveProgram } from './utils/nova.js';
import NOVAProgramPanel from './components/nova/NOVAProgramPanel.jsx';
import useAppState from './hooks/useAppState.js';
import useAppCanvas from './hooks/useAppCanvas.js';
import NovaToast from './components/nova/NovaToast.jsx';
import StartupCanvas from './components/nova/StartupCanvas.jsx';
import { PROGRAMS_WITH_CANVAS, PROGRAM_DEFAULT_PAGES, isCanvasPage, isProgram, extractProgId } from './constants/programs.js';
import { TrackIcon, SettingsIcon, MindIcon, ClockIcon } from './components/icons.jsx';

    function Meridian() {
      const appState = useAppState();

      const {
        // State values
        projects, setProjects,
        selectedId, setSelectedId,
        focus, setFocus,
        modal, setModal,
        aiMsg, setAiMsg,
        companionLoading, setCompanionLoading,
        pan, setPan,
        dragging, setDragging,
        loaded, setLoaded,
        apiKey, setApiKey,
        model, setModel,
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
      } = appState;

      // ── Canvas draw loop + mouse handlers ────────────────────
      const {
        onCanvasMouseDown,
        onCanvasMouseMove,
        onCanvasMouseUp,
        onCanvasDragOver,
        onCanvasDragLeave,
        onCanvasDrop,
      } = useAppCanvas({
        loaded, apiKey, mainPage,
        canvasRef, activePageRef, starsRef, resizeRef, roRef, animRef, animT, emptyAlpha,
        projectsRef, selectedIdRef, sunIdRef, panRef, draggingRef,
        onwardItemsRef, pendingDropRef, dragOverHourRef, onwardHitAreasRef,
        skillsRef, selectedSkillRef, skillsHitAreasRef,
        hoveredWeekRef, mapWeekRectsRef, pathsHitAreasRef,
        solarHitAreasRef, solarSunPosRef, goalHitAreasRef,
        topGoalsRef, goalDragRef, resizeDragRef, onwardDragRef,
        nodeDragged, mouseDownPos, draggedTaskRef,
        setResizeDrag, setOnwardItems, setPan, setDragging, setProjects,
        setHoveredWeek, setDragOverHour, setPendingDrop, setDraggedTask,
        setSelectedId, setOnwardClickedItem, setSelectedSkillId,
        openWaypoint, closeWaypoint,
        confirmPendingDrop, cancelPendingDrop,
      });

      const selected  = projects.find((p) => p.id === selectedId);
      const colorFor  = (i) => NODE_PALETTE[i % NODE_PALETTE.length];

      // Handler for GoalModal onCreate — creates a goal from the new two-stage modal
      const createGoalFromModal = useCallback((goalData) => {
        const id    = uid();
        const color = colorFor(projects.length);
        const pos   = projectPos(projects.length);
        const newProject = {
          id, color, pos,
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
      }, [projects.length, novaInteractions]);

      // Onward item handlers
      const addOnwardItem = () => {
        if (!onwardForm.title.trim()) return;
        const item = { id: uid(), title: onwardForm.title.trim(), hour: onwardForm.hour, done: false, priority: onwardForm.priority, goalId: onwardForm.goalId, date: new Date().toDateString(), duration: 60 };
        setOnwardItems(prev => [...prev, item]);
        setOnwardForm(f => ({ ...f, title: '', goalId: null }));
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
        // Also set focusMode for immersive FocusScreen
        setFocusMode({ active: true, taskTitle: item.title, taskId: item.id, goalId: item.goalId ?? null });
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
          const system = (`You are a thoughtful, non-pushy productivity companion named ${companionName}. Keep check-ins brief (2–3 sentences), warm, and psychologically honest. No toxic positivity. Focus on reflection and clarity, not pressure.${lightCtx ? ' ' + lightCtx : ''}`).trim();
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


      if (!loaded) return null;
      if (!apiKey) return <ApiKeyScreen onSave={setApiKey} />;

      return (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
            *{box-sizing:border-box;margin:0;padding:0;}
            ::-webkit-scrollbar{width:3px;}
            ::-webkit-scrollbar-track{background:${T.surface};}
            ::-webkit-scrollbar-thumb{background:${T.dim};border-radius:2px;}

            /* ── App shell ── */
            .app-shell{display:flex;height:100vh;overflow:hidden;background:${T.bg};color:${T.text};font-family:'Syne',sans-serif;}

            /* ── SIGNAL ── */
            .sig{width:180px;flex-shrink:0;background:transparent;display:flex;flex-direction:column;overflow:hidden;transition:width .2s;padding:12px 0;position:relative;}
            .sig.collapsed{width:48px;}
            .sig.collapsed .sec,
            .sig.collapsed .wp-ttl,
            .sig.collapsed .wp-badge,
            .sig.collapsed .nova-lbl,
            .sig.collapsed .nova-pct,
            .sig.collapsed .nova-status,
            .sig.collapsed .plan-lbl,
            .sig.collapsed .plan-item-title,
            .sig.collapsed .plan-item-meta,
            .sig.collapsed .plan-refresh-btn,
            .sig.collapsed .prg-lbl,
            .sig.collapsed .prg-desc{display:none;}
            /* Center the NovaSidebarBlock (HQ button) when sidebar is collapsed */
            .sig.collapsed .nova-block{display:flex;justify-content:center;}
            .sig.collapsed .nova-block > div{margin:0 auto;}
            .sec{padding:10px 11px 6px;}
            .secl{font-size:7.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;gap:5px;margin-bottom:8px;}
            .pip{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
            .fci{display:flex;align-items:center;gap:7px;padding:6px 7px;background:${T.card};border-radius:6px;margin-bottom:4px;cursor:pointer;border:1px solid transparent;transition:all .14s;}
            .fci:hover{border-color:${T.dim};}
            .fci.sel{border-color:${T.accent}50;background:${T.accent}08;}
            .fci-ico{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
            .fci-txt{font-size:10.5px;color:${T.text};line-height:1.25;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .fci-input{background:transparent;border:none;color:${T.text};font-family:'Syne',sans-serif;font-size:10.5px;width:100%;outline:none;padding:0;cursor:text;}
            .fci-input::placeholder{color:${T.muted};font-size:10px;}
            .grl{display:flex;align-items:center;gap:7px;padding:6px 7px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:all .14s;margin-bottom:3px;}
            .grl:hover{background:${T.card};}
            .grl.sel{background:${T.card};border-color:${T.accent}40;}
            .gr-pip{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
            .gr-nm{font-size:10.5px;color:${T.text};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .gr-pc{font-size:9.5px;color:${T.muted};}
            .sig-add{margin:5px 11px 7px;padding:7px;background:${T.accentLo};border:1px solid ${T.accent}30;border-radius:6px;color:${T.accent};font-size:10.5px;text-align:center;cursor:pointer;letter-spacing:.04em;font-family:'Syne',sans-serif;font-weight:700;transition:all .14s;}
            .sig-add:hover{background:${T.accent}22;border-color:${T.accent}60;}

            /* ── COMMAND ── */
            .cmd{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;position:relative;}
            .ctb{padding:11px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
            .cttl{font-size:14px;color:${T.accent};font-weight:700;letter-spacing:.1em;font-family:'Syne',sans-serif;}
            .cdt{font-size:9px;color:${T.muted};margin-top:2px;font-family:'IBM Plex Mono',monospace;}
            .cbtn{padding:6px 11px;background:${T.accentLo};border:1px solid ${T.accent}30;border-radius:20px;color:${T.accent};font-size:9.5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;white-space:nowrap;transition:all .14s;}
            .cbtn:hover{background:${T.accent}22;border-color:${T.accent}60;}
            .cbody{flex:1;overflow:hidden;position:relative;}
            .cv{width:100%;height:100%;position:relative;overflow:hidden;}
            .cv::-webkit-scrollbar{width:8px;height:8px;}
            .cv::-webkit-scrollbar-track{background:${T.bg};}
            .cv::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px;}
            .cv::-webkit-scrollbar-thumb:hover{background:${T.muted};}

            /* ── WAYPOINT ── */
            .wp{position:absolute;top:0;right:0;height:100%;width:0;overflow:hidden;background:${T.surface};display:flex;transition:width .4s cubic-bezier(.4,0,.2,1);z-index:20;box-shadow:-4px 0 24px rgba(0,0,0,.35);}
            .wp.open{width:244px;border-left:1px solid ${T.border};}
            .wpi{width:244px;flex-shrink:0;display:flex;flex-direction:column;height:100%;overflow:hidden;}
            .wp-accent{height:3px;flex-shrink:0;transition:background .25s;}
            .wp-hd{padding:13px 13px 10px;border-bottom:1px solid ${T.border};flex-shrink:0;position:relative;}
            .wp-close{position:absolute;top:9px;right:9px;width:20px;height:20px;border-radius:4px;background:${T.border};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;font-family:monospace;font-size:12px;color:${T.muted};line-height:1;transition:all .13s;}
            .wp-close:hover{background:${T.dim};color:${T.text};}
            .wp-badge{font-size:7.5px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px;display:flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;}
            .wp-ttl{font-size:14px;font-weight:700;letter-spacing:.04em;line-height:1.2;margin-bottom:4px;padding-right:24px;}
            .wp-dsc{font-size:10.5px;color:${T.muted};line-height:1.5;font-family:'IBM Plex Mono',monospace;}
            .wp-pg{padding:9px 13px;border-bottom:1px solid ${T.border};flex-shrink:0;}
            .wp-pgr{display:flex;justify-content:space-between;font-size:8.5px;color:${T.muted};margin-bottom:4px;font-family:'IBM Plex Mono',monospace;}
            .wp-pgtr{height:5px;background:${T.dim};border-radius:3px;overflow:hidden;}
            .wp-pgf{height:100%;border-radius:3px;transition:width .4s;}
            .wp-bdy{flex:1;overflow-y:auto;overflow-x:hidden;padding:9px 13px 4px;}
            .wp-bdy::-webkit-scrollbar{width:3px;}
            .wp-bdy::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
            .wsh{font-size:7.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.11em;margin:10px 0 5px;display:flex;align-items:center;gap:4px;font-family:'IBM Plex Mono',monospace;}
            .wsh:first-child{margin-top:0;}
            .wti{display:flex;align-items:flex-start;gap:7px;padding:5px 0;border-bottom:1px solid ${T.border}40;}
            .wck{width:14px;height:14px;border-radius:3px;border:1.5px solid ${T.dim};flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s;}
            .wck.done{background:${T.green}18;border-color:${T.green};}
            .wtx{font-size:10.5px;color:${T.text};line-height:1.35;flex:1;}
            .wtx.dn{color:${T.muted};text-decoration:line-through;}
            .wdm{width:14px;height:14px;border-radius:2.5px;border:1.5px solid ${T.blue}40;flex-shrink:0;margin-top:1px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s;}
            .wdm.done{border-color:${T.blue};background:${T.blue}18;}
            .w-del{opacity:0;background:none;border:none;color:${T.muted};font-size:12px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;transition:all .14s;}
            .wti:hover .w-del{opacity:1;}
            .w-del:hover{color:${T.rose};}
            .w-add-row{display:flex;gap:5px;margin-top:8px;}
            .w-add-inp{flex:1;background:${T.card};border:1px solid ${T.border};border-radius:5px;padding:5px 8px;color:${T.text};font-family:'IBM Plex Mono',monospace;font-size:10px;outline:none;}
            .w-add-inp:focus{border-color:${T.accent}60;}
            .w-add-inp::placeholder{color:${T.muted};}
            .w-add-btn{background:${T.card};border:1px solid ${T.border};border-radius:5px;padding:5px 8px;color:${T.muted};font-size:10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;white-space:nowrap;transition:all .13s;}
            .w-add-btn:hover{border-color:${T.blue};color:${T.blue};}
            .wp-ai{margin:8px 12px 12px;border-radius:9px;overflow:hidden;flex-shrink:0;border:1px solid ${T.blue}25;}
            .wp-ai-h{padding:9px 12px 7px;border-bottom:1px solid ${T.border};display:flex;align-items:center;gap:8px;background:${T.blue}06;}
            .wp-ai-orb{width:28px;height:28px;border-radius:50%;border:1.5px solid ${T.blue}50;background:${T.blue}12;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${T.blue};}
            .wp-ai-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.blue};font-family:'IBM Plex Mono',monospace;}
            .wp-ai-sub{font-size:8.5px;color:${T.muted};margin-top:1px;font-family:'IBM Plex Mono',monospace;}
            .wp-ai-dot{width:7px;height:7px;border-radius:50%;background:${T.green};flex-shrink:0;}
            .wp-ai-b{padding:9px 12px;background:${T.card};}
            .wp-ai-msg{font-size:10.5px;color:${T.text};line-height:1.65;font-style:italic;font-family:'IBM Plex Mono',monospace;}
            .wp-ai-btns{display:flex;gap:5px;margin-top:8px;}
            .waib{flex:1;padding:6px 4px;border-radius:6px;font-size:8.5px;text-align:center;cursor:pointer;letter-spacing:.03em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;border:1px solid;transition:filter .13s;background:none;}
            .waib:hover{filter:brightness(1.1);}
            .waib:disabled{opacity:.35;cursor:not-allowed;}
            .wp-await{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:8px;opacity:.4;padding-bottom:20px;}
            .wp-await-ico{width:38px;height:38px;border-radius:10px;background:${T.border};display:flex;align-items:center;justify-content:center;}
            .wp-await-txt{font-size:9.5px;color:${T.muted};text-align:center;line-height:1.6;max-width:140px;font-family:'IBM Plex Mono',monospace;}

            /* ── Modals (unchanged) ── */
            .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);}
            .modal{background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:28px;width:540px;max-width:94vw;max-height:90vh;overflow-y:auto;}
            .modal h2{font-size:17px;font-weight:800;margin-bottom:14px;color:${T.accent};letter-spacing:.06em;}
            .m-btns{display:flex;gap:8px;margin-top:8px;}
            .m-btns button{flex:1;padding:10px;border-radius:6px;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;}
            .m-ok{background:${T.accent};border:none;color:#000;}
            .m-ok:hover{opacity:.9;}
            .m-ok:disabled{opacity:.35;cursor:not-allowed;}
            .m-cancel{background:transparent;border:1px solid ${T.border};color:${T.muted};}
            .m-cancel:hover{border-color:${T.muted};color:${T.text};}
            .smart-status{display:flex;align-items:center;gap:5px;margin-bottom:18px;padding:9px 12px;background:${T.surface};border-radius:8px;border:1px solid ${T.border};}
            .s-dot{width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;transition:all .18s;flex-shrink:0;}
            .s-dot.on{background:${T.green}18;color:${T.green};border:1px solid ${T.green}45;}
            .s-dot.off{background:${T.dim};color:${T.muted};border:1px solid ${T.border};}
            .smart-field{margin-bottom:15px;}
            .smart-lbl{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
            .smart-badge{width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;flex-shrink:0;}
            .smart-name{font-size:12px;font-weight:700;letter-spacing:.04em;}
            .smart-hint{font-size:10px;color:${T.muted};font-family:'IBM Plex Mono',monospace;margin-left:auto;}
            .s-inp{width:100%;box-sizing:border-box;background:${T.surface};border:1px solid ${T.border};border-radius:6px;padding:8px 11px;color:${T.text};font-family:'Syne',sans-serif;font-size:12px;outline:none;transition:border-color .15s;display:block;}
            .s-inp:focus{border-color:${T.accent}60;}
            .s-inp::placeholder{color:${T.muted};font-size:11px;}
            .s-inp.ok{border-color:${T.green}35;}
            @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3);}}

            /* ── Responsive Scaling ── */
            /* Fluid typography base - zoomed in for readability */
            .sig-brand{font-size:clamp(17px, 1.55vw, 24px);}
            .sig-subt{font-size:clamp(9px, 0.77vw, 12px);}
            .secl{font-size:clamp(10px, 0.88vw, 13px);}
            .fci-input,.fci-txt,.gr-nm{font-size:clamp(13px, 1.15vw, 16px);}
            .gr-pc{font-size:clamp(12px, 1.05vw, 15px);}
            .sig-add{font-size:clamp(13px, 1.1vw, 16px);}
            .cttl{font-size:clamp(18px, 1.55vw, 24px);}
            .cdt{font-size:clamp(12px, 1.05vw, 15px);}
            .cbtn{font-size:clamp(12px, 1.05vw, 15px);}
            .wp-ttl{font-size:clamp(18px, 1.55vw, 24px);}
            .wp-badge{font-size:clamp(10px, 0.88vw, 13px);}
            .wp-dsc{font-size:clamp(13px, 1.15vw, 16px);}
            .wtx{font-size:clamp(14px, 1.27vw, 18px);}
            .wp-ai-msg{font-size:clamp(14px, 1.27vw, 18px);}
            .wp-ai-lbl{font-size:clamp(13px, 1.1vw, 15px);}
            .wp-ai-sub{font-size:clamp(11px, 0.94vw, 13px);}
            .waib{font-size:clamp(11px, 0.94vw, 13px);}
            .w-add-inp,.w-add-btn{font-size:clamp(13px, 1.1vw, 15px);}
            .wp-pgr{font-size:clamp(11px, 0.94vw, 13px);}
            .wsh{font-size:clamp(10px, 0.88vw, 12px);}
            .wp-await-txt{font-size:clamp(13px, 1.1vw, 15px);}
            .nova-lbl{font-size:9px;}
            .nova-pct{font-size:11px;}
            .nova-status{font-size:9px;}
            .plan-lbl{font-size:9px;}
            .plan-item-title{font-size:9px;}
            .plan-item-meta{font-size:8px;}
            .plan-refresh-btn{font-size:8px;}

            /* Base sizes (1440px - 1919px) - default zoomed in */
            .sig{width:252px;}
            .sec{padding:14px 14px 10px;}
            .sig-add{margin:6px 14px 10px;padding:9px;}
            .wp.open{width:345px;}
            .wpi{width:345px;}
            .wp-hd{padding:16px 16px 12px;}
            .wp-pg{padding:12px 16px;}
            .wp-bdy{padding:12px 16px 6px;}
            .wp-ai{margin:10px 14px 14px;}
            .wp-ai-h{padding:12px 14px 10px;}
            .wp-ai-b{padding:12px 14px;}
            .wp-ai-orb{width:32px;height:32px;}
            .ctb{padding:14px 18px;}
            .fci-ico{width:26px;height:26px;}
            .fci{padding:8px 10px;}
            .grl{padding:8px 10px;}
            .gr-pip{width:10px;height:10px;}
            .wck,.wdm{width:18px;height:18px;}
            .wp-close{width:24px;height:24px;font-size:14px;}

            /* Small screens (laptops, 1366px - 1439px) - slight reduction */
            @media (max-width: 1439px) {
              .sig{width:230px;}
              .wp.open{width:299px;}
              .wpi{width:299px;}
              .sec{padding:12px 12px 8px;}
              .sig-add{margin:5px 12px 8px;padding:8px;}
              .wp-hd{padding:14px 14px 10px;}
              .wp-pg{padding:10px 14px;}
              .wp-bdy{padding:10px 14px 5px;}
              .wp-ai{margin:8px 12px 12px;}
              .wp-ai-h{padding:10px 12px 8px;}
              .wp-ai-b{padding:10px 12px;}
              .wp-ai-orb{width:28px;height:28px;}
              .ctb{padding:12px 16px;}
              .fci-ico{width:24px;height:24px;}
              .fci{padding:7px 8px;}
              .grl{padding:7px 8px;}
            }

            /* Extra small screens (compact laptops, < 1366px) */
            @media (max-width: 1365px) {
              .sig{width:206px;}
              .wp.open{width:276px;}
              .wpi{width:276px;}
              .sec{padding:10px 10px 6px;}
              .sig-add{margin:4px 10px 6px;padding:7px;}
              .wp-hd{padding:12px 12px 9px;}
              .wp-pg{padding:9px 12px;}
              .wp-bdy{padding:9px 12px 4px;}
              .wp-ai{margin:7px 10px 10px;}
              .wp-ai-h{padding:9px 10px 7px;}
              .wp-ai-b{padding:9px 10px;}
              .wp-ai-orb{width:26px;height:26px;}
              .ctb{padding:10px 14px;}
              .fci-ico{width:22px;height:22px;}
              .fci{padding:6px 7px;}
              .grl{padding:6px 7px;}
              .gr-pip{width:9px;height:9px;}
            }

            /* Large screens (1920px - 2559px) - bigger for TV/desktop */
            @media (min-width: 1920px) {
              .sig{width:298px;}
              .wp.open{width:391px;}
              .wpi{width:391px;}
              .sec{padding:18px 18px 12px;}
              .sig-add{margin:8px 18px 12px;padding:11px;}
              .wp-hd{padding:20px 20px 16px;}
              .wp-pg{padding:14px 20px;}
              .wp-bdy{padding:14px 20px 8px;}
              .wp-ai{margin:12px 18px 18px;}
              .wp-ai-h{padding:14px 18px 12px;}
              .wp-ai-b{padding:14px 18px;}
              .wp-ai-orb{width:38px;height:38px;}
              .ctb{padding:18px 24px;}
              .fci-ico{width:30px;height:30px;}
              .fci{padding:10px 12px;}
              .grl{padding:10px 12px;}
              .gr-pip{width:12px;height:12px;}
              .wck,.wdm{width:20px;height:20px;}
              .wp-close{width:28px;height:28px;font-size:16px;}
              .nova-lbl{font-size:11px;}
              .nova-pct{font-size:14px;}
              .nova-status{font-size:11px;}
              .plan-lbl{font-size:11px;}
              .plan-item-title{font-size:11px;}
              .plan-item-meta{font-size:10px;}
              .plan-refresh-btn{font-size:10px;}
            }

            /* Extra large screens (4K, >= 2560px) - very zoomed in */
            @media (min-width: 2560px) {
              .sig{width:276px;}
              .wp.open{width:460px;}
              .wpi{width:460px;}
              .sec{padding:22px 22px 16px;}
              .sig-add{margin:10px 22px 16px;padding:13px;}
              .wp-hd{padding:24px 24px 20px;}
              .wp-pg{padding:18px 24px;}
              .wp-bdy{padding:18px 24px 10px;}
              .wp-ai{margin:14px 22px 22px;}
              .wp-ai-h{padding:16px 22px 14px;}
              .wp-ai-b{padding:16px 22px;}
              .wp-ai-orb{width:44px;height:44px;}
              .wp-ai-orb svg{width:18px;height:18px;}
              .ctb{padding:22px 28px;}
              .fci-ico{width:36px;height:36px;}
              .fci-ico svg{width:14px;height:14px;}
              .fci{padding:12px 14px;}
              .grl{padding:12px 14px;}
              .gr-pip{width:14px;height:14px;}
              .wck,.wdm{width:22px;height:22px;}
              .wp-close{width:32px;height:32px;font-size:18px;}
              .nova-lbl{font-size:13px;}
              .nova-pct{font-size:17px;}
              .nova-status{font-size:13px;}
              .plan-lbl{font-size:13px;}
              .plan-item-title{font-size:13px;}
              .plan-item-meta{font-size:12px;}
              .plan-refresh-btn{font-size:12px;}
            }

            /* Very small viewports - absolute minimums */
            @media (max-width: 1200px) {
              .sig{width:138px;}
              .wp.open{width:253px;}
              .wpi{width:253px;}
              .sec{padding:8px 9px 5px;}
              .fci-ico{width:20px;height:20px;}
              .wp-ai-orb{width:24px;height:24px;}
            }
          `}</style>

          <div className="app-shell">
            {/* ═══ SIGNAL ═══ */}
            <div className={`sig${sidebarCollapsed ? ' collapsed' : ''}`}>
              {/* ── Collapse toggle on the right edge of the sidebar ── */}
              <button
                onClick={() => setSidebarCollapsed(v => !v)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{
                  position:'absolute',
                  right: sidebarCollapsed ? -14 : -14,
                  top: 12,
                  zIndex: 60,
                  background:'none', border:'none',
                  color: T.muted, cursor:'pointer', fontSize:10,
                  fontFamily:"'IBM Plex Mono',monospace", lineHeight:1,
                  padding:'4px 2px',
                  transition:'all .14s', opacity:0.4,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=T.text; }}
                onMouseLeave={e => { e.currentTarget.style.opacity='0.4'; e.currentTarget.style.color=T.muted; }}
              >{sidebarCollapsed ? '▸' : '◂'}</button>

              <NovaSidebarBlock
                novaState={novaState}
                mainPage={mainPage}
                onOpenInsights={() => setMainPage('nova-insights')}
                onBackToHQ={() => setMainPage('hq')}
              />
              <ProgramsList
                collapsed={sidebarCollapsed}
                mainPage={mainPage}
                onOpenProgram={(id) => setMainPage(`program-${id}`)}
                onBackToHQ={() => setMainPage('hq')}
                addSyncEvent={addSyncEvent}
                onOpenProgramWithPage={onOpenProgramWithPage}
                onSubNavNavigate={(programId, subNavId) => {
                  setMainPage(`program-${programId}`);
                  // Defer the sub-nav navigation so the program panel renders first
                  setTimeout(() => onSubNav(subNavId), 50);
                }}
              />
            </div>

            {/* ═══ COMMAND ═══ */}
            <div className="cmd">
              {/* Top bar — nav buttons */}
              <div className="ctb" style={{ justifyContent: isProgram(mainPage) ? 'space-between' : 'flex-end' }}>
                {/* Back button — shown when a program is active */}
                {isProgram(mainPage) && (
                  <button
                    className="cbtn"
                    onClick={() => { setMainPage('hq'); setShowStartupCanvas(true); }}
                    style={{
                      background: 'transparent',
                      borderColor: T.border,
                      color: T.text,
                    }}
                  >
                    ← Back
                  </button>
                )}
                <div style={{ display:'flex', gap:4 }}>
                  {[
                    { page:'tracking',  label:'Track',    color:T.blue,   icon: () => <TrackIcon color={T.blue} /> },
                    { page:'settings',  label:'Settings', color:T.purple, icon: () => <SettingsIcon color={T.purple} /> },
                    { page:'mindcheck', label:'Mind',     color:T.green,  icon: () => <MindIcon color={T.green} /> },
                  ].map(({ page, label, color, icon }) => {
                    const isActive = mainPage === page;
                    return (
                      <button
                        key={page}
                        className="cbtn"
                        onClick={() => { setMainPage(page); closeWaypoint(); }}
                        style={{
                          background: isActive ? `${color}18` : 'transparent',
                          borderColor: isActive ? `${color}50` : undefined,
                          color: isActive ? color : undefined,
                        }}
                      >
                        {icon()}
                        <span style={{ marginLeft:4 }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body */}
              <div className="cbody">
                {isCanvasPage(mainPage) && showStartupCanvas ? (
                  <StartupCanvas
                    lastProgram={getLastActiveProgram(novaState?.programChats)}
                    focusMode={focusMode}
                    novaState={novaState}
                    novaLoading={novaLoading}
                    pendingAutoStart={pendingAutoStart}
                    onDismiss={() => setShowStartupCanvas(false)}
                    onNavigate={(page) => {
                      setMainPage(page);
                      setShowStartupCanvas(false);
                      if (page === 'program-briefing') {
                        setActivePage('briefing-chat');
                        activePageRef.current = 'briefing-chat';
                      }
                    }}
                    onResumeFocus={() => {
                      if (focusMode) {
                        setFocusMode({ ...focusMode, active: true });
                        setShowStartupCanvas(false);
                      }
                    }}
                    streakDays={streakDays}
                    lastActiveDate={lastActiveDate}
                    onwardItems={onwardItems}
                    projects={projects}
                    T={T}
                  />
                ) : isCanvasPage(mainPage) && (
                  <div className="cv" style={{ cursor: activePage === 'goals' ? (dragging ? 'grabbing' : 'grab') : activePage === 'onward' ? 'default' : 'pointer', position: 'relative', overflow: activePage === 'onward' ? 'auto' : 'hidden', width: (activePage === 'onward' && waypointOpen) ? 'calc(100% - 244px)' : '100%', transition: 'width 0.4s cubic-bezier(.4,0,.2,1)', scrollbarWidth: 'thin', scrollbarColor: `${T.border} ${T.bg}` }}>
                    <canvas
                      ref={canvasRef}
                      style={{ position:'absolute', top:0, left:0 }}
                      onMouseDown={onCanvasMouseDown}
                      onMouseMove={onCanvasMouseMove}
                      onMouseUp={onCanvasMouseUp}
                      onMouseLeave={onCanvasMouseUp}
                      onDragOver={onCanvasDragOver}
                      onDragLeave={onCanvasDragLeave}
                      onDrop={onCanvasDrop}
                    />
                    {activePage === 'skills' && (
                      <div style={{ position: 'absolute', inset: 0, background: '#07090f', overflowY: 'auto', zIndex: 10 }}>
                        <SkillsView skills={xpSkills} goals={projects} streakDays={streakDays} onUpdateSkillMeta={handleUpdateSkillMeta} />
                      </div>
                    )}
                    {activePage === 'paths' && (
                      <div style={{ position: 'absolute', inset: 0, background: '#07090f', overflowY: 'auto', zIndex: 10 }}>
                        <PathsView />
                      </div>
                    )}
                    {activePage === 'worklogs' && (
                      <div style={{ position: 'absolute', inset: 0, background: '#07090f', overflowY: 'auto', zIndex: 10 }}>
                        <WorkLogsView />
                      </div>
                    )}
                    {activePage === 'briefing-chat' && isProgram(mainPage) && (() => {
                      const progId = extractProgId(mainPage);
                      return (
                        <div style={{ position: 'absolute', inset: 0, background: '#07090f', zIndex: 10, display: 'flex', flexDirection: 'column', padding: 16 }}>
                          <NOVAProgramPanel
                            progId={progId}
                            novaState={novaState}
                            setNovaState={setNovaState}
                            novaChatInput={novaChatInput}
                            setNovaChatInput={setNovaChatInput}
                            novaLoading={novaLoading}
                            sendNOVAMessage={sendNOVAMessage}
                            addSyncEvent={addSyncEvent}
                            setOnwardItems={setOnwardItems}
                            uid={uid}
                            onBack={() => setActivePage(PROGRAM_DEFAULT_PAGES[progId] || 'goals')}
                            T={T}
                            onNewSession={onNewSession}
                            buildNOVASystemPrompt={buildNOVASystemPrompt}
                            onwardItems={onwardItems}
                            projects={projects}
                            selectedForToday={selectedForToday}
                            setSelectedForToday={setSelectedForToday}
                            deferredItems={deferredItems}
                            setDeferredItems={setDeferredItems}
                            backlogItems={backlogItems}
                            setBacklogItems={setBacklogItems}
                            onBreakdownTask={handleBreakdownTask}
                            sessions={sessions}
                            brainDumpEntries={brainDumpEntries}
                            onBrainDump={handleBrainDump}
                            journalEntries={journalEntries}
                            onJournalEntry={handleJournalEntry}
                            onBreakdownSuggestion={handleBreakdownSuggestion}
                            novaRetry={novaRetry}
                            confirmInsight={confirmInsight}
                            dismissInsight={dismissInsight}
                            onSubNav={onSubNav}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
                {/* ── Program Sub-Nav Overlay ── */}
                {isProgram(mainPage) && PROGRAMS_WITH_CANVAS.includes(mainPage) && (() => {
                  const progId = extractProgId(mainPage);
                  const SUB_NAVS = {
                    briefing:    [{ id: 'briefing', label: 'BRIEFING', action: 'chat' }],
                    focus:       [{ id: 'onward',   label: 'ONWARD',   action: 'subnav' }, { id: 'worklogs', label: 'WORK LOGS', action: 'subnav' }],
                  };
                  const subNavs = SUB_NAVS[progId] || [];
                  return (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0,
                      zIndex: 15,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 10,
                      padding: '10px 18px',
                      pointerEvents: 'auto',
                    }}>
                      {subNavs.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            if (sub.action === 'chat') {
                              onSubNav('briefing-chat');
                            } else {
                              onSubNav(sub.id);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: `1px solid ${T.border}`,
                            borderRadius: 4,
                            color: T.muted,
                            cursor: 'pointer',
                            fontSize: 9,
                            padding: '2px 8px',
                            fontFamily: "'IBM Plex Mono',monospace",
                            letterSpacing: '.05em',
                            whiteSpace: 'nowrap',
                          }}
                        >{sub.label}</button>
                      ))}
                    </div>
                  );
                })()}
                {mainPage === 'tracking' && (
                  <TrackingPage
                    projects={projects}
                    onwardItems={onwardItems}
                    sessions={sessions}
                    activeSession={activeSession}
                    trackingPeriod={trackingPeriod}
                    setTrackingPeriod={setTrackingPeriod}
                    startSession={startSession}
                    stopSession={stopSession}
                    sessionDurationMin={sessionDurationMin}
                    getTodayStats={getTodayStats}
                    getSessionsForDay={getSessionsForDay}
                    getSessionsForWeek={getSessionsForWeek}
                    getSessionsForMonth={getSessionsForMonth}
                    todayStr={todayStr}
                    apiKey={apiKey}
                    model={model}
                    geminiInput={geminiInput}
                    setGeminiInput={setGeminiInput}
                    geminiResponse={geminiResponse}
                    setGeminiResponse={setGeminiResponse}
                    geminiLoading={geminiLoading}
                    setGeminiLoading={setGeminiLoading}
                    focus={focus}
                    knowledgePool={knowledgePool}
                    pomodoroPreselect={pomodoroPreselect}
                    onClearPomodoroPreselect={() => setPomodoroPreselect(null)}
                    setMainPage={setMainPage}
                  />
                )}
                {mainPage === 'settings' && (
                  <SettingsPage
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    model={model}
                    setModel={setModel}
                    intensity={intensity}
                    setIntensity={setIntensity}
                    showApiKey={showApiKey}
                    setShowApiKey={setShowApiKey}
                    companionName={companionName}
                    setCompanionName={setCompanionName}
                    setMainPage={setMainPage}
                    buildNOVASystemPrompt={buildNOVASystemPrompt}
                    onNewSession={onNewSession}
                  />
                )}
                {mainPage === 'knowledge-pool' && (
                  <KnowledgePoolPage
                    knowledgePool={knowledgePool}
                    onAdd={addKnowledgeEntry}
                    onDelete={deleteKnowledgeEntry}
                    onEdit={editKnowledgeEntry}
                    onUpdateCorrections={updateCorrections}
                    setMainPage={setMainPage}
                  />
                )}
                {mainPage === 'mindcheck' && (
                  <MindCheckPage routines={routines} setRoutines={setRoutines} setMainPage={setMainPage} />
                )}
                {mainPage === 'nova-insights' && (
                  <NovaInsightsPanel
                    novaState={novaState}
                    apiKey={apiKey}
                    onBack={() => setMainPage('hq')}
                    generateNovaPlan={generateNovaPlan}
                    calcStreak={calcStreak}
                    getWeeklyData={getWeeklyData}
                    recordPlanAccuracy={recordPlanAccuracy}
                  />
                )}
                {/* Programs with canvas: NOVAProgramPanel is rendered in the Waypoint panel instead */}
                {mainPage === 'program-regroup' && (
                  <NOVAProgramPanel
                    progId="regroup"
                    novaState={novaState}
                    setNovaState={setNovaState}
                    novaChatInput={novaChatInput}
                    setNovaChatInput={setNovaChatInput}
                    novaLoading={novaLoading}
                    sendNOVAMessage={sendNOVAMessage}
                    addSyncEvent={addSyncEvent}
                    setOnwardItems={setOnwardItems}
                    uid={uid}
                    onBack={() => setMainPage('hq')}
                    T={T}
                    onNewSession={onNewSession}
                    buildNOVASystemPrompt={buildNOVASystemPrompt}
                    onwardItems={onwardItems}
                    projects={projects}
                    selectedForToday={selectedForToday}
                    setSelectedForToday={setSelectedForToday}
                    deferredItems={deferredItems}
                    setDeferredItems={setDeferredItems}
                    backlogItems={backlogItems}
                    setBacklogItems={setBacklogItems}
                    onBreakdownTask={handleBreakdownTask}
                    sessions={sessions}
                    brainDumpEntries={brainDumpEntries}
                    onBrainDump={handleBrainDump}
                    journalEntries={journalEntries}
                    onJournalEntry={handleJournalEntry}
                    onBreakdownSuggestion={handleBreakdownSuggestion}
                    novaRetry={novaRetry}
                    confirmInsight={confirmInsight}
                    dismissInsight={dismissInsight}
                    onSubNav={onSubNav}
                  />
                )}
              </div>
            </div>

            {/* ═══ WAYPOINT ═══ */}
            <div className={`wp${waypointOpen ? ' open' : ''}`}>
              <div className="wpi">
                {waypointContext?.type === 'goal' && (() => {
                  const proj = projects.find(p => p.id === waypointContext.id);
                  if (!proj) return null;
                  return (
                    <GoalDetailPanel
                      proj={proj}
                      renamingGoalId={renamingGoalId}
                      renameValue={renameValue}
                      setRenamingGoalId={setRenamingGoalId}
                      setRenameValue={setRenameValue}
                      addInput={addInput}
                      setAddInput={setAddInput}
                      toggleSubtask={toggleSubtask}
                      toggleCheckpoint={toggleCheckpoint}
                      deleteSubtask={deleteSubtask}
                      deleteCheckpoint={deleteCheckpoint}
                      addSubtask={addSubtask}
                      addCheckpoint={addCheckpoint}
                      completeGoal={completeGoal}
                      renameGoal={renameGoal}
                      closeWaypoint={closeWaypoint}
                      setConfirmDelete={setConfirmDelete}
                      sunId={sunId}
                      setSunId={setSunId}
                      companionLoading={companionLoading}
                      aiMsg={aiMsg}
                      companionName={companionName}
                      checkIn={checkIn}
                      suggestSubtask={suggestSubtask}
                      topGoals={topGoals}
                      onToggleTopGoal={toggleTopGoal}
                    />
                  );
                })()}

                {waypointContext?.type === 'canvas-panel' && (
                  <CanvasPanelWrapper
                    panelId={waypointContext.id}
                    closeWaypoint={closeWaypoint}
                    onwardItems={onwardItems}
                    onwardForm={onwardForm}
                    setOnwardForm={setOnwardForm}
                    projects={projects}
                    addOnwardItem={addOnwardItem}
                    deleteOnwardItem={deleteOnwardItem}
                    toggleOnwardDone={toggleOnwardDone}
                    selectedId={selectedId}
                    openWaypoint={openWaypoint}
                    setSelectedId={setSelectedId}
                    toggleFocus={toggleFocus}
                    setConfirmDelete={setConfirmDelete}
                    availableTasks={availableTasks}
                    deleteAvailableTask={deleteAvailableTask}
                    setDraggedTask={setDraggedTask}
                    moveOnwardItem={moveOnwardItem}
                    handleStartFocus={handleStartFocus}
                    returnOnwardItemToAvailable={returnOnwardItemToAvailable}
                    backlogItems={backlogItems}
                    deferredItems={deferredItems}
                    selectedForToday={selectedForToday}
                    handleRestoreFromBacklog={handleRestoreFromBacklog}
                    hoveredWeek={hoveredWeek}
                    novaState={novaState}
                    scanWeeklyGoals={scanWeeklyGoals}
                    skills={skills}
                    selectedSkillId={selectedSkillId}
                    updateSkillLevel={updateSkillLevel}
                    addSubskill={addSubskill}
                    prioritizeInput={prioritizeInput}
                    setPrioritizeInput={setPrioritizeInput}
                    generateNovaPlan={generateNovaPlan}
                    apiKey={apiKey}
                    // ── Day navigation props ──
                    selectedOnwardDate={selectedOnwardDate}
                    setSelectedOnwardDate={setSelectedOnwardDate}
                    // ── Goal integration props ──
                    setModal={setModal}
                    topGoals={topGoals}
                    onToggleTopGoal={toggleTopGoal}
                    setSunId={setSunId}
                  />
                )}

                {!waypointContext && (
                  <div className="wp-await">
                    <div className="wp-await-ico">
                      <ClockIcon color={T.muted} />
                    </div>
                    <div className="wp-await-txt">Select a goal or focus area to view details.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── New Goal Modal ── */}
          {modal && (
            <GoalModal
              apiKey={apiKey}
              model={model}
              onClose={() => { setModal(false); setForm({ title:'', desc:'', measurable:'', achievable:'', relevant:'', deadline:'', priority:'low', scale:'short' }); }}
              onCreate={createGoalFromModal}
            />
          )}

          {/* ── Onward Task Popover ── */}
          {onwardClickedItem && (
            <OnwardTaskPopover
              item={onwardItems.find(it => it.id === onwardClickedItem.id) || onwardClickedItem}
              cardX={onwardClickedItem.cardX}
              cardY={onwardClickedItem.cardY}
              projects={projects}
              onStartFocus={(title, goalId) => {
                startSession(title, goalId);
                setOnwardClickedItem(null);
                setMainPage('tracking');
              }}
              onToggleDone={(id) => {
                setOnwardItems(prev => prev.map(it => it.id===id ? { ...it, done: !it.done } : it));
                setOnwardClickedItem(null);
              }}
              onClose={() => setOnwardClickedItem(null)}
            />
          )}

          {/* ── Delete confirmation ── */}
          {confirmDelete && (() => {
            const target = projects.find(p => p.id === confirmDelete);
            return (
              <div className="overlay" onClick={() => setConfirmDelete(null)}>
                <div className="modal" style={{ width:340 }} onClick={e => e.stopPropagation()}>
                  <h2 style={{ color:T.rose, fontSize:16, marginBottom:8 }}>Delete goal?</h2>
                  <p style={{ fontSize:13, color:T.muted, marginBottom:20, lineHeight:1.5 }}>
                    "{target?.title}" and all its subtasks and checkpoints will be permanently removed.
                  </p>
                  <div className="m-btns">
                    <button className="m-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    <button className="m-ok" style={{ background:T.rose }} onClick={() => deleteGoal(confirmDelete)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {showMindCheckCard && (
            <MindCheckCard
              onMoveOn={() => setShowMindCheckCard(false)}
              onMindCheck={() => { setMainPage('mindcheck'); setShowMindCheckCard(false); }}
            />
          )}

          {/* ── Deadline Notifier ── */}
          {showDeadlineNotifier && deadlineAlerts.length > 0 && (
            <DeadlineNotifier
              deadlineAlerts={deadlineAlerts}
              onDismiss={dismissAlerts}
              onViewInMap={() => { dismissAlerts(); setActivePage('map'); }}
            />
          )}

          {/* ── Immersive Focus Screen ── */}
          {focusMode && (
            <FocusScreen
              taskTitle={focusMode.taskTitle}
              taskId={focusMode.taskId}
              goalId={focusMode.goalId}
              onExit={handleExitFocus}
              onSessionComplete={handleFocusSessionComplete}
              onBrainDump={handleBrainDump}
              brainDumpEntries={brainDumpEntries}
              projects={projects}
            />
          )}

          {/* ── NOVA Toast Container ── */}
          {novaInteractions.toastQueue.length > 0 && (
            <div
              style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column-reverse',
                pointerEvents: 'none',
              }}
            >
              {novaInteractions.toastQueue.map((toast) => (
                <div key={toast.id} style={{ pointerEvents: 'auto' }}>
                  <NovaToast
                    toast={toast}
                    onDismiss={novaInteractions.dismissToast}
                    onAction={(action) => {
                      if (action.type === 'open_program') {
                        setMainPage(`program-${action.payload.programId}`);
                      } else if (action.type === 'open_insights') {
                        setMainPage('nova-insights');
                      } else if (action.type === 'open_waypoint') {
                        // Open the currently selected goal or the first project
                        const targetId = selectedId || projects[0]?.id;
                        if (targetId) openWaypoint({ type: 'goal', id: targetId });
                      } else if (action.type === 'start_first_task') {
                        // Navigate to onward panel to start the first accepted task
                        setActivePage('onward');
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      );
    }


export default Meridian;
