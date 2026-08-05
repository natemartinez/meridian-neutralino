import React, { useState, useRef, useCallback, useEffect } from 'react';
import { T } from '../utils/theme.js';

const QUADRANT_META = {
  q1: { label: 'DO FIRST',   subtitle: 'Urgent + Important',          color: '#f77171' },
  q2: { label: 'SCHEDULE',   subtitle: 'Not Urgent + Important',      color: '#53aaff' },
  q3: { label: 'DELEGATE',   subtitle: 'Urgent + Not Important',      color: '#f0b429' },
  q4: { label: 'ELIMINATE',  subtitle: 'Not Urgent + Not Important',  color: '#56687f' },
};
const QUADRANT_ORDER = ['q1', 'q2', 'q3', 'q4'];

export default function OnwardPanel({
  onwardItems, onwardForm, setOnwardForm, projects, onAdd, onDelete, onToggleDone,
  selectedId, onSelectGoal, onToggleFocus, onConfirmDelete, availableTasks,
  onDeleteAvailableTask, onDragStart, onMoveItem, onStartFocus, onReturnToAvailable,
  // New props
  backlogItems = [], deferredItems = [], onRestoreFromBacklog, selectedForToday = [],
  // ── Day navigation props ──
  selectedDate, onDateChange,
  // ── Goal integration props ──
  setModal, topGoals = [], onToggleTopGoal, setSunId,
  // ── Duration resize prop ──
  onResizeDuration,
  // ── When false, hide the visual time-block grid (canvas draws it instead) ──
  showTimeBlocks = true,
}) {
  const [showBacklog, setShowBacklog] = useState(false);
  const [resizing, setResizing] = useState(null); // { itemId, startY, startDuration }
  const [selectedTask, setSelectedTask] = useState(null); // clicked task detail panel
  const [dragReadyTaskId, setDragReadyTaskId] = useState(null); // task armed for drag after click
  const [expandedGoals, setExpandedGoals] = useState(() => new Set()); // collapsible goal headers
  const gridRef = useRef(null);

  // ── Day navigation state ──
  const todayISO = new Date().toISOString().slice(0, 10);
  const resolvedDate = selectedDate || todayISO;
  const isToday = resolvedDate === todayISO;
  const selectedDateObj = new Date(resolvedDate + 'T00:00:00');
  const displayLabel = isToday
    ? 'Today'
    : selectedDateObj.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

  const goToDay = (delta) => {
    if (!onDateChange) return;
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + delta);
    const min = new Date();
    min.setDate(min.getDate() - 30);
    const max = new Date();
    max.setDate(max.getDate() + 30);
    if (d < min || d > max) return;
    onDateChange(d.toISOString().slice(0, 10));
  };

  // Generate time slots from 0:00 to 23:45 in 15-minute increments (96 slots)
  const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => {
    const totalMinutes = i * 15;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { hour: h, minute: m, value: totalMinutes };
  });
  const fmt = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
  };
  const today = new Date().toDateString();

  // Filter: show only items for the selected date that are NOT deferred and NOT in backlog
  const selectedDateItems = onwardItems
    .filter(it => {
      if (!it.date) return isToday;
      return it.date === selectedDateObj.toDateString();
    })
    .filter(it => !deferredItems.find(d => d.id === it.id))
    .filter(it => !backlogItems.find(b => b.id === it.id))
    .sort((a,b) => a.hour - b.hour);

  // ── Resize drag logic ──
  const handleResizeMouseDown = useCallback((e, itemId, currentDuration) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ itemId, startY: e.clientY, startDuration: currentDuration || 60 });
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e) => {
      const dy = e.clientY - resizing.startY;
      // Convert pixels to minutes: each 30px ≈ 15min, so 2px per minute
      const deltaMinutes = Math.round(dy / 2);
      const newDuration = Math.max(15, Math.min(240, resizing.startDuration + deltaMinutes));
      if (onResizeDuration) {
        onResizeDuration(resizing.itemId, newDuration);
      }
    };
    const handleMouseUp = () => {
      setResizing(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, onResizeDuration]);

  // ── Grid constants ──
  const GRID_START_HOUR = 6;  // 6:00 AM
  const GRID_END_HOUR   = 22; // 10:00 PM
  const VISIBLE_HOURS   = GRID_END_HOUR - GRID_START_HOUR;
  const ROW_HEIGHT      = 56; // px per hour row
  const GRID_HEIGHT     = VISIBLE_HOURS * ROW_HEIGHT;
  const HOUR_LABEL_WIDTH = 44;

  // Deferred items that should appear on the selected date
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const selectedDayName = dayNames[selectedDateObj.getDay()];
  const visibleDeferred = deferredItems.filter(d => d.deferredTo === selectedDayName);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'18px 18px 14px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* ── Day navigation ── */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
            <button
              onClick={() => goToDay(-1)}
              title="Previous day"
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color:T.muted, cursor:'pointer', fontSize:11, padding:'2px 6px', lineHeight:1 }}
            >◀</button>
            <div
              onClick={() => { if (!isToday && onDateChange) onDateChange(todayISO); }}
              title={isToday ? 'Today' : 'Jump to today'}
              style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color: isToday ? T.accent : T.muted, cursor: isToday ? 'default' : 'pointer', minWidth:80, textAlign:'center', letterSpacing:'.03em' }}
            >{displayLabel}</div>
            <button
              onClick={() => goToDay(1)}
              title="Next day"
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color:T.muted, cursor:'pointer', fontSize:11, padding:'2px 6px', lineHeight:1 }}
            >▶</button>
          </div>
        </div>
      </div>

      {/* Add form */}
      <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}` }}>
        <input
          style={{ width:'100%', boxSizing:'border-box', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', marginBottom:8 }}
          placeholder="Task title..."
          value={onwardForm.title}
          onChange={e => setOnwardForm(f => ({ ...f, title: e.target.value }))}
          onKeyDown={e => e.key==='Enter' && onAdd()}
        />
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <select
            value={onwardForm.hour}
            onChange={e => setOnwardForm(f => ({ ...f, hour: Number(e.target.value) }))}
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
          >
            {timeSlots.map(t => <option key={t.value} value={t.value}>{fmt(t.value)}</option>)}
          </select>
          <select
            value={onwardForm.duration || 60}
            onChange={e => setOnwardForm(f => ({ ...f, duration: Number(e.target.value) }))}
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
          >
            <option value={15}>15m</option>
            <option value={30}>30m</option>
            <option value={45}>45m</option>
            <option value={60}>1h</option>
            <option value={90}>1.5h</option>
            <option value={120}>2h</option>
            <option value={180}>3h</option>
            <option value={240}>4h</option>
          </select>
          <select
            value={onwardForm.priority}
            onChange={e => setOnwardForm(f => ({ ...f, priority: e.target.value }))}
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
          >
            <option value="low">Low</option>
            <option value="high">High</option>
          </select>
        </div>
        <select
          value={onwardForm.goalId || ''}
          onChange={e => setOnwardForm(f => ({ ...f, goalId: e.target.value || null }))}
          style={{ width:'100%', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', marginBottom:8 }}
        >
          <option value="">No linked goal</option>
          {projects.filter(p => !p.completedAt).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button
          onClick={onAdd}
          disabled={!onwardForm.title.trim()}
          style={{ width:'100%', background:`${T.accent}18`, border:`1px solid ${T.accent}40`, borderRadius:6, padding:'8px', color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor: onwardForm.title.trim() ? 'pointer' : 'not-allowed', opacity: onwardForm.title.trim() ? 1 : .4 }}
        >+ Add Task</button>
      </div>
      {/* ── Available Tasks split into Target (selected-for-today) and Other ── */}
      {(() => {
        const targetGoalIds = new Set(selectedForToday || []);
        // Tasks from availableTasks that belong to today's focus goals
        const targetTasks = (availableTasks || []).filter(t => targetGoalIds.has(t.goalId));
        // Other available tasks not in today's focus
        const otherTasks = (availableTasks || []).filter(t => !targetGoalIds.has(t.goalId));
        // Also include the goals themselves as target items (so they show even without subtasks)
        const targetGoals = (selectedForToday || [])
          .map(id => (projects || []).find(p => p.id === id))
          .filter(Boolean);
        const hasAny = targetTasks.length > 0 || otherTasks.length > 0 || targetGoals.length > 0;

        const toggleGoal = (goalId) => {
          setExpandedGoals(prev => {
            const next = new Set(prev);
            if (next.has(goalId)) next.delete(goalId);
            else next.add(goalId);
            return next;
          });
        };

        const renderTask = (task, isTarget, customType) => (
          <div
            key={`${customType || task.type}-${task.id}`}
            draggable={!customType && dragReadyTaskId === task.id}
            onMouseDown={() => { if (!customType) setDragReadyTaskId(task.id); }}
            onDragStart={() => { if (!customType) onDragStart && onDragStart(task); }}
            onDragEnd={() => { if (dragReadyTaskId === task.id) setDragReadyTaskId(null); }}
            onMouseEnter={e => {
              if (!customType) {
                e.currentTarget.style.borderColor = task.goalColor || T.accent;
                e.currentTarget.style.background = `${T.card}CC`;
              }
            }}
            onMouseLeave={e => {
              if (!customType) {
                e.currentTarget.style.borderColor = isTarget ? `${T.green}30` : T.border;
                e.currentTarget.style.background = isTarget ? `${T.green}06` : T.card;
              }
            }}
            style={{
              display:'flex',
              alignItems:'center',
              gap:8,
              padding:'6px 8px',
              marginBottom:4,
              background: isTarget ? `${T.green}06` : T.card,
              border:`1px solid ${isTarget ? `${T.green}30` : T.border}`,
              borderLeft:`3px solid ${isTarget ? T.green : (task.goalId ? task.goalColor : T.border)}`,
              borderRadius:4,
              cursor: customType ? 'pointer' : 'grab',
              transition:'all 0.15s'
            }}
            onClick={customType === 'goal' ? () => {
              if (onSelectGoal) onSelectGoal(task.id);
            } : undefined}
          >
            <span style={{ flex:1, fontSize:9.5, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
            {isTarget && (
              <span style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize:7,
                padding:'2px 6px',
                borderRadius:3,
                background: `${T.green}18`,
                color: T.green,
                textTransform:'uppercase',
                fontWeight:700,
                letterSpacing:'0.05em',
              }}>Target</span>
            )}
            {!customType && (
              <span
                style={{
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize:7,
                  padding:'2px 6px',
                  borderRadius:3,
                  background: task.type === 'subtask' ? `${T.blue}15` : task.type === 'freeform' ? `${T.accent}15` : `${T.purple}15`,
                  color: task.type === 'subtask' ? T.blue : task.type === 'freeform' ? T.accent : T.purple,
                  textTransform:'uppercase',
                  position:'relative',
                  cursor: task.type === 'checkpoint' ? 'help' : 'default',
                }}
                title={task.type === 'checkpoint' ? "Checkpoints mark stages of a project where it's natural to take a break. Place them between groups of subtasks to track progress at major milestones." : undefined}
              >{task.type === 'subtask' ? 'Subtask' : task.type === 'freeform' ? 'Task' : 'Checkpoint'}</span>
            )}
            {customType === 'goal' && (
              <span style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize:7,
                padding:'2px 6px',
                borderRadius:3,
                background: `${T.accent}18`,
                color: T.accent,
                textTransform:'uppercase',
                fontWeight:700,
              }}>Goal</span>
            )}
            {!customType && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteAvailableTask && onDeleteAvailableTask(task); }}
                style={{
                  background:'none',
                  border:'none',
                  color:T.rose,
                  cursor:'pointer',
                  fontSize:13,
                  lineHeight:1,
                  padding:'0 2px',
                  opacity:0.5,
                  transition:'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                title="Delete task"
              >×</button>
            )}
          </div>
        );

        // ── Group target tasks by goalId ──
        const tasksByGoal = {};
        targetTasks.forEach(t => {
          if (!tasksByGoal[t.goalId]) tasksByGoal[t.goalId] = [];
          tasksByGoal[t.goalId].push(t);
        });

        // ── Group other tasks by Eisenhower quadrant ──
        const tasksByQuadrant = {};
        otherTasks.forEach(t => {
          const q = t.goalQuadrant || 'q4';
          if (!tasksByQuadrant[q]) tasksByQuadrant[q] = [];
          tasksByQuadrant[q].push(t);
        });

        return (
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}`, maxHeight:'260px', overflowY:'auto' }}>
            {(targetTasks.length > 0 || targetGoals.length > 0) && (
              <>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.green, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8, fontWeight:700 }}>
                  🎯 Target Tasks ({targetTasks.length})
                </div>
                {/* Show goals as collapsible dropdown headers with nested subtasks */}
                {targetGoals.map(g => {
                  const goalTasks = tasksByGoal[g.id] || [];
                  const isExpanded = expandedGoals.has(g.id);
                  const taskCount = goalTasks.length;
                  return (
                    <div key={`goal-group-${g.id}`} style={{ marginBottom:4 }}>
                      {/* Goal header — non-draggable, visually distinct */}
                      <div
                        onClick={() => toggleGoal(g.id)}
                        style={{
                          display:'flex',
                          alignItems:'center',
                          gap:8,
                          padding:'6px 8px',
                          marginBottom: isExpanded && taskCount > 0 ? 4 : 0,
                          background: `${g.color}10`,
                          border:`1px solid ${g.color}30`,
                          borderLeft:`3px solid ${g.color}`,
                          borderRadius:4,
                          cursor:'pointer',
                          transition:'all 0.15s',
                          userSelect:'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${g.color}18`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${g.color}10`; }}
                      >
                        {/* Expand/collapse chevron */}
                        <span style={{
                          fontSize:8,
                          color:g.color,
                          transition:'transform 0.15s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          display:'inline-block',
                          fontFamily:"'IBM Plex Mono',monospace",
                          lineHeight:1,
                        }}>▶</span>
                        {/* Goal title */}
                        <span style={{
                          flex:1,
                          fontSize:9.5,
                          fontWeight:700,
                          color:g.color,
                          overflow:'hidden',
                          textOverflow:'ellipsis',
                          whiteSpace:'nowrap',
                          fontFamily:"'Syne',sans-serif",
                        }}>{g.title}</span>
                        {/* Task count badge */}
                        {taskCount > 0 && (
                          <span style={{
                            fontFamily:"'IBM Plex Mono',monospace",
                            fontSize:7,
                            padding:'2px 6px',
                            borderRadius:3,
                            background: `${g.color}20`,
                            color: g.color,
                            fontWeight:700,
                          }}>{taskCount} {taskCount === 1 ? 'item' : 'items'}</span>
                        )}
                        {taskCount === 0 && (
                          <span style={{
                            fontFamily:"'IBM Plex Mono',monospace",
                            fontSize:7,
                            padding:'2px 6px',
                            borderRadius:3,
                            background: `${T.muted}15`,
                            color: T.muted,
                          }}>Empty</span>
                        )}
                      </div>
                      {/* Expanded subtasks/checkpoints */}
                      {isExpanded && goalTasks.map(t => renderTask(t, true, null))}
                    </div>
                  );
                })}
                {otherTasks.length > 0 && <div style={{ height:1, background:T.border, margin:'8px 0' }} />}
              </>
            )}
            {otherTasks.length > 0 && (
              <>
                {QUADRANT_ORDER.map(q => {
                  const tasks = tasksByQuadrant[q] || [];
                  if (tasks.length === 0) return null;
                  const meta = QUADRANT_META[q];
                  return (
                    <div key={q} style={{ marginBottom:8 }}>
                      <div style={{
                        display:'flex', alignItems:'center', gap:6,
                        fontFamily:"'IBM Plex Mono',monospace", fontSize:8,
                        color:meta.color, textTransform:'uppercase',
                        letterSpacing:'0.1em', marginBottom:4, fontWeight:700,
                      }}>
                        {meta.label}
                        <span style={{ fontWeight:400, opacity:0.6, fontSize:7 }}>
                          — {meta.subtitle}
                        </span>
                        <span style={{ marginLeft:'auto', opacity:0.5 }}>
                          ({tasks.length})
                        </span>
                      </div>
                      {tasks.map(t => renderTask(t, false, null))}
                    </div>
                  );
                })}
              </>
            )}
            {!hasAny && (
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, textAlign:'center', padding:'8px 0' }}>All caught up!</div>
            )}
          </div>
        );
      })()}

      {/* ── Top Goals quick-add (today only) ── */}
      {isToday && topGoals.length > 0 && (
        <div style={{ padding:'8px 18px', borderBottom:`1px solid ${T.border}`, background:`${T.accent}06` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.accent, letterSpacing:'0.08em', marginBottom:6 }}>TOP GOALS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {topGoals.map(g => (
              <div key={g.id} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'4px 6px', borderRadius:4,
                borderLeft:`3px solid ${g.color || T.accent}`,
                background: T.card,
              }}>
                <span style={{ flex:1, fontSize:10, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.title}</span>
                <button
                  onClick={() => {
                    setOnwardForm(f => ({ ...f, title: g.title, goalId: g.id }));
                  }}
                  title="Add as task"
                  style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:3, color:T.accent, cursor:'pointer', fontSize:10, padding:'0 5px', lineHeight:'16px', fontFamily:"'IBM Plex Mono',monospace" }}
                >+</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Deferred items visible today ── */}
      {visibleDeferred.length > 0 && (
        <div style={{ padding:'8px 18px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.accent, letterSpacing:'0.08em', marginBottom:6 }}>DEFERRED — Due Today</div>
          {visibleDeferred.map(d => (
            <div key={d.id} style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'5px 8px', marginBottom:3,
              background: T.card, border:`1px solid ${T.border}`,
              borderRadius:4, opacity: 0.8,
            }}>
              <span style={{ flex:1, fontSize:10, color:T.text }}>{d.title}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:T.accent, padding:'1px 5px', borderRadius:3, background:`${T.accent}15` }}>DEFERRED</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Time-block grid (hidden when canvas draws it) ── */}
      {showTimeBlocks && (
      <div ref={gridRef} style={{ flex:1, overflowY:'auto', padding:'12px 0', position:'relative' }}>
        {selectedDateItems.length === 0 ? (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, color:T.muted, textAlign:'center', marginTop:24, lineHeight:1.8 }}>
            {isToday ? 'No tasks yet.\nAdd your first time block.' : 'No tasks for this day.'}
          </div>
        ) : (
          <div style={{ position:'relative', minHeight: GRID_HEIGHT, marginLeft: HOUR_LABEL_WIDTH }}>
            {/* Hour row backgrounds */}
            {Array.from({ length: VISIBLE_HOURS }, (_, i) => {
              const hour = GRID_START_HOUR + i;
              return (
                <div key={hour} style={{
                  position:'absolute',
                  top: i * ROW_HEIGHT,
                  left: 0, right: 0,
                  height: ROW_HEIGHT,
                  borderBottom: `1px solid ${T.border}40`,
                  background: i % 2 === 0 ? 'transparent' : `${T.border}08`,
                  pointerEvents:'none',
                }} />
              );
            })}
            {/* Hour labels */}
            <div style={{ position:'absolute', top:0, left: -HOUR_LABEL_WIDTH, width: HOUR_LABEL_WIDTH, bottom:0 }}>
              {Array.from({ length: VISIBLE_HOURS }, (_, i) => {
                const hour = GRID_START_HOUR + i;
                const h12 = hour % 12 || 12;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                return (
                  <div key={hour} style={{
                    position:'absolute',
                    top: i * ROW_HEIGHT - 5,
                    left: 4,
                    fontFamily:"'IBM Plex Mono',monospace",
                    fontSize:8,
                    color:T.muted,
                    lineHeight:1,
                  }}>{h12}{ampm}</div>
                );
              })}
            </div>
            {/* Task blocks */}
            {selectedDateItems.map((item) => {
              const startMinutes = item.hour; // total minutes from midnight
              const duration = item.duration || 60;
              const startHourFrac = startMinutes / 60;
              const topOffset = (startHourFrac - GRID_START_HOUR) * ROW_HEIGHT;
              const blockHeight = (duration / 60) * ROW_HEIGHT;
              const isResizing = resizing?.itemId === item.id;
              const blockColor = item.done ? T.muted : (item.priority === 'high' ? T.rose : T.accent);
              const isSelected = selectedTask?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedTask(isSelected ? null : item)}
                  style={{
                    position:'absolute',
                    top: Math.max(0, topOffset),
                    left: 4,
                    right: 8,
                    height: Math.max(20, blockHeight - 2),
                    background: `${blockColor}15`,
                    border: `1.5px solid ${blockColor}50`,
                    borderLeft: `3px solid ${blockColor}`,
                    borderRadius: 6,
                    padding: '4px 6px',
                    display:'flex',
                    flexDirection:'column',
                    overflow:'hidden',
                    cursor: 'pointer',
                    transition: isResizing ? 'none' : 'height 0.1s',
                    opacity: item.done ? 0.5 : 1,
                    userSelect:'none',
                    boxShadow: isSelected ? `0 0 0 1.5px ${blockColor}80` : 'none',
                  }}
                >
                  {/* Top row: checkbox + title + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, minHeight:0, flex:1 }}>
                    <button
                      onClick={() => onToggleDone(item.id)}
                      style={{
                        width:14, height:14, borderRadius:3,
                        border:`2px solid ${item.done ? T.green : T.muted}`,
                        background: item.done ? T.green : 'transparent',
                        flexShrink:0, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        padding:0,
                      }}
                    >{item.done && <span style={{ fontSize:10, color:T.bg, lineHeight:1 }}>✓</span>}</button>
                    <span style={{
                      flex:1,
                      fontSize:10,
                      fontWeight:600,
                      color: item.done ? T.muted : T.text,
                      textDecoration: item.done ? 'line-through' : 'none',
                      overflow:'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:'nowrap',
                    }}>{item.title}</span>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:T.muted, flexShrink:0 }}>
                      {fmt(item.hour)}–{fmt(item.hour + duration)}
                    </div>
                    {onStartFocus && !item.done && (
                      <button onClick={() => onStartFocus(item)} title="Focus"
                        style={{ background:'none', border:'none', color:T.accent, cursor:'pointer', fontSize:10, padding:'0 2px', flexShrink:0, lineHeight:1, opacity:0.6 }}
                      >▶</button>
                    )}
                    {onReturnToAvailable && !item.done && (
                      <button onClick={() => onReturnToAvailable(item.id)} title="Move to Available"
                        style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:10, padding:'0 2px', flexShrink:0, lineHeight:1 }}
                      >↩</button>
                    )}
                    <button onClick={() => onDelete(item.id)} title="Delete"
                      style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:13, padding:'0 2px', flexShrink:0, lineHeight:1, opacity:0.5 }}
                    >×</button>
                  </div>
                  {/* Duration bar at bottom */}
                  {!item.done && (
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, item.id, duration)}
                      style={{
                        position:'absolute',
                        bottom:0, left:0, right:0,
                        height: 6,
                        cursor: 'ns-resize',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        opacity: isResizing ? 1 : 0,
                        transition:'opacity 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
                      onMouseLeave={e => { if (!isResizing) e.currentTarget.style.opacity = 0; }}
                    >
                      <div style={{
                        width: 20, height: 2,
                        background: T.muted,
                        borderRadius: 1,
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Selected Task Detail Panel ── */}
      {selectedTask && (
        <div style={{
          borderTop:`1px solid ${T.border}`,
          padding:'14px 18px',
          background: `${T.card}`,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            {/* Color dot */}
            <div style={{
              width:8, height:8, borderRadius:'50%', flexShrink:0, marginTop:3,
              background: selectedTask.done ? T.muted : (selectedTask.priority === 'high' ? T.rose : T.accent),
            }} />
            <div style={{ flex:1, minWidth:0 }}>
              {/* Title */}
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:T.text, marginBottom:4 }}>
                {selectedTask.title}
              </div>
              {/* Time & duration */}
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginBottom:6 }}>
                {fmt(selectedTask.hour)}–{fmt(selectedTask.hour + (selectedTask.duration || 60))}
                {' · '}{selectedTask.duration || 60}m
              </div>
              {/* Linked goal */}
              {(() => {
                const linkedGoal = projects.find(p => p.id === selectedTask.goalId);
                return linkedGoal ? (
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ color: linkedGoal.color || T.accent }}>◉</span>
                    <span>{linkedGoal.title}</span>
                  </div>
                ) : (
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginBottom:10, fontStyle:'italic' }}>
                    No linked goal
                  </div>
                );
              })()}
            </div>
            {/* Close button */}
            <button
              onClick={() => setSelectedTask(null)}
              style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px', opacity:0.5, flexShrink:0 }}
            >×</button>
          </div>
          {/* Action buttons stacked at bottom */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
            {onStartFocus && !selectedTask.done && (
              <button
                onClick={() => { onStartFocus(selectedTask); setSelectedTask(null); }}
                style={{
                  width:'100%',
                  background:`${T.green}18`,
                  border:`1px solid ${T.green}55`,
                  borderRadius:6,
                  color:T.green,
                  padding:'9px 0',
                  fontFamily:"'Syne',sans-serif",
                  fontSize:12,
                  fontWeight:700,
                  cursor:'pointer',
                  letterSpacing:'.06em',
                }}
              >▶ Start Focus Session</button>
            )}
            <button
              onClick={() => { onToggleDone(selectedTask.id); setSelectedTask(null); }}
              style={{
                width:'100%',
                background: selectedTask.done ? `${T.muted}18` : `${(selectedTask.priority === 'high' ? T.rose : T.accent)}18`,
                border:`1px solid ${selectedTask.done ? T.muted : (selectedTask.priority === 'high' ? T.rose : T.accent)}55`,
                borderRadius:6,
                color: selectedTask.done ? T.muted : (selectedTask.priority === 'high' ? T.rose : T.accent),
                padding:'8px 0',
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize:12,
                cursor:'pointer',
              }}
            >{selectedTask.done ? '↩ Mark Undone' : '✓ Mark Done'}</button>
          </div>
        </div>
      )}

      {/* ── Backlog Toggle ── */}
      {backlogItems.length > 0 && (
        <div style={{ borderTop:`1px solid ${T.border}` }}>
          <button
            onClick={() => setShowBacklog(!showBacklog)}
            style={{
              width:'100%', padding:'10px 18px',
              background: showBacklog ? `${T.muted}10` : 'transparent',
              border:'none', color: T.muted,
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 9, cursor: 'pointer',
              display:'flex', alignItems:'center', gap: 8,
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ flex:1, textAlign:'left' }}>BACKLOG ({backlogItems.length})</span>
            <span>{showBacklog ? '▲' : '▼'}</span>
          </button>
          {showBacklog && (
            <div style={{ maxHeight: 200, overflowY:'auto', padding:'0 18px 12px' }}>
              {backlogItems.map(item => (
                <div key={item.id} style={{
                  display:'flex', alignItems:'center', gap: 8,
                  padding:'6px 8px', marginBottom: 3,
                  background: T.card, border:`1px solid ${T.border}`,
                  borderRadius: 4, opacity: 0.6,
                }}>
                  <span style={{ flex:1, fontSize: 10, color: T.text }}>{item.title}</span>
                  {onRestoreFromBacklog && (
                    <button
                      onClick={() => onRestoreFromBacklog(item.id)}
                      title="Restore to schedule"
                      style={{
                        background:'none', border:'none',
                        color: T.accent, cursor:'pointer',
                        fontSize: 10, padding: '0 4px',
                      }}
                    >↩</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
