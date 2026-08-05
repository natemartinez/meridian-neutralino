import React, { useMemo } from 'react';
import { T } from '../../utils/theme.js';
import OnwardPanel from '../OnwardPanel.jsx';
import MapPanel from '../MapPanel.jsx';
import SkillsPanel from '../SkillsPanel.jsx';
import PreviewCalendar from './PreviewCalendar.jsx';

export default function CanvasPanelWrapper({ panelId, ...props }) {
  // Resolve topGoals ID array to full goal objects
  const resolvedTopGoals = useMemo(() => {
    if (!props.topGoals || !props.projects) return [];
    return props.topGoals
      .map(id => props.projects.find(p => p.id === id))
      .filter(Boolean);
  }, [props.topGoals, props.projects]);

  const isOnward = panelId === 'onward';

  return (
    <>
      {!isOnward && <div className="wp-accent" style={{ background: T.accent }} />}
      <div className="wp-hd" style={isOnward ? { borderBottom:'none', paddingBottom:0 } : undefined}>
        {!isOnward && <button className="wp-close" onClick={props.closeWaypoint}>×</button>}
        {!isOnward && (
          <div className="wp-badge"><span style={{ color:T.muted }}>Canvas</span></div>
        )}
      </div>
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {panelId === 'onward' && (
          <OnwardPanel
            onwardItems={props.onwardItems}
            onwardForm={props.onwardForm}
            setOnwardForm={props.setOnwardForm}
            projects={props.projects}
            onAdd={props.addOnwardItem}
            onDelete={props.deleteOnwardItem}
            onToggleDone={props.toggleOnwardDone}
            selectedId={props.selectedId}
            onSelectGoal={id => { props.setSelectedId(id); props.openWaypoint({ type:'goal', id }); }}
            onToggleFocus={props.toggleFocus}
            onConfirmDelete={props.setConfirmDelete}
            availableTasks={props.availableTasks}
            onDeleteAvailableTask={props.deleteAvailableTask}
            onDragStart={task => props.setDraggedTask(task)}
            onMoveItem={props.moveOnwardItem}
            onStartFocus={props.handleStartFocus}
            onReturnToAvailable={props.returnOnwardItemToAvailable}
            backlogItems={props.backlogItems}
            deferredItems={props.deferredItems}
            selectedForToday={props.selectedForToday}
            onRestoreFromBacklog={props.handleRestoreFromBacklog}
            // ── Day navigation props ──
            selectedDate={props.selectedOnwardDate}
            onDateChange={props.setSelectedOnwardDate}
            // ── Goal integration props ──
            setModal={props.setModal}
            topGoals={resolvedTopGoals}
            onToggleTopGoal={props.onToggleTopGoal}
            setSunId={props.setSunId}
            // ── Duration resize ──
            onResizeDuration={props.resizeOnwardItem}
            // ── Hide time-block grid (canvas draws it) ──
            showTimeBlocks={false}
          />
        )}
        {panelId === 'map' && (
          <MapPanel
            hoveredWeek={props.hoveredWeek}
            projects={props.projects}
            weeklyInsights={props.novaState?.weeklyInsights}
            onWeeklyCheckin={props.scanWeeklyGoals}
            companionLoading={props.novaState?.weeklyInsights?.loading || false}
            aiEnabled={props.aiEnabled}
          />
        )}
        {panelId === 'skills' && (
          <SkillsPanel
            skills={props.skills}
            selectedSkillId={props.selectedSkillId}
            onUpdateLevel={props.updateSkillLevel}
            onAddSubskill={props.addSubskill}
          />
        )}
        {panelId === 'preview-calendar' && (
          <PreviewCalendar
            previewPlanItems={props.previewPlanItems}
            previewPlanForm={props.previewPlanForm}
            setPreviewPlanForm={props.setPreviewPlanForm}
            projects={props.projects}
            onAddPreviewItem={props.addPreviewItem}
            onDeletePreviewItem={props.deletePreviewItem}
            onTogglePreviewDone={props.togglePreviewDone}
            selectedDate={props.selectedPreviewDate}
            onDateChange={props.setSelectedPreviewDate}
            setModal={props.setModal}
            topGoals={props.topGoals}
            onToggleTopGoal={props.onToggleTopGoal}
          />
        )}
      </div>
    </>
  );
}
