import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getCategory } from '../../utils/helpers.js';

const QUADRANT_ORDER = ['q1', 'q2', 'q3', 'q4'];

const CATEGORY_META = {
  short: { label: 'Short', color: '#f0b429' },
  long:  { label: 'Long',  color: '#53aaff' },
  open:  { label: 'Open',  color: '#53d769' },
};
const CATEGORY_ORDER = ['all', 'short', 'long', 'open'];

const QUADRANT_META = {
  q1: { label: 'DO FIRST',   subtitle: 'Urgent + Important',          color: '#f77171', icon: '⬆' },
  q2: { label: 'SCHEDULE',   subtitle: 'Not Urgent + Important',      color: '#53aaff', icon: '◷' },
  q3: { label: 'DELEGATE',   subtitle: 'Urgent + Not Important',      color: '#f0b429', icon: '⇄' },
  q4: { label: 'ELIMINATE',  subtitle: 'Not Urgent + Not Important',  color: '#56687f', icon: '✕' },
};

function getProgress(goal) {
  const topLevelSubs = goal.subtasks || [];
  const cpSubs = (goal.checkpoints || []).reduce((sum, cp) => sum + (cp.subtasks || []).length, 0);
  const total = topLevelSubs.length + cpSubs;
  if (total === 0) return 0;
  const done = topLevelSubs.filter(s => s.done).length
    + (goal.checkpoints || []).reduce((sum, cp) => sum + (cp.subtasks || []).filter(s => s.done).length, 0);
  return Math.round((done / total) * 100);
}

function fmtDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function GoalPriorityList({ projects, setProjects, T, selectedId, onSelectGoal }) {
  const [dragOverId, setDragOverId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const dragNode = useRef(null);
  const cardRefs = useRef({});

  const allActiveGoals = (projects || []).filter(g => !g.completedAt);
  const activeGoals = categoryFilter === 'all'
    ? allActiveGoals
    : allActiveGoals.filter(g => getCategory(g) === categoryFilter);

  // Auto-scroll to the selected goal card when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    const el = cardRefs.current[selectedId];
    if (el) {
      // Small delay to let the waypoint panel open and layout settle
      const timer = setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedId]);

  // Group by quadrant, preserving display order within each group
  const grouped = {};
  for (const g of activeGoals) {
    const q = g.quadrant || 'q4';
    if (!grouped[q]) grouped[q] = [];
    grouped[q].push(g);
  }

  const handleDragStart = useCallback((e, goalId) => {
    dragNode.current = goalId;
    e.dataTransfer.effectAllowed = 'move';
    // Slight opacity on the dragged element
    e.currentTarget.style.opacity = '0.4';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1';
    dragNode.current = null;
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((e, goalId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (goalId !== dragNode.current) {
      setDragOverId(goalId);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    const sourceId = dragNode.current;
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      return;
    }

    setProjects(prev => {
      const srcIdx = prev.findIndex(p => p.id === sourceId);
      const tgtIdx = prev.findIndex(p => p.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;

      const updated = [...prev];
      // Remove source
      const [moved] = updated.splice(srcIdx, 1);
      // Recalculate target index after removal
      const newTgtIdx = updated.findIndex(p => p.id === targetId);
      // Insert before target
      updated.splice(newTgtIdx, 0, moved);
      return updated;
    });

    setDragOverId(null);
  }, [setProjects]);

  return (
    <div style={{
      padding: '24px 32px',
      maxWidth: 800,
      margin: '0 auto',
      fontFamily: "'IBM Plex Mono',monospace",
    }}>
      {/* ── Category filter chips ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORY_ORDER.map(cat => {
          const active = categoryFilter === cat;
          const meta = cat === 'all' ? null : CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                background: active ? (meta?.color || '#334155') : 'transparent',
                border: `1px solid ${active ? (meta?.color || '#334155') : '#1e293b'}`,
                borderRadius: 999,
                padding: '4px 12px',
                color: active ? '#0d1017' : (T?.muted || '#94a3b8'),
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all .14s',
              }}
            >
              {cat === 'all' ? `All (${allActiveGoals.length})` : `${meta.label} (${allActiveGoals.filter(g => getCategory(g) === cat).length})`}
            </button>
          );
        })}
      </div>

      {QUADRANT_ORDER.map(quadrant => {
        const goals = grouped[quadrant] || [];
        if (goals.length === 0) return null;
        const meta = QUADRANT_META[quadrant];

        return (
          <div key={quadrant} style={{ marginBottom: 28 }}>
            {/* ── Quadrant heading ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: `1px solid ${meta.color}30`,
            }}>
              <span style={{ fontSize: 16, color: meta.color }}>{meta.icon}</span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: meta.color,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {meta.label}
              </span>
              <span style={{
                fontSize: 10,
                color: meta.color,
                opacity: 0.7,
                fontWeight: 400,
                textTransform: 'none',
                letterSpacing: '0.02em',
              }}>
                — {meta.subtitle}
              </span>
              <span style={{
                fontSize: 11,
                color: meta.color,
                opacity: 0.6,
                marginLeft: 'auto',
              }}>
                ({goals.length})
              </span>
            </div>

            {/* ── Goal cards ── */}
            {goals.map(goal => {
              const progress = getProgress(goal);
              const deadline = fmtDate(goal.deadline);
              const isSelected = goal.id === selectedId;
              const isDragOver = dragOverId === goal.id;

              return (
                <div
                  key={goal.id}
                  ref={el => { cardRefs.current[goal.id] = el; }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, goal.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, goal.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, goal.id)}
                  onClick={() => onSelectGoal && onSelectGoal(goal.id)}
                  style={{
                    background: isSelected ? `${meta.color}10` : '#131a2a',
                    border: `1px solid ${
                      isDragOver
                        ? `${meta.color}80`
                        : isSelected
                          ? `${meta.color}40`
                          : '#1e293b'
                    }`,
                    borderTop: isDragOver ? `2px solid ${meta.color}` : `1px solid ${isSelected ? `${meta.color}40` : '#1e293b'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 8,
                    cursor: 'grab',
                    transition: 'all .14s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#1a2335';
                      e.currentTarget.style.borderColor = '#334155';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected && dragOverId !== goal.id) {
                      e.currentTarget.style.background = '#131a2a';
                      e.currentTarget.style.borderColor = '#1e293b';
                    }
                  }}
                >
                  {/* Drag handle indicator */}
                  <div style={{
                    position: 'absolute',
                    top: 4,
                    right: 8,
                    fontSize: 10,
                    color: T?.muted || '#56687f',
                    opacity: 0.4,
                    userSelect: 'none',
                  }}>
                    ⋮⋮
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {/* Category badge */}
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: CATEGORY_META[getCategory(goal)]?.color || '#94a3b8',
                          border: `1px solid ${CATEGORY_META[getCategory(goal)]?.color || '#334155'}50`,
                          borderRadius: 4,
                          padding: '1px 6px',
                          flexShrink: 0,
                          lineHeight: '14px',
                        }}>
                          {CATEGORY_META[getCategory(goal)]?.label || '—'}
                        </span>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: T?.text || '#e2e8f0',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}>
                          {goal.title || 'Untitled Goal'}
                        </div>
                      </div>

                      {/* Description */}
                      {goal.desc && (
                        <div style={{
                          fontSize: 11,
                          color: T?.muted || '#94a3b8',
                          marginBottom: 6,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {goal.desc}
                        </div>
                      )}
                    </div>

                    {/* Deadline badge */}
                    {deadline && (
                      <span style={{
                        fontSize: 10,
                        color: T?.muted || '#94a3b8',
                        background: '#1e293b',
                        borderRadius: 6,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                        marginLeft: 12,
                        flexShrink: 0,
                      }}>
                        Due {deadline}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      flex: 1,
                      height: 4,
                      background: '#1e293b',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: meta.color,
                        borderRadius: 2,
                        transition: 'width .3s',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 10,
                      color: meta.color,
                      fontWeight: 600,
                      minWidth: 32,
                      textAlign: 'right',
                    }}>
                      {progress}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {activeGoals.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: T?.muted || '#94a3b8',
          fontSize: 13,
        }}>
          No active goals yet. Create one with the <strong style={{ color: T?.text || '#e2e8f0' }}>+ Create Goal</strong> button above.
        </div>
      )}
    </div>
  );
}
