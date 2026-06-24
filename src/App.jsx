import { useState, useRef } from 'react';
import { T, NODE_PALETTE } from './utils/theme.js';
import { uid } from './utils/helpers.js';

import ApiKeyScreen from './components/ApiKeyScreen.jsx';
import AppRouter from './components/AppRouter.jsx';
import useAppState from './hooks/useAppState.js';
import useAppCanvas from './hooks/useAppCanvas.js';
import useGoalActions from './hooks/useGoalActions.js';

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

        // Form state (used by GoalModal close handler)
        setForm,
      } = appState;

      // ── Event handlers (goals, onward, skills, focus, AI) ────
      // Must come before useAppCanvas because useAppCanvas needs confirmPendingDrop / cancelPendingDrop
      const {
        createGoalFromModal,
        addOnwardItem,
        confirmPendingDrop,
        cancelPendingDrop,
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
      } = useGoalActions({
        projects, selectedId, apiKey, model, addInput,
        onwardForm, pendingDrop, onwardItems, freeformTasks,
        backlogItems, selected, companionName, knowledgePool,
        novaState, novaInteractions, sunId, colorFor,
        setProjects, setSelectedId, setAiMsg, setCompanionLoading,
        setOnwardItems, setOnwardForm, setFreeformTasks,
        setPendingDrop, setDraggedTask, setDragOverHour,
        setPomodoroPreselect, setFocusMode, setSessions,
        setBrainDumpEntries, setJournalEntries,
        setShowMindCheckCard, setSkills, setXpSkills,
        setTopGoals, setSunId, setConfirmDelete, setAddInput,
        addSyncEvent, generateNovaPlan,
        closeWaypoint,
        updateStreak,
      });

      const selected  = projects.find((p) => p.id === selectedId);
      const colorFor  = (i) => NODE_PALETTE[i % NODE_PALETTE.length];

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


      if (!loaded) return null;
      if (!apiKey) return <ApiKeyScreen onSave={setApiKey} />;

      return (
        <AppRouter
          // ── State values & setters ──
          projects={projects} setProjects={setProjects}
          selectedId={selectedId} setSelectedId={setSelectedId}
          focus={focus} setFocus={setFocus}
          modal={modal} setModal={setModal}
          aiMsg={aiMsg} setAiMsg={setAiMsg}
          companionLoading={companionLoading} setCompanionLoading={setCompanionLoading}
          pan={pan} setPan={setPan}
          dragging={dragging} setDragging={setDragging}
          apiKey={apiKey} setApiKey={setApiKey}
          model={model} setModel={setModel}
          addInput={addInput} setAddInput={setAddInput}
          confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
          activePage={activePage} setActivePage={setActivePage}
          onwardItems={onwardItems} setOnwardItems={setOnwardItems}
          freeformTasks={freeformTasks} setFreeformTasks={setFreeformTasks}
          skills={skills} setSkills={setSkills}
          onwardForm={onwardForm} setOnwardForm={setOnwardForm}
          draggedTask={draggedTask} setDraggedTask={setDraggedTask}
          dragOverHour={dragOverHour} setDragOverHour={setDragOverHour}
          pendingDrop={pendingDrop} setPendingDrop={setPendingDrop}
          availableTasks={availableTasks}
          hoveredWeek={hoveredWeek} setHoveredWeek={setHoveredWeek}
          selectedSkillId={selectedSkillId} setSelectedSkillId={setSelectedSkillId}
          mainPage={mainPage} setMainPage={setMainPage}
          showStartupCanvas={showStartupCanvas} setShowStartupCanvas={setShowStartupCanvas}
          pendingAutoStart={pendingAutoStart}
          intensity={intensity} setIntensity={setIntensity}
          showApiKey={showApiKey} setShowApiKey={setShowApiKey}
          showMindCheckCard={showMindCheckCard} setShowMindCheckCard={setShowMindCheckCard}
          sessions={sessions} setSessions={setSessions}
          activeSession={activeSession} setActiveSession={setActiveSession}
          prioritizeInput={prioritizeInput} setPrioritizeInput={setPrioritizeInput}
          trackingPeriod={trackingPeriod} setTrackingPeriod={setTrackingPeriod}
          geminiInput={geminiInput} setGeminiInput={setGeminiInput}
          geminiResponse={geminiResponse} setGeminiResponse={setGeminiResponse}
          geminiLoading={geminiLoading} setGeminiLoading={setGeminiLoading}
          pomodoroPreselect={pomodoroPreselect} setPomodoroPreselect={setPomodoroPreselect}
          routines={routines} setRoutines={setRoutines}
          focusMode={focusMode} setFocusMode={setFocusMode}
          selectedForToday={selectedForToday} setSelectedForToday={setSelectedForToday}
          deferredItems={deferredItems} setDeferredItems={setDeferredItems}
          backlogItems={backlogItems} setBacklogItems={setBacklogItems}
          brainDumpEntries={brainDumpEntries} setBrainDumpEntries={setBrainDumpEntries}
          journalEntries={journalEntries} setJournalEntries={setJournalEntries}
          waypointOpen={waypointOpen} setWaypointOpen={setWaypointOpen}
          waypointContext={waypointContext} setWaypointContext={setWaypointContext}
          onwardClickedItem={onwardClickedItem} setOnwardClickedItem={setOnwardClickedItem}
          selectedOnwardDate={selectedOnwardDate} setSelectedOnwardDate={setSelectedOnwardDate}
          sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
          sunId={sunId} setSunId={setSunId}
          companionName={companionName} setCompanionName={setCompanionName}
          renamingGoalId={renamingGoalId} setRenamingGoalId={setRenamingGoalId}
          renameValue={renameValue} setRenameValue={setRenameValue}
          topGoals={topGoals} setTopGoals={setTopGoals}
          xpSkills={xpSkills} setXpSkills={setXpSkills}
          resizeDrag={resizeDrag} setResizeDrag={setResizeDrag}
          setForm={setForm}

          // ── Refs ──
          canvasRef={canvasRef}
          activePageRef={activePageRef}

          // ── NOVA ──
          novaState={novaState} setNovaState={setNovaState}
          novaChatInput={novaChatInput} setNovaChatInput={setNovaChatInput}
          novaLoading={novaLoading} knowledgePool={knowledgePool}
          addSyncEvent={addSyncEvent} onNewSession={onNewSession}
          addKnowledgeEntry={addKnowledgeEntry} deleteKnowledgeEntry={deleteKnowledgeEntry}
          editKnowledgeEntry={editKnowledgeEntry} updateCorrections={updateCorrections}
          sendNOVAMessage={sendNOVAMessage}
          generateNovaPlan={generateNovaPlan} buildNOVASystemPrompt={buildNOVASystemPrompt}
          scanWeeklyGoals={scanWeeklyGoals} novaRetry={novaRetry}
          confirmInsight={confirmInsight} dismissInsight={dismissInsight}
          recordPlanAccuracy={recordPlanAccuracy}

          // ── NOVA Interactions ──
          novaInteractions={novaInteractions}

          // ── Tracking ──
          todayStr={todayStr} sessionDurationMin={sessionDurationMin}
          getSessionsForDay={getSessionsForDay} getSessionsForWeek={getSessionsForWeek}
          getSessionsForMonth={getSessionsForMonth}
          getTodayStats={getTodayStats} startSession={startSession}
          stopSession={stopSession} calcStreak={calcStreak}
          getWeeklyData={getWeeklyData}

          // ── Streak ──
          streakDays={streakDays} lastActiveDate={lastActiveDate}

          // ── Deadline alerts ──
          showDeadlineNotifier={showDeadlineNotifier}
          deadlineAlerts={deadlineAlerts} dismissAlerts={dismissAlerts}

          // ── Waypoint / navigation helpers ──
          openWaypoint={openWaypoint} closeWaypoint={closeWaypoint}
          onOpenProgramWithPage={onOpenProgramWithPage} onSubNav={onSubNav}

          // ── Canvas mouse handlers ──
          onCanvasMouseDown={onCanvasMouseDown}
          onCanvasMouseMove={onCanvasMouseMove}
          onCanvasMouseUp={onCanvasMouseUp}
          onCanvasDragOver={onCanvasDragOver}
          onCanvasDragLeave={onCanvasDragLeave}
          onCanvasDrop={onCanvasDrop}

          // ── Event handlers ──
          createGoalFromModal={createGoalFromModal}
          addOnwardItem={addOnwardItem}
          deleteOnwardItem={deleteOnwardItem}
          deleteAvailableTask={deleteAvailableTask}
          returnOnwardItemToAvailable={returnOnwardItemToAvailable}
          moveOnwardItem={moveOnwardItem}
          handleStartFocus={handleStartFocus}
          handleFocusSessionComplete={handleFocusSessionComplete}
          handleBrainDump={handleBrainDump}
          handleJournalEntry={handleJournalEntry}
          handleBreakdownTask={handleBreakdownTask}
          handleBreakdownSuggestion={handleBreakdownSuggestion}
          handleRestoreFromBacklog={handleRestoreFromBacklog}
          handleExitFocus={handleExitFocus}
          toggleOnwardDone={toggleOnwardDone}
          updateSkillLevel={updateSkillLevel}
          addSubskill={addSubskill}
          toggleSubtask={toggleSubtask}
          handleUpdateSkillMeta={handleUpdateSkillMeta}
          toggleCheckpoint={toggleCheckpoint}
          toggleFocus={toggleFocus}
          deleteGoal={deleteGoal}
          toggleTopGoal={toggleTopGoal}
          completeGoal={completeGoal}
          renameGoal={renameGoal}
          deleteSubtask={deleteSubtask}
          deleteCheckpoint={deleteCheckpoint}
          addSubtask={addSubtask}
          addCheckpoint={addCheckpoint}
          checkIn={checkIn}
          suggestSubtask={suggestSubtask}
        />
      );
    }


export default Meridian;
