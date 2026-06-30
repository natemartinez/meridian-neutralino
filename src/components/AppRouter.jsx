import React from 'react';
import { T, NODE_PALETTE } from '../utils/theme.js';
import { uid } from '../utils/helpers.js';
import { getLastActiveProgram } from '../utils/nova.js';
import { PROGRAMS_WITH_CANVAS, PROGRAM_DEFAULT_PAGES, isCanvasPage, isProgram, extractProgId } from '../constants/programs.js';
import { TrackIcon, SettingsIcon, MindIcon, ClockIcon } from './icons.jsx';
import useAppStyles from '../hooks/useAppStyles.jsx';

import TrackingPage from './TrackingPage.jsx';
import SettingsPage from './SettingsPage.jsx';
import MindCheckPage from './MindCheckPage.jsx';
import KnowledgePoolPage from './KnowledgePoolPage.jsx';
import MindCheckCard from './MindCheckCard.jsx';
import SkillsView from './views/SkillsView.jsx';
import PathsView from './views/PathsView.jsx';
import WorkLogsView from './views/WorkLogsView.jsx';
import GoalModal from './panels/GoalModal.jsx';
import FocusScreen from './views/FocusScreen.jsx';
import DeadlineNotifier from './DeadlineNotifier.jsx';
import OnwardTaskPopover from './OnwardTaskPopover.jsx';
import GoalDetailPanel from './panels/GoalDetailPanel.jsx';
import CanvasPanelWrapper from './panels/CanvasPanelWrapper.jsx';
import NovaSidebarBlock from './nova/NovaSidebarBlock.jsx';
import ProgramsList from './nova/ProgramsList.jsx';
import NovaInsightsPanel from './nova/NovaInsightsPanel.jsx';
import NOVAProgramPanel from './nova/NOVAProgramPanel.jsx';
import NovaToast from './nova/NovaToast.jsx';
import StartupCanvas from './nova/StartupCanvas.jsx';

/**
 * AppRouter — renders the full JSX tree for the Meridian application.
 *
 * Receives all state values, setters, refs, and handler functions as props
 * and renders the complete UI: sidebar, command area, waypoint panel, modals,
 * overlays, and toast notifications.
 */
