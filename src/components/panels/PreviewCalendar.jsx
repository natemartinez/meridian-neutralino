import React, { useState, useMemo } from 'react';
import { T } from '../../utils/theme.js';

export default function PreviewCalendar({
  previewPlanItems, previewPlanForm, setPreviewPlanForm, projects,
  onAddPreviewItem, onDeletePreviewItem, onTogglePreviewDone,
  selectedDate, onDateChange,
  setModal, topGoals = [], onToggleTopGoal,
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const resolvedDate = selectedDate || todayISO;
  const isToday = resolvedDate === todayISO;
  const selectedDateObj = new Date(resolvedDate + 'T00:00:00');
  const isPast = resolvedDate < todayISO;

  // ── Week calculation ──
  // Find the Monday of the week containing selectedDate
  const getWeekStart = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff = (day === 0 ? -6 : 1 - day); // Monday as week start
    d.setDate(d.getDate() + diff);
    return d;
  };

  const weekStart = getWeekStart(resolvedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return {
      iso,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isPast: iso < todayISO,
      isToday: iso === todayISO,
      isFuture: iso > todayISO,
      isSelected: iso === resolvedDate,
    };
  });

  // ── Day navigation ──
  const goToDay = (delta) => {
    if (!onDateChange) return;
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + delta);
    const min = new Date();
    min.setDate(min.getDate() - 30);
    const max = new Date();
    max.setDate(max.getDate() + 60);
    if (d < min || d > max) return;
    onDateChange(d.toISOString().slice(0, 10));
  };

  const displayLabel = isToday
    ? 'Today'
    : selectedDateObj.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

  // ── Time slots (15-min increments) ──
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

  // ── Filter items for selected date ──
  const selectedDateItems = useMemo(() => {
    return (previewPlanItems || [])
      .filter(it => it.date === resolvedDate)
      .sort((a, b) => a.hour - b.hour);
  }, [previewPlanItems, resolvedDate]);

  // ── Grid constants ──
  const GRID_START_HOUR = 6;
  const GRID_END_HOUR = 22;
  const VISIBLE_HOURS = GRID_END_HOUR - GRID_START_HOUR;
  const ROW_HEIGHT = 56;
  const GRID_HEIGHT = VISIBLE_HOURS * ROW_HEIGHT;
  const HOUR_LABEL_WIDTH = 44;

  // ── Type color map ──
  const typeColor = (type) => {
    switch (type) {
      case 'deadline': return T.rose;
      case 'goal': return T.green;
      case 'note': return T.accent;
      default: return T.blue; // task
    }
  };

  const typeLabel = (type) => {
    switch (type) {
      case 'deadline': return 'DEADLINE';
      case 'goal': return 'GOAL';
      case 'note': return 'NOTE';
      default: return 'TASK';
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* ── Header ── */}
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
              style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color: isToday ? T.cyan : T.muted, cursor: isToday ? 'default' : 'pointer', minWidth:80, textAlign:'center', letterSpacing:'.03em' }}
            >{displayLabel}</div>
            <button
              onClick={() => goToDay(1)}
              title="Next day"
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color:T.muted, cursor:'pointer', fontSize:11, padding:'2px 6px', lineHeight:1 }}
            >▶</button>
          </div>
        </div>
      </div>

      {/* ── Week Strip ── */}
      <div style={{ padding:'10px 18px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', gap:4 }}>
          {weekDays.map(day => (
            <button
              key={day.iso}
              onClick={() => onDateChange && onDateChange(day.iso)}
              disabled={day.isPast}
              style={{
                flex: 1,
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                padding:'6px 2px',
                borderRadius: 6,
                background: day.isSelected ? `${T.cyan}18` : (day.isToday ? `${T.cyan}0a` : 'transparent'),
                border: day.isSelected ? `1.5px solid ${T.cyan}60` : (day.isToday ? `1px solid ${T.cyan}30` : `1px solid transparent`),
                cursor: day.isPast ? 'default' : 'pointer',
                opacity: day.isPast ? 0.35 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!day.isPast && !day.isSelected) { e.currentTarget.style.background = `${T.cyan}08`; e.currentTarget.style.borderColor = `${T.cyan}20`; }}}
              onMouseLeave={e => { if (!day.isPast && !day.isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}}
            >
              <span style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 7,
                color: day.isToday ? T.cyan : T.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>{day.label}</span>
              <span style={{
                fontFamily:"'Syne',sans-serif",
                fontSize: 13,
                fontWeight: day.isToday ? 800 : 600,
                color: day.isToday ? T.cyan : T.text,
                lineHeight: 1,
              }}>{day.dayNum}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Add Form (hidden for past days) ── */}
      {!isPast && (
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <input
              style={{ flex:1, boxSizing:'border-box', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
              placeholder="Task title..."
              value={previewPlanForm.title}
              onChange={e => setPreviewPlanForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key==='Enter' && onAddPreviewItem()}
            />
            <select
              value={previewPlanForm.type || 'task'}
              onChange={e => setPreviewPlanForm(f => ({ ...f, type: e.target.value }))}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, outline:'none' }}
            >
              <option value="task">Task</option>
              <option value="note">Note</option>
              <option value="deadline">Deadline</option>
              <option value="goal">Goal</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <select
              value={previewPlanForm.hour}
              onChange={e => setPreviewPlanForm(f => ({ ...f, hour: Number(e.target.value) }))}
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
            >
              {timeSlots.map(t => <option key={t.value} value={t.value}>{fmt(t.value)}</option>)}
            </select>
            <select
              value={previewPlanForm.duration || 60}
              onChange={e => setPreviewPlanForm(f => ({ ...f, duration: Number(e.target.value) }))}
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
              value={previewPlanForm.priority}
              onChange={e => setPreviewPlanForm(f => ({ ...f, priority: e.target.value }))}
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
            >
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
          </div>
          <select
            value={previewPlanForm.goalId || ''}
            onChange={e => setPreviewPlanForm(f => ({ ...f, goalId: e.target.value || null }))}
            style={{ width:'100%', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', marginBottom:8 }}
          >
            <option value="">No linked goal</option>
            {projects.filter(p => !p.completedAt).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <textarea
            style={{ width:'100%', boxSizing:'border-box', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', marginBottom:8, resize:'vertical', minHeight:32, lineHeight:1.5 }}
            placeholder="Notes / description..."
            rows={2}
            value={previewPlanForm.note || ''}
            onChange={e => setPreviewPlanForm(f => ({ ...f, note: e.target.value }))}
          />
          <button
            onClick={onAddPreviewItem}
            disabled={!previewPlanForm.title.trim()}
            style={{ width:'100%', background:`${T.cyan}18`, border:`1px solid ${T.cyan}40`, borderRadius:6, padding:'8px', color:T.cyan, fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor: previewPlanForm.title.trim() ? 'pointer' : 'not-allowed', opacity: previewPlanForm.title.trim() ? 1 : .4 }}
          >+ Add to Plan</button>
        </div>
      )}

      {/* ── Past day read-only notice ── */}
      {isPast && (
        <div style={{ padding:'8px 18px', borderBottom:`1px solid ${T.border}`, background:`${T.muted}08` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, textAlign:'center', letterSpacing:'0.05em' }}>
            Past day — read only
          </div>
        </div>
      )}

      {/* ── Time-block grid ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 0', position:'relative' }}>
        {selectedDateItems.length === 0 ? (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, color:T.muted, textAlign:'center', marginTop:24, lineHeight:1.8 }}>
            {isPast ? 'No plans recorded for this day.' : 'No plans yet.\nAdd your first item.'}
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
            {/* Item blocks */}
            {selectedDateItems.map((item) => {
              const startMinutes = item.hour;
              const duration = item.duration || 60;
              const startHourFrac = startMinutes / 60;
              const topOffset = (startHourFrac - GRID_START_HOUR) * ROW_HEIGHT;
              const blockHeight = (duration / 60) * ROW_HEIGHT;
              const color = typeColor(item.type || 'task');
              const blockColor = item.done ? T.muted : color;
              return (
                <div
                  key={item.id}
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
                    opacity: item.done ? 0.5 : (isPast ? 0.6 : 1),
                    userSelect:'none',
                  }}
                >
                  {/* Top row: checkbox + title + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, minHeight:0, flex:1 }}>
                    {!isPast && (
                      <button
                        onClick={() => onTogglePreviewDone(item.id)}
                        style={{
                          width:14, height:14, borderRadius:3,
                          border:`2px solid ${item.done ? T.green : T.muted}`,
                          background: item.done ? T.green : 'transparent',
                          flexShrink:0, cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          padding:0,
                        }}
                      >{item.done && <span style={{ fontSize:10, color:T.bg, lineHeight:1 }}>✓</span>}</button>
                    )}
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
                    {/* Type badge */}
                    <span style={{
                      fontFamily:"'IBM Plex Mono',monospace",
                      fontSize:6,
                      padding:'1px 4px',
                      borderRadius:2,
                      background: `${color}18`,
                      color: color,
                      textTransform:'uppercase',
                      fontWeight:700,
                      letterSpacing:'0.03em',
                      flexShrink:0,
                    }}>{typeLabel(item.type || 'task')}</span>
                    {!isPast && (
                      <button onClick={() => onDeletePreviewItem(item.id)} title="Delete"
                        style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:13, padding:'0 2px', flexShrink:0, lineHeight:1, opacity:0.5 }}
                      >×</button>
                    )}
                  </div>
                  {/* Note preview */}
                  {item.note && (
                    <div style={{
                      fontFamily:"'IBM Plex Mono',monospace",
                      fontSize:7,
                      color: T.muted,
                      overflow:'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:'nowrap',
                      marginTop: 1,
                    }}>{item.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Non-time-block items (notes/deadlines without time) ── */}
      {(() => {
        const untimedItems = (previewPlanItems || [])
          .filter(it => it.date === resolvedDate && it.hour == null);
        if (untimedItems.length === 0) return null;
        return (
          <div style={{ borderTop:`1px solid ${T.border}`, padding:'10px 18px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, letterSpacing:'0.08em', marginBottom:6 }}>NOTES & DEADLINES</div>
            {untimedItems.map(item => (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'6px 8px', marginBottom:4,
                background: T.card, border:`1px solid ${T.border}`,
                borderLeft:`3px solid ${typeColor(item.type || 'note')}`,
                borderRadius:4,
                opacity: isPast ? 0.6 : 1,
              }}>
                <span style={{ flex:1, fontSize:10, color:T.text }}>{item.title}</span>
                <span style={{
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize:7,
                  padding:'1px 5px',
                  borderRadius:3,
                  background: `${typeColor(item.type || 'note')}15`,
                  color: typeColor(item.type || 'note'),
                  textTransform:'uppercase',
                  fontWeight:700,
                }}>{typeLabel(item.type || 'note')}</span>
                {!isPast && (
                  <button onClick={() => onDeletePreviewItem(item.id)} title="Delete"
                    style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:13, padding:'0 2px', lineHeight:1, opacity:0.5 }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
