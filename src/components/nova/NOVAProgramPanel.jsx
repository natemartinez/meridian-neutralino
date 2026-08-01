import React, { useState, useMemo, useCallback } from 'react';
import RegroupPanel from './RegroupPanel.jsx';
import RetryFeedback from './RetryFeedback.jsx';
import NOVAMessageBlock from './NOVAMessageBlock.jsx';
import TypewriterMessageBlock from './TypewriterMessageBlock.jsx';
import { parseDeferClue } from '../../utils/helpers.js';
import { useNovaInteractionStore } from '../../store/novaInteractionStore.js';

function NOVAProgramPanel({
  progId, novaState, setNovaState, novaChatInput, setNovaChatInput, novaLoading,
  sendNOVAMessage, addSyncEvent, setOnwardItems, uid, onBack, T,
  onNewSession, buildNOVASystemPrompt,
  // New props for Briefing enhancement
  onwardItems, projects, selectedForToday, setSelectedForToday,
  deferredItems, setDeferredItems, backlogItems, setBacklogItems,
  onBreakdownTask,
  // New props for Focus/Re-group
  sessions, brainDumpEntries, onBrainDump, journalEntries, onJournalEntry,
  onBreakdownSuggestion,
  novaRetry,
  confirmInsight,
  dismissInsight,
  // Navigation restructure props
  onOrganize,
  onNewGoal,
  // Sub-nav navigation prop
  onSubNav,
  // Organize action execution (agency guard: only execute after user Confirm)
  createGoalWithPaths,
  linkGoalToPath,
  mergePaths,
  pathsStore,
  setPathsStore,
}) {
  const [showContext, setShowContext] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  // Handle multiple-choice option selection
  const handleOptionSelect = useCallback((optionText) => {
    if (novaLoading) return;
    setSelectedOption(optionText);
    sendNOVAMessage(progId, optionText);
  }, [novaLoading, sendNOVAMessage, progId]);

  // ── Organize: Confirm/Cancel action proposal (agency guard) ──
  const [dismissedActionMsgIdx, setDismissedActionMsgIdx] = useState(null);
  const [executedActionMsgIdx, setExecutedActionMsgIdx] = useState(null);

  const pathTitleById = useMemo(() => {
    const map = {};
    (pathsStore || []).forEach(p => { map[p.id] = p.title; });
    return map;
  }, [pathsStore]);

  const findGoalIdByTitle = useCallback((title) => {
    if (!title) return null;
    const norm = title.trim().toLowerCase();
    return (projects || []).find(p => p.title?.trim().toLowerCase() === norm)?.id || null;
  }, [projects]);

  const describeAction = useCallback((action) => {
    switch (action?.type) {
      case 'create-goal': {
        const cat = action.category ? ` (${action.category})` : '';
        const link = action.pathId ? ` — linked to path "${pathTitleById[action.pathId] || action.pathId}"` : '';
        return `Create goal "${action.goalTitle}"${cat}${link}`;
      }
      case 'link-goal': {
        const pathName = action.pathId ? (pathTitleById[action.pathId] || action.pathId) : 'a path';
        return `Link "${action.goalTitle}" to path "${pathName}"`;
      }
      case 'merge-paths': {
        const names = (action.pathIds || []).map(id => pathTitleById[id] || id);
        return `Merge paths: ${names.join(' + ')}`;
      }
      case 'create-path':
        return `Create new path "${action.goalTitle}"`;
      default:
        return null;
    }
  }, [pathTitleById]);

  const confirmAction = useCallback((action, msgIdx) => {
    if (!action || executedActionMsgIdx !== null) return;
    setExecutedActionMsgIdx(msgIdx);
    try {
      switch (action.type) {
        case 'create-goal': {
          const pathIds = action.pathId ? [action.pathId] : [];
          const goalData = {
            title: action.goalTitle,
            category: action.category || 'short',
            deadline: action.category === 'open' ? null : '',
          };
          if (createGoalWithPaths) {
            createGoalWithPaths(goalData, pathIds);
          } else if (onNewGoal) {
            // Fallback: surface the proposal through the goal modal
            onNewGoal();
          }
          addSyncEvent('organize_action', `create-goal: ${action.goalTitle}`);
          break;
        }
        case 'link-goal': {
          const goalId = findGoalIdByTitle(action.goalTitle);
          if (goalId && action.pathId && linkGoalToPath) {
            linkGoalToPath(goalId, action.pathId);
            addSyncEvent('organize_action', `link-goal: ${action.goalTitle} → ${action.pathId}`);
          } else {
            setExecutedActionMsgIdx(null);
            return;
          }
          break;
        }
        case 'merge-paths': {
          if (action.pathIds && action.pathIds.length >= 2 && mergePaths) {
            mergePaths(action.pathIds[0], action.pathIds[1]);
            addSyncEvent('organize_action', `merge-paths: ${action.pathIds[0]} + ${action.pathIds[1]}`);
          } else {
            setExecutedActionMsgIdx(null);
            return;
          }
          break;
        }
        case 'create-path': {
          if (setPathsStore) {
            setPathsStore(prev => [{
              id: Date.now(),
              title: action.goalTitle,
              description: '',
              color: '#53aaff',
              status: 'active',
              createdAt: new Date().toISOString(),
              milestones: [],
            }, ...prev]);
            addSyncEvent('organize_action', `create-path: ${action.goalTitle}`);
          } else {
            setExecutedActionMsgIdx(null);
            return;
          }
          break;
        }
        default:
          setExecutedActionMsgIdx(null);
          return;
      }
      // Append confirmation to history
      setNovaState(prev => ({
        ...prev,
        programChats: {
          ...prev.programChats,
          [progId]: [
            ...(prev.programChats[progId] || []),
            { role: 'assistant', content: `✓ Applied: ${describeAction(action)}` },
          ],
        },
      }));
    } catch (e) {
      console.error('[Organize] Action execution failed:', e);
      setExecutedActionMsgIdx(null);
    }
  }, [executedActionMsgIdx, createGoalWithPaths, onNewGoal, addSyncEvent, findGoalIdByTitle, linkGoalToPath, mergePaths, setPathsStore, setNovaState, progId, describeAction]);

  const [briefingPhase, setBriefingPhase] = useState('chat'); // 'chat' | 'pick3' | 'breakdown' | 'done'
  const [previewPhase, setPreviewPhase] = useState('regroup_journal'); // 'regroup_journal' | 'planning' | 'confirming' | 'done'
  const [breakdownTask, setBreakdownTask] = useState(null);
  const [breakdownInput, setBreakdownInput] = useState('');

  // ── Briefing handlers (defined before progActions useMemo to avoid TDZ) ──
  const handleBriefingReady = () => {
    setBriefingPhase('pick3');
  };

  const confirmPick3 = () => {
    // Move non-selected items to backlog
    const nonSelected = availableItems.filter(i => !selectedForToday.includes(i.id));
    const newBacklog = nonSelected.map(i => ({
      id: i.id,
      title: i.title,
      goalId: i.goalId || null,
      priority: i.priority || 'low',
      deferredTo: null,
      movedToBacklog: true,
      movedAt: Date.now(),
    }));
    setBacklogItems(prev => {
      const existing = prev.filter(p => !newBacklog.find(n => n.id === p.id));
      return [...existing, ...newBacklog];
    });

    // Auto-defer: scan onwardItems for defer clues (e.g. "Micro 1 - Sat.")
    const today = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const todayName = dayNames[today.getDay()];
    const deferredFromOnward = [];
    (onwardItems || []).forEach(item => {
      const clue = parseDeferClue(item.title);
      if (clue) {
        // If deferred to a future day, move to deferredItems
        const targetDayIndex = dayNames.indexOf(clue.day);
        if (targetDayIndex !== -1 && targetDayIndex !== today.getDay()) {
          deferredFromOnward.push({
            id: item.id,
            title: item.title,
            goalId: item.goalId || null,
            priority: item.priority || 'low',
            deferredTo: clue.day,
            deferredFrom: todayName,
            movedAt: Date.now(),
          });
        }
      }
    });
    if (deferredFromOnward.length > 0) {
      setDeferredItems(prev => {
        const existing = prev.filter(p => !deferredFromOnward.find(n => n.id === p.id));
        return [...existing, ...deferredFromOnward];
      });
    }

    setBriefingPhase('breakdown');
  };

  const finishBriefing = () => {
    setBriefingPhase('done');
    addSyncEvent('briefing_done', `Selected ${selectedForToday.length} objectives`);
    useNovaInteractionStore.getState().fireEvent('briefing_done', {
      selectedCount: selectedForToday.length,
    });
  };

  const PROG_META = {
    briefing:    { label:'Goals',       color:'#F59E0B', desc:'Morning debrief' },
    focus:       { label:'Focus',       color: T.blue,   desc:'Deep focus' },
    preview:     { label:'Preview',     color: T.cyan,   desc:'Plan ahead' },
    calibration: { label:'Paths',       color: T.accent, desc:'Roadmaps & projects' },
    organize:    { label:'Organize',    color:'#ff6b35', desc:'Strategic advisor' },
  };
  const meta     = PROG_META[progId] || PROG_META.briefing;
  const history  = novaState.programChats[progId] || [];
  const isFocus   = progId === 'focus';
  const isBriefing = progId === 'briefing';
  const isPreview = progId === 'preview';
  const isCalibration = progId === 'calibration';
  const isOrganize = progId === 'organize';

  // Latest actionable proposal from NOVA (organize program only).
  // The user must explicitly Confirm before any mutation executes.
  const latestAction = useMemo(() => {
    if (!isOrganize) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.action && msg.action.type && msg.action.type !== 'none') {
        if (executedActionMsgIdx === i || dismissedActionMsgIdx === i) return null;
        return { msg, msgIdx: i };
      }
    }
    return null;
  }, [isOrganize, history, executedActionMsgIdx, dismissedActionMsgIdx]);

  // ── Sub-nav items per program (moved from Compass bar) ──
  const SUB_NAVS = {
    focus:       [{ id: 'onward',   label: 'ONWARD' }, { id: 'worklogs', label: 'WORK LOGS' }],
    preview:     [{ id: 'preview-calendar', label: 'CALENDAR' }],
  };
  const subNavs = SUB_NAVS[progId] || [];
  const focusPlan = novaState.programChats.focus;
  const msgEndRef = React.useRef(null);

  // ── Per-program contextual action buttons ──
  const progActions = useMemo(() => {
    const actions = [];
    if (isBriefing) {
      if (briefingPhase === 'chat' && history.length > 0 && !novaLoading) {
        actions.push({ label:'Pick 3 →', onClick:handleBriefingReady, primary:true });
      } else if (briefingPhase === 'pick3') {
        actions.push({ label:'Confirm & Backlog', onClick:confirmPick3, disabled: selectedForToday.length === 0, primary:true });
      } else if (briefingPhase === 'breakdown') {
        actions.push({ label:'Finish Briefing', onClick:finishBriefing, primary:true });
      }
    }
    if (isFocus && !focusPlan) {
      actions.push({ label:'Generate Plan', onClick:() => sendNOVAMessage(progId), primary:true });
    }
    if (isPreview) {
      actions.push({ label:'Preview Tomorrow', onClick:() => sendNOVAMessage(progId, 'Preview tomorrow'), primary:true });
    }
    if (isCalibration) {
      actions.push({ label:'Run Paths', onClick:() => sendNOVAMessage(progId, 'Run calibration'), primary:true });
    }
    return actions;
  }, [isBriefing, isFocus, isPreview, isCalibration, briefingPhase, history.length, novaLoading, handleBriefingReady, confirmPick3, selectedForToday.length, finishBriefing, focusPlan, sendNOVAMessage, progId]);

  React.useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [history.length, novaLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNOVAMessage(progId); }
  };

  const contextContent = useMemo(() => {
    return buildNOVASystemPrompt ? buildNOVASystemPrompt(progId) : '';
  }, [buildNOVASystemPrompt, progId]);

  // ── Rule of 3: Pick 3 objectives ──
  const today = new Date().toDateString();
  const availableItems = [
    ...onwardItems.filter(it => (!it.date || it.date === today) && !it.done),
    ...(projects || []).flatMap(p => [
      ...(p.checkpoints || []).flatMap(cp =>
        (cp.subtasks || []).filter(st => !st.done).map(st => ({
          id: st.id, title: st.title, goalId: p.id, goalTitle: p.title, goalColor: p.color,
          source: 'subtask', priority: p.priority || 'low',
          checkpointId: cp.id, checkpointTitle: cp.title,
        }))
      ),
    ]),
  ].filter(item => !selectedForToday.includes(item.id));

  const selectedItems = selectedForToday.map(id =>
    availableItems.find(i => i.id === id) ||
    onwardItems.find(i => i.id === id) ||
    { id, title: 'Unknown', priority: 'low' }
  );

  const toggleSelection = (itemId) => {
    setSelectedForToday(prev => {
      if (prev.includes(itemId)) return prev.filter(id => id !== itemId);
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, itemId];
    });
  };

  const startBreakdown = (item) => {
    setBreakdownTask(item);
    setBreakdownInput('');
  };

  const submitBreakdown = () => {
    if (!breakdownInput.trim() || !breakdownTask) return;
    const subTasks = breakdownInput.split('\n').filter(s => s.trim());
    if (subTasks.length === 0) return;
    onBreakdownTask && onBreakdownTask(breakdownTask, subTasks);
    setBreakdownTask(null);
    setBreakdownInput('');
  };

  // ── Pending Insights ──
  const pendingInsights = novaState.pendingInsights || [];
  const hasPendingInsights = pendingInsights.length > 0;

  // ── Validation Warning ──
  const lastValidation = novaState.lastValidation;
  const showValidationWarning = lastValidation && !lastValidation.valid;

  // ── Render ──
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Program header */}
      <div style={{ display:'flex', alignItems:'center', padding:'14px 18px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="wp-ttl" style={{ color:meta.color }}>{meta.label}</div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            {/* ── Per-program contextual action buttons ── */}
            {progActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                disabled={action.disabled}
                style={{
                  background: action.primary ? `${meta.color}18` : 'none',
                  border: `1px solid ${action.primary ? meta.color + '50' : T.border}`,
                  borderRadius: 4,
                  color: action.disabled ? T.muted : (action.primary ? meta.color : T.muted),
                  cursor: action.disabled ? 'default' : 'pointer',
                  fontSize: 9,
                  padding: '2px 8px',
                  fontFamily:"'IBM Plex Mono',monospace",
                  letterSpacing: '.05em',
                  whiteSpace: 'nowrap',
                  opacity: action.disabled ? 0.5 : 1,
                }}
              >{action.label}</button>
            ))}
            {/* ── Briefing sub-nav: Briefing, Organize, + New Goal ── */}
            {isBriefing && (
              <>
                <button
                  onClick={() => { setBriefingPhase('chat'); }}
                  style={{
                    background: briefingPhase === 'chat' ? `${meta.color}18` : 'none',
                    border: `1px solid ${briefingPhase === 'chat' ? meta.color + '50' : T.border}`,
                    borderRadius: 4,
                    color: briefingPhase === 'chat' ? meta.color : T.muted,
                    cursor: 'pointer', fontSize: 9,
                    padding: '2px 8px',
                    fontFamily:"'IBM Plex Mono',monospace",
                    letterSpacing: '.05em',
                    whiteSpace: 'nowrap',
                  }}
                >Briefing</button>
                <button
                  onClick={onOrganize}
                  style={{
                    background: 'none',
                    border: `1px solid ${T.border}`,
                    borderRadius: 4,
                    color: T.muted,
                    cursor: 'pointer', fontSize: 9,
                    padding: '2px 8px',
                    fontFamily:"'IBM Plex Mono',monospace",
                    letterSpacing: '.05em',
                    whiteSpace: 'nowrap',
                  }}
                >⟐ Organize</button>
                <button
                  onClick={onNewGoal}
                  style={{
                    background: 'none',
                    border: `1px solid ${T.border}`,
                    borderRadius: 4,
                    color: T.muted,
                    cursor: 'pointer', fontSize: 9,
                    padding: '2px 8px',
                    fontFamily:"'IBM Plex Mono',monospace",
                    letterSpacing: '.05em',
                    whiteSpace: 'nowrap',
                  }}
                >+ New Goal</button>
              </>
            )}
            {/* ── Per-program sub-nav buttons (moved from Compass bar) ── */}
            {subNavs.length > 0 && (
              <>
                {subNavs.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => onSubNav && onSubNav(sub.id)}
                    style={{
                      background: 'none',
                      border: `1px solid ${T.border}`,
                      borderRadius: 4,
                      color: T.muted,
                      cursor: 'pointer', fontSize: 9,
                      padding: '2px 8px',
                      fontFamily:"'IBM Plex Mono',monospace",
                      letterSpacing: '.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >{sub.label}</button>
                ))}
              </>
            )}
            <>
              <button
                onClick={() => setShowContext(s => !s)}
                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color: showContext ? meta.color : T.muted, cursor:'pointer', fontSize:9, padding:'2px 6px', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'.05em' }}
                title="Toggle system prompt debug view"
              >{showContext ? 'HIDE CTX' : 'SHOW CTX'}</button>
              <button
                onClick={() => onNewSession(progId)}
                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color:T.muted, cursor:'pointer', fontSize:9, padding:'2px 6px', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'.05em' }}
              >NEW SESSION</button>
            </>
          </div>
        </div>
      </div>

      {showContext && (
        <div style={{ margin:'0 12px', padding:'8px 10px', background:'#1a1a2e', border:`1px solid ${meta.color}44`, borderRadius:6, maxHeight:200, overflowY:'auto', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
          <div style={{ color:meta.color, fontSize:8, letterSpacing:'.08em', marginBottom:4 }}>SYSTEM PROMPT CONTEXT</div>
          {contextContent || <span style={{ color:'#666' }}>No context loaded yet.</span>}
        </div>
      )}

      {/* ── Journal Reflection Panel (Preview Phase 1) ── */}
      {isPreview && previewPhase === 'regroup_journal' ? (
        <RegroupPanel
          sessions={sessions || []}
          brainDumpEntries={brainDumpEntries || []}
          onwardItems={onwardItems || []}
          projects={projects || []}
          journalEntries={journalEntries || []}
          onJournalEntry={onJournalEntry}
          onBreakdownSuggestion={onBreakdownSuggestion}
          novaRetry={novaRetry}
        />
      ) : isBriefing && briefingPhase === 'pick3' ? (
        /* ── Rule of 3: Pick 3 Objectives ── */
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{
            fontFamily:"'Syne',sans-serif",
            fontSize: 14, fontWeight: 700,
            color: meta.color, marginBottom: 4,
          }}>Pick 3 Objectives for Today</div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 9, color: T.muted,
            marginBottom: 8, lineHeight: 1.5,
          }}>
            Select exactly 3 priorities. Everything else moves to backlog.
            {selectedForToday.length < 3 && (
              <span style={{ color: T.rose, display:'block', marginTop: 4 }}>
                {3 - selectedForToday.length} more needed
              </span>
            )}
          </div>

          {/* Selected items */}
          {selectedForToday.length > 0 && (
            <div>
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 8, color: T.green,
                letterSpacing: '0.08em', marginBottom: 6,
              }}>SELECTED ({selectedForToday.length}/3)</div>
              {selectedItems.map(item => (
                <div key={item.id} style={{
                  display:'flex', alignItems:'center', gap: 8,
                  padding: '8px 10px', marginBottom: 4,
                  background: `${T.green}12`,
                  border: `1px solid ${T.green}40`,
                  borderLeft: `3px solid ${T.green}`,
                  borderRadius: 6,
                }}>
                  <button
                    onClick={() => toggleSelection(item.id)}
                    style={{
                      background: 'none', border: 'none',
                      color: T.rose, cursor: 'pointer',
                      fontSize: 12, padding: 0, lineHeight: 1,
                    }}
                  >×</button>
                  <span style={{
                    flex: 1,
                    fontFamily:"'IBM Plex Mono',monospace",
                    fontSize: 10, color: T.text,
                  }}>{item.title}</span>
                  {item.goalTitle && (
                    <span style={{
                      fontFamily:"'IBM Plex Mono',monospace",
                      fontSize: 8, color: T.muted,
                    }}>{item.goalTitle}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Available items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 8, color: T.muted,
              letterSpacing: '0.08em', marginBottom: 6,
            }}>AVAILABLE TASKS</div>
            {availableItems.filter(i => !selectedForToday.includes(i.id)).map(item => (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', gap: 8,
                padding: '7px 10px', marginBottom: 4,
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                cursor: selectedForToday.length >= 3 ? 'not-allowed' : 'pointer',
                opacity: selectedForToday.length >= 3 ? 0.5 : 1,
              }} onClick={() => selectedForToday.length < 3 && toggleSelection(item.id)}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: `2px solid ${T.muted}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink: 0,
                }} />
                <span style={{
                  flex: 1,
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize: 10, color: T.text,
                }}>{item.title}</span>
                {item.goalTitle && (
                  <span style={{
                    fontFamily:"'IBM Plex Mono',monospace",
                    fontSize: 8, color: T.muted,
                  }}>{item.goalTitle}</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={confirmPick3}
            disabled={selectedForToday.length === 0}
            style={{
              width: '100%', padding: '10px',
              borderRadius: 6,
              background: selectedForToday.length === 0 ? T.border : `${meta.color}20`,
              border: `1px solid ${selectedForToday.length === 0 ? T.border : meta.color}50`,
              color: selectedForToday.length === 0 ? T.muted : meta.color,
              fontFamily:"'Syne',sans-serif",
              fontSize: 12, fontWeight: 700,
              cursor: selectedForToday.length === 0 ? 'default' : 'pointer',
              letterSpacing: '0.06em',
            }}
          >Confirm & Move to Backlog</button>
        </div>
      ) : isBriefing && briefingPhase === 'breakdown' ? (
        /* ── Micro-Goal Breakdown ── */
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap: 12 }}>
          <div style={{
            fontFamily:"'Syne',sans-serif",
            fontSize: 14, fontWeight: 700,
            color: meta.color, marginBottom: 4,
          }}>Break Down Your Objectives</div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 9, color: T.muted,
            lineHeight: 1.5,
          }}>
            Split each objective into pomodoro-sized chunks (~25 min each).
            Click a task to break it down.
          </div>

          {selectedItems.map(item => (
            <div key={item.id} style={{
              padding: '10px 12px',
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
            }}>
              <div style={{
                display:'flex', alignItems:'center', gap: 8,
                marginBottom: breakdownTask?.id === item.id ? 8 : 0,
              }}>
                <span style={{
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize: 10, color: T.text, flex: 1,
                }}>{item.title}</span>
                {breakdownTask?.id !== item.id && (
                  <button
                    onClick={() => startBreakdown(item)}
                    style={{
                      background: `${meta.color}15`,
                      border: `1px solid ${meta.color}40`,
                      borderRadius: 4, padding: '3px 8px',
                      color: meta.color,
                      fontFamily:"'IBM Plex Mono',monospace",
                      fontSize: 8, cursor: 'pointer',
                    }}
                  >Break Down</button>
                )}
              </div>
              {breakdownTask?.id === item.id && (
                <div>
                  <textarea
                    value={breakdownInput}
                    onChange={e => setBreakdownInput(e.target.value)}
                    placeholder={`Break "${item.title}" into sub-tasks, one per line:\ne.g. Research API docs\nImplement core logic\nWrite tests`}
                    rows={4}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: T.bg, border: `1px solid ${T.border}`,
                      borderRadius: 6, padding: '7px 9px',
                      color: T.text, fontFamily:"'IBM Plex Mono',monospace",
                      fontSize: 10, outline: 'none', resize: 'vertical',
                      lineHeight: 1.5,
                    }}
                  />
                  <div style={{ display:'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={() => setBreakdownTask(null)}
                      style={{
                        flex: 1, padding: '6px',
                        borderRadius: 4,
                        background: 'transparent',
                        border: `1px solid ${T.border}`,
                        color: T.muted,
                        fontFamily:"'Syne',sans-serif",
                        fontSize: 10, cursor: 'pointer',
                      }}
                    >Cancel</button>
                    <button
                      onClick={submitBreakdown}
                      disabled={!breakdownInput.trim()}
                      style={{
                        flex: 1, padding: '6px',
                        borderRadius: 4,
                        background: `${meta.color}20`,
                        border: `1px solid ${meta.color}50`,
                        color: meta.color,
                        fontFamily:"'Syne',sans-serif",
                        fontSize: 10, fontWeight: 700,
                        cursor: breakdownInput.trim() ? 'pointer' : 'default',
                        opacity: breakdownInput.trim() ? 1 : 0.5,
                      }}
                    >Save Breakdown</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={finishBriefing}
            style={{
              width: '100%', padding: '10px',
              borderRadius: 6,
              background: `${T.green}20`,
              border: `1px solid ${T.green}50`,
              color: T.green,
              fontFamily:"'Syne',sans-serif",
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              marginTop: 8,
            }}
          >✓ Finish Briefing</button>
        </div>
      ) : isBriefing && briefingPhase === 'done' ? (
        /* ── Briefing Complete ── */
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: 24 }}>
          <div style={{
            fontFamily:"'Syne',sans-serif",
            fontSize: 20, fontWeight: 800,
            color: T.green, marginBottom: 12,
          }}>Briefing Complete ✦</div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 11, color: T.muted,
            textAlign: 'center', lineHeight: 1.7,
            marginBottom: 20,
          }}>
            {selectedForToday.length} objectives selected.<br/>
            Non-selected tasks moved to backlog.
          </div>
          <button
            onClick={onBack}
            style={{
              padding: '10px 28px',
              borderRadius: 6,
              background: `${meta.color}20`,
              border: `1px solid ${meta.color}50`,
              color: meta.color,
              fontFamily:"'Syne',sans-serif",
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >Start Your Day</button>
        </div>
      ) : isFocus ? (
        /* ── Focus Program ── */
        <div style={{ flex:1, overflowY:'auto', padding:'0 12px', display:'flex', flexDirection:'column', gap:8 }}>
          {focusPlan && focusPlan !== '__loading__' ? (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', marginTop:8 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:meta.color, letterSpacing:'.08em', marginBottom:6 }}>ACTION PLAN</div>
              <NOVAMessageBlock content={focusPlan} color={meta.color} />
            </div>
          ) : focusPlan === '__loading__' ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted }}>NOVA is thinking…</div>
          ) : (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, textAlign:'center', padding:'20px 0', lineHeight:1.8 }}>
              Tell NOVA what you need to lock in on.<br/>Get a sharp action plan back.
            </div>
          )}
          {/* ── Inline error toast for Focus ── */}
          {(novaRetry?.error || novaRetry?.cooldownActive) && (
            <RetryFeedback
              loading={novaRetry.loading}
              error={novaRetry.error}
              attempt={novaRetry.attempt}
              maxRetries={novaRetry.maxRetries}
              cached={novaRetry.cached}
              cooldownActive={novaRetry.cooldownActive}
              cooldownRemaining={novaRetry.cooldownRemaining}
              onRefresh={() => sendNOVAMessage(progId, 'Retry generating action plan')}
              size="sm"
            />
          )}
        </div>
      ) : (isBriefing || isPreview || isCalibration || isOrganize) && (
        /* ── Briefing / Preview / Calibration / Organize Chat ── */
        <div style={{ flex:1, overflowY:'auto', padding:'0 12px', display:'flex', flexDirection:'column', gap:8 }}>
          {history.length === 0 && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:T.muted, textAlign:'center', padding:'20px 0', lineHeight:1.8 }}>
              {isPreview ? 'Plan your next day with NOVA.' : isCalibration ? 'Manage your personal projects and roadmaps.' : isOrganize ? 'NOVA will analyze your goals, paths, and gaps — then propose actions for you to approve.' : 'Start your morning debrief with NOVA.'}
            </div>
          )}
          {history.map((msg, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth:'85%', padding:'7px 10px', borderRadius: msg.role === 'user' ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                background: msg.role === 'user' ? `${meta.color}22` : T.card,
                border: `1px solid ${msg.role === 'user' ? meta.color + '44' : T.border}`,
              }}>
                {msg.role === 'user' ? (
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, color:T.text, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                    {msg.content}
                  </span>
                ) : (
                  <TypewriterMessageBlock
                    content={msg.content}
                    color={meta.color}
                    onOptionSelect={handleOptionSelect}
                    options={msg.options}
                    isLatest={i === history.length - 1}
                    typewriterDelay={8}
                  />
                )}
              </div>
            </div>
          ))}

          {/* ── Organize: Action proposal summary + Confirm/Cancel (agency guard) ── */}
          {latestAction && (() => {
            const { msg, msgIdx } = latestAction;
            const summary = describeAction(msg.action);
            return (
              <div style={{
                alignSelf:'flex-start', maxWidth:'92%',
                padding:'10px 12px', borderRadius:8,
                background:`${meta.color}0d`,
                border:`1px solid ${meta.color}55`,
                display:'flex', flexDirection:'column', gap:8,
              }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:meta.color, letterSpacing:'.08em' }}>NOVA PROPOSES</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:T.text, lineHeight:1.5 }}>
                  {summary || 'Unrecognized action proposal'}
                </div>
                {msg.action.reason && (
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, lineHeight:1.5 }}>
                    Why: {msg.action.reason}
                  </div>
                )}
                <div style={{ display:'flex', gap:6, marginTop:2 }}>
                  <button
                    onClick={() => confirmAction(msg.action, msgIdx)}
                    disabled={novaLoading}
                    style={{
                      flex:1, padding:'5px 0', borderRadius:4,
                      background: meta.color, border:'none', color:'#000',
                      fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700,
                      cursor: novaLoading ? 'default' : 'pointer',
                    }}
                  >✓ Confirm</button>
                  <button
                    onClick={() => setDismissedActionMsgIdx(msgIdx)}
                    disabled={novaLoading}
                    style={{
                      flex:1, padding:'5px 0', borderRadius:4,
                      background:'none', border:`1px solid ${T.border}`, color:T.muted,
                      fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700,
                      cursor: novaLoading ? 'default' : 'pointer',
                    }}
                  >✕ Cancel</button>
                </div>
              </div>
            );
          })()}

          {novaLoading && (
            <div style={{ display:'flex', alignItems:'flex-start' }}>
              <div style={{ padding:'7px 12px', borderRadius:'8px 8px 8px 2px', background:T.card, border:`1px solid ${T.border}`, fontFamily:"'IBM Plex Mono',monospace", fontSize:14, color:T.muted }}>
                ···
              </div>
            </div>
          )}
          <div ref={msgEndRef} />
        </div>
      )}
      
      {/* ── Validation Warning ── */}
      {showValidationWarning && (
        <div style={{ padding:'4px 12px', flexShrink:0 }}>
          <div style={{
            padding:'6px 10px', borderRadius:4,
            background: `${T.rose}15`,
            border: `1px solid ${T.rose}40`,
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize:8, color: T.rose,
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span>⚠</span>
            <span>NOVA response may need review: {lastValidation.reason}</span>
          </div>
        </div>
      )}

      {/* ── Pending Insights Confirmation ── */}
      {hasPendingInsights && (
        <div style={{ padding:'4px 12px', borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize:8, color: T.accent,
            letterSpacing:'.08em', marginBottom:4,
          }}>PENDING INSIGHTS ({pendingInsights.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {pendingInsights.map(insight => (
              <div key={insight.id} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'5px 8px',
                background: T.card,
                border:`1px solid ${T.border}`,
                borderRadius:4,
              }}>
                <span style={{
                  flex:1,
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize:9, color: T.text,
                  lineHeight:1.4,
                }}>
                  {insight.type === 'knowledge'
                    ? (insight.content?.text || insight.content)
                    : (insight.text || insight.label || insight.content)}
                </span>
                <button
                  onClick={() => confirmInsight && confirmInsight(insight.id)}
                  title="Accept insight"
                  style={{
                    background:`${T.green}20`,
                    border:`1px solid ${T.green}50`,
                    borderRadius:3, color: T.green,
                    cursor:'pointer', fontSize:10,
                    padding:'1px 6px', lineHeight:1.4,
                    fontFamily:"'IBM Plex Mono',monospace",
                  }}
                >✓</button>
                <button
                  onClick={() => dismissInsight && dismissInsight(insight.id)}
                  title="Dismiss insight"
                  style={{
                    background:'none',
                    border:`1px solid ${T.border}`,
                    borderRadius:3, color: T.muted,
                    cursor:'pointer', fontSize:10,
                    padding:'1px 6px', lineHeight:1.4,
                    fontFamily:"'IBM Plex Mono',monospace",
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inline error toast for Briefing/Preview (outside scrollable area so always visible) ── */}
      {(isBriefing || isPreview) && (novaRetry?.error || novaRetry?.cooldownActive) && (
        <div style={{ padding:'0 12px', flexShrink:0 }}>
          <RetryFeedback
            loading={novaRetry.loading}
            error={novaRetry.error}
            attempt={novaRetry.attempt}
            maxRetries={novaRetry.maxRetries}
            cached={novaRetry.cached}
            cooldownActive={novaRetry.cooldownActive}
            cooldownRemaining={novaRetry.cooldownRemaining}
            onRefresh={() => sendNOVAMessage(progId)}
            size="sm"
          />
        </div>
      )}

      {/* ── Suggested Tasks (for Briefing and Preview) ── */}
      {(isBriefing || isPreview) && novaState.suggestedTasks.length > 0 && (
        <div style={{ padding:'8px 12px', borderTop:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.08em', marginBottom:6 }}>NOVA SUGGESTS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {novaState.suggestedTasks.filter(t => t.accepted === null).map(task => (
              <div key={task.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.text, lineHeight:1.5 }}>{task.text}</div>
                <button
                  onClick={() => {
                    setOnwardItems(prev => [...prev, { id: uid(), title: task.text, hour: 480, priority: 'low', goalId: null, novaTaskId: task.id, done: false, createdAt: Date.now() }]);
                    setNovaState(prev => ({ ...prev, suggestedTasks: prev.suggestedTasks.map(t => t.id === task.id ? { ...t, accepted: true } : t) }));
                    addSyncEvent('task_accepted', task.text);
                    useNovaInteractionStore.getState().fireEvent('task_accepted', { title: task.text });
                  }}
                  style={{ background:`${meta.color}22`, border:`1px solid ${meta.color}55`, borderRadius:4, color:meta.color, cursor:'pointer', fontSize:9, padding:'2px 6px', fontFamily:"'IBM Plex Mono',monospace", whiteSpace:'nowrap' }}
                >+ Onward</button>
                <button
                  onClick={() => {
                    setNovaState(prev => ({ ...prev, suggestedTasks: prev.suggestedTasks.map(t => t.id === task.id ? { ...t, accepted: false } : t) }));
                    addSyncEvent('task_rejected', task.text);
                  }}
                  style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color:T.muted, cursor:'pointer', fontSize:9, padding:'2px 6px', fontFamily:"'IBM Plex Mono',monospace" }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat Input (for Briefing chat phase, Preview, Calibration, and Focus) ── */}
      {((isBriefing && briefingPhase === 'chat') || isPreview || isCalibration || isOrganize || (isFocus && !focusPlan)) && (
        <div style={{ padding:'8px 12px 12px', borderTop:`1px solid ${T.border}`, display:'flex', gap:6 }}>
          <textarea
            value={novaChatInput}
            onChange={e => setNovaChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isFocus ? "What do you need to lock in on?" : "Message NOVA…"}
            rows={2}
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 9px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', resize:'none', lineHeight:1.5 }}
          />
          <button
            onClick={() => sendNOVAMessage(progId)}
            disabled={novaLoading || !novaChatInput.trim()}
            style={{ background: novaLoading || !novaChatInput.trim() ? T.border : meta.color, border:'none', borderRadius:6, color:'#000', cursor: novaLoading || !novaChatInput.trim() ? 'default' : 'pointer', padding:'0 10px', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, transition:'background .15s', alignSelf:'stretch' }}
          >→</button>
        </div>
      )}

      {/* ── Briefing: Proceed to Pick 3 button (shown after chat has messages, not for Preview) ── */}
      {isBriefing && briefingPhase === 'chat' && history.length > 0 && !novaLoading && !isPreview && (
        <div style={{ padding:'4px 12px 10px' }}>
          <button
            onClick={handleBriefingReady}
            style={{
              width: '100%', padding: '8px',
              borderRadius: 6,
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}40`,
              color: meta.color,
              fontFamily:"'Syne',sans-serif",
              fontSize: 11, fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >Ready — Pick 3 Objectives →</button>
        </div>
      )}
    </div>
  );
}

export default NOVAProgramPanel;