export default function AppRouter({
  // ── State values & setters ──
  projects, setProjects,
  selectedId, setSelectedId,
  focus, setFocus,
  modal, setModal,
  aiMsg, setAiMsg,
  companionLoading, setCompanionLoading,
  pan, setPan,
  dragging, setDragging,
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
  pendingAutoStart,
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
  setForm,

  // ── Refs ──
  canvasRef,
  activePageRef,

  // ── NOVA ──
  novaState, setNovaState,
  novaChatInput, setNovaChatInput,
  novaLoading, knowledgePool,
  addSyncEvent, onNewSession,
  addKnowledgeEntry, deleteKnowledgeEntry, editKnowledgeEntry,
  updateCorrections, sendNOVAMessage,
  generateNovaPlan, buildNOVASystemPrompt,
  scanWeeklyGoals, novaRetry,
  confirmInsight, dismissInsight, recordPlanAccuracy,

  // ── NOVA Interactions ──
  novaInteractions,

  // ── Tracking ──
  todayStr, sessionDurationMin,
  getSessionsForDay, getSessionsForWeek, getSessionsForMonth,
  getTodayStats, startSession, stopSession,
  calcStreak, getWeeklyData,

  // ── Streak ──
  streakDays, lastActiveDate,

  // ── Deadline alerts ──
  showDeadlineNotifier, deadlineAlerts, dismissAlerts,

  // ── Waypoint / navigation helpers ──
  openWaypoint, closeWaypoint,
  onOpenProgramWithPage, onSubNav,

  // ── Canvas mouse handlers ──
  onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp,
  onCanvasDragOver, onCanvasDragLeave, onCanvasDrop,

  // ── Event handlers ──
  createGoalFromModal,
  addOnwardItem,
  deleteOnwardItem,
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
}) {
  const appStyles = useAppStyles();
  const selected  = projects.find((p) => p.id === selectedId);
  const colorFor  = (i) => NODE_PALETTE[i % NODE_PALETTE.length];

  return (
    <>
      {appStyles}

      <div className="app-shell" style={{ position:'relative' }}>
        {/* ═══ SIGNAL ═══ */}
        <div className={`sig${sidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="sig-inner">
            <NovaSidebarBlock
              novaState={novaState}
              mainPage={mainPage}
              onOpenInsights={() => setMainPage('nova-insights')}
              onBackToHQ={() => { setMainPage('hq'); setShowStartupCanvas(true); closeWaypoint(); }}
            />
            <ProgramsList
              collapsed={sidebarCollapsed}
              mainPage={mainPage}
              onOpenProgram={(id) => setMainPage(`program-${id}`)}
              onBackToHQ={() => { setMainPage('hq'); setShowStartupCanvas(true); closeWaypoint(); }}
              addSyncEvent={addSyncEvent}
              onOpenProgramWithPage={onOpenProgramWithPage}
              onSubNavNavigate={(programId, subNavId) => {
                setMainPage(`program-${programId}`);
                // Map 'briefing' sub-nav to 'briefing-chat' page
                const page = (programId === 'briefing' && subNavId === 'briefing') ? 'briefing-chat' : subNavId;
                setTimeout(() => onSubNav(page), 50);
              }}
            />
          </div>

          {/* ── Full-height collapse toggle strip on the right edge of .sig ── */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              position:'absolute',
              right: -18,
              top: 0,
              bottom: 0,
              zIndex: 60,
              width: 18,
              height: '100%',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              background: `${T.surface}`,
              border: `1px solid ${T.border}`,
              borderLeft: 'none',
              borderRadius: 0,
              color: T.muted,
              cursor:'pointer',
              fontSize: 11,
              fontFamily:"'IBM Plex Mono',monospace",
              lineHeight:1,
              padding:0,
              transition:'opacity .2s ease',
              opacity:0.5,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=T.text; e.currentTarget.style.borderColor='#7a8ba3'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity='0.5'; e.currentTarget.style.color=T.muted; e.currentTarget.style.borderColor=T.border; }}
          >{sidebarCollapsed ? '▸' : '◂'}</button>
        </div>

        {/* ═══ COMMAND ═══ */}
        <div className="cmd">
          {/* Top bar — nav buttons */}
          <div className="ctb" style={{ justifyContent: isProgram(mainPage) ? 'space-between' : 'flex-end' }}>
            {isProgram(mainPage) && (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {(() => {
                  const progId = extractProgId(mainPage);
                  const labelMap = { briefing:'Goals', focus:'Focus', regroup:'Re-group', preview:'Preview', calibration:'Paths' };
                  const label = labelMap[progId];
                  if (!label) return null;
                  const isBriefing = progId === 'briefing';
                  return isBriefing ? (
                    <button
                      onClick={() => setModal(true)}
                      style={{
                        fontFamily:"'IBM Plex Mono',monospace",
                        fontSize:11,
                        fontWeight:600,
                        color:T.text,
                        background:`${T.accent}18`,
                        border:`1px solid ${T.accent}40`,
                        borderRadius:8,
                        padding:'5px 12px',
                        cursor:'pointer',
                        letterSpacing:'0.04em',
                        transition:'all .14s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = `${T.accent}28`;
                        e.currentTarget.style.borderColor = `${T.accent}70`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = `${T.accent}18`;
                        e.currentTarget.style.borderColor = `${T.accent}40`;
                      }}
                    >
                      + Create Goal
                    </button>
                  ) : (
                    <span style={{
                      fontFamily:"'Syne',sans-serif",
                      fontSize:16,
                      fontWeight:700,
                      color:T.accent,
                    }}>{label}</span>
                  );
                })()}
              </div>
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
                    onClick={() => { setMainPage(page); }}
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
                    closeWaypoint();
                  } else if (page === 'program-focus') {
                    setActivePage('onward');
                    activePageRef.current = 'onward';
                    openWaypoint({ type: 'canvas-panel', id: 'onward' });
                  } else if (page === 'program-preview') {
                    setActivePage('map');
                    activePageRef.current = 'map';
                    openWaypoint({ type: 'canvas-panel', id: 'map' });
                  } else if (page === 'program-calibration') {
                    setActivePage('paths');
                    activePageRef.current = 'paths';
                    closeWaypoint();
                  }
                }}
                onResumeFocus={() => {
                  if (focusMode) {
                    setFocusMode({ ...focusMode, active: true });
                    setShowStartupCanvas(false);
                  }
                }}
                onSendPreCraftedPrompt={(programId, promptText) => {
                  // 1. Navigate to the target program page
                  const page = `program-${programId}`;
                  setMainPage(page);
                  setShowStartupCanvas(false);
                  if (programId === 'briefing') {
                    setActivePage('briefing-chat');
                    activePageRef.current = 'briefing-chat';
                    closeWaypoint();
                  } else if (programId === 'focus') {
                    setActivePage('onward');
                    activePageRef.current = 'onward';
                    openWaypoint({ type: 'canvas-panel', id: 'onward' });
                  } else if (programId === 'calibration') {
                    setActivePage('paths');
                    activePageRef.current = 'paths';
                    closeWaypoint();
                  }
                  // 2. Brief delay to ensure the program panel is mounted, then send the prompt
                  setTimeout(() => {
                    sendNOVAMessage(programId, promptText);
                  }, 100);
                }}
                onNewSession={(programId) => {
                  if (onNewSession) onNewSession(programId);
                }}
                streakDays={streakDays}
                lastActiveDate={lastActiveDate}
                onwardItems={onwardItems}
                projects={projects}
                selectedForToday={selectedForToday}
                T={T}
              />
            ) : isCanvasPage(mainPage) && (
              <div className="cv" style={{ cursor: activePage === 'goals' ? (dragging ? 'grabbing' : 'grab') : activePage === 'onward' ? 'default' : 'pointer', position: 'relative', overflow: activePage === 'onward' ? 'auto' : 'hidden', width: waypointOpen ? 'calc(100% - 244px)' : '100%', scrollbarWidth: 'thin', scrollbarColor: `${T.border} ${T.bg}` }}>
                <canvas
                  ref={canvasRef}
                  style={{ position:'absolute', top:0, left:20 }}
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseUp}
                  onDragOver={onCanvasDragOver}
                  onDragLeave={onCanvasDragLeave}
                  onDrop={onCanvasDrop}
                />
                {activePage === 'skills' && (
                  <div style={{ position: 'absolute', inset: 0, background: '#0c111a', overflowY: 'auto', zIndex: 10 }}>
                    <SkillsView skills={xpSkills} goals={projects} streakDays={streakDays} onUpdateSkillMeta={handleUpdateSkillMeta} />
                  </div>
                )}
                {activePage === 'paths' && (
                  <div style={{ position: 'absolute', inset: 0, background: '#0c111a', overflowY: 'auto', zIndex: 10 }}>
                    <PathsView />
                  </div>
                )}
                {activePage === 'worklogs' && (
                  <div style={{ position: 'absolute', inset: 0, background: '#0c111a', overflowY: 'auto', zIndex: 10 }}>
                    <WorkLogsView />
                  </div>
                )}
                {activePage === 'briefing-chat' && isProgram(mainPage) && (() => {
                  const progId = extractProgId(mainPage);
                  return (
                    <div style={{ position: 'absolute', inset: 0, background: '#0c111a', zIndex: 10, display: 'flex', flexDirection: 'column', padding: 16 }}>
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
                selectedOnwardDate={selectedOnwardDate}
                setSelectedOnwardDate={setSelectedOnwardDate}
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
                    const targetId = selectedId || projects[0]?.id;
                    if (targetId) openWaypoint({ type: 'goal', id: targetId });
                  } else if (action.type === 'start_first_task') {
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
