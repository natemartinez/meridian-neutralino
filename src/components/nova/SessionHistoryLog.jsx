import React, { useState, useMemo } from 'react';
import { T } from '../../utils/theme.js';
import { PROGRAM_DEFAULT_PAGES } from '../../constants/programs.js';

const PROG_META = {
  briefing:     { label: 'Goals',      color: '#F59E0B' },
  focus:        { label: 'Focus',      color: T.blue },
  preview:      { label: 'Preview',    color: T.cyan },
  calibration:  { label: 'Paths',      color: T.accent },
  organize:     { label: 'Organize',   color: '#ff6b35' },
};

const PROG_ORDER = ['briefing', 'focus', 'preview', 'calibration', 'organize'];

function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDur(min) {
  if (min < 1) return '<1m';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isYesterday(iso) {
  const d = new Date(iso);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate();
}

function dayLabel(iso) {
  if (isToday(iso)) return 'Today';
  if (isYesterday(iso)) return 'Yesterday';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SessionHistoryLog({
  sessions = [],
  novaState,
  mainPage,
  onOpenProgram,
  onBackToHQ,
  onOpenProgramWithPage,
  addSyncEvent,
  collapsed,
  onTogglePrograms,
}) {
  const [expandedProgs, setExpandedProgs] = useState(() => {
    return Object.fromEntries(PROG_ORDER.map(id => [id, true]));
  });

  const toggleExpanded = (progId) => {
    setExpandedProgs(prev => ({ ...prev, [progId]: !prev[progId] }));
  };

  // Group sessions by programId
  const grouped = useMemo(() => {
    const map = {};
    PROG_ORDER.forEach(id => { map[id] = []; });
    map.uncategorized = [];

    sessions.forEach(s => {
      if (s.programId && PROG_ORDER.includes(s.programId)) {
        map[s.programId].push(s);
      } else {
        map.uncategorized.push(s);
      }
    });

    // Sort each group by startTime descending
    PROG_ORDER.forEach(id => {
      map[id].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    });
    map.uncategorized.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    return map;
  }, [sessions]);

  // Check if a program has any chat history (for "No sessions yet" vs empty)
  const hasChatHistory = (progId) => {
    return novaState?.programChats?.[progId]?.length > 0;
  };

  const handleProgramClick = (progId) => {
    const meta = PROG_META[progId];
    const defaultPage = PROGRAM_DEFAULT_PAGES[progId] || null;
    if (onOpenProgramWithPage) {
      onOpenProgramWithPage(progId, defaultPage);
    } else {
      onOpenProgram(progId);
    }
    addSyncEvent?.('program_opened', progId);
  };

  const currentProgId = mainPage?.startsWith('program-') ? mainPage.replace('program-', '') : null;

  if (collapsed) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 6,
      }}>
        <div style={{
          writingMode: 'vertical-rl',
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 8,
          color: T.muted,
          letterSpacing: '.12em',
          opacity: 0.6,
        }}>
          SESSIONS
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '14px 14px',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 9,
        color: T.muted,
        letterSpacing: '.12em',
        marginBottom: 10,
      }}>
        NOVA SESSIONS
      </div>

      {/* ── Scrollable list ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {PROG_ORDER.map(progId => {
          const meta = PROG_META[progId];
          const progSessions = grouped[progId];
          const isActive = currentProgId === progId;
          const isExpanded = expandedProgs[progId];
          const hasSessions = progSessions.length > 0;
          const hasChat = hasChatHistory(progId);

          return (
            <div key={progId} style={{
              borderRadius: 8,
              background: isActive ? `${meta.color}10` : 'transparent',
              border: isActive ? `1px solid ${meta.color}30` : '1px solid transparent',
              overflow: 'hidden',
            }}>
              {/* Program header — clickable to navigate */}
              <div
                onClick={() => handleProgramClick(progId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}12`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Expand/collapse chevron */}
                <div
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(progId); }}
                  style={{
                    width: 14,
                    height: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'transform .15s',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M2 1 L6 4 L2 7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {/* Program name */}
                <span style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: isActive ? meta.color : T.text,
                  flex: 1,
                }}>
                  {meta.label}
                </span>

                {/* Session count badge */}
                {hasSessions && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 9,
                    color: T.muted,
                    background: `${T.surface}80`,
                    borderRadius: 4,
                    padding: '1px 6px',
                  }}>
                    {progSessions.length}
                  </span>
                )}

                {/* Navigate arrow */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M4 2 L8 6 L4 10" stroke={meta.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Session entries */}
              {isExpanded && (
                <div style={{ padding: '0 10px 6px 24px' }}>
                  {hasSessions ? (
                    progSessions.slice(0, 5).map(s => {
                      const start = new Date(s.startTime);
                      const end = s.endTime ? new Date(s.endTime) : new Date();
                      const durMin = Math.max(0, Math.round((end - start) / 60000));
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 0',
                            borderBottom: `1px solid ${T.border}30`,
                            fontSize: 10,
                          }}
                        >
                          <span style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 8,
                            color: T.muted,
                            width: 40,
                            flexShrink: 0,
                          }}>
                            {dayLabel(s.startTime)}
                          </span>
                          <span style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 8,
                            color: T.muted,
                            width: 44,
                            flexShrink: 0,
                          }}>
                            {fmtTime(s.startTime)}
                          </span>
                          <span style={{
                            flex: 1,
                            color: T.text,
                            fontSize: 10,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {s.label || 'Work Session'}
                          </span>
                          <span style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 8,
                            color: durMin >= 25 ? T.green : T.muted,
                            flexShrink: 0,
                          }}>
                            {fmtDur(durMin)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 8,
                      color: T.muted,
                      padding: '6px 0',
                      opacity: 0.6,
                    }}>
                      {hasChat ? 'No sessions tracked' : 'No sessions yet'}
                    </div>
                  )}
                  {progSessions.length > 5 && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 8,
                      color: T.muted,
                      padding: '4px 0',
                      textAlign: 'center',
                      opacity: 0.5,
                    }}>
                      +{progSessions.length - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncategorized sessions */}
        {grouped.uncategorized.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              color: T.muted,
              padding: '6px 10px',
              opacity: 0.6,
            }}>
              OTHER
            </div>
            {grouped.uncategorized.slice(0, 3).map(s => {
              const durMin = Math.max(0, Math.round((new Date(s.endTime || Date.now()) - new Date(s.startTime)) / 60000));
              return (
                <div key={s.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  fontSize: 10,
                }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: T.muted, width: 40 }}>
                    {dayLabel(s.startTime)}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: T.muted, width: 44 }}>
                    {fmtTime(s.startTime)}
                  </span>
                  <span style={{ flex: 1, color: T.text, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.label || 'Work Session'}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: T.muted }}>
                    {fmtDur(durMin)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 10,
            color: T.muted,
            textAlign: 'center',
            padding: '24px 0',
            opacity: 0.6,
          }}>
            No sessions yet
          </div>
        )}
      </div>

      {/* ── PROGRAMS toggle button at bottom ── */}
      <button
        onClick={onTogglePrograms}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 0',
          borderRadius: 8,
          background: `${T.accent}12`,
          border: `1px solid ${T.accent}30`,
          color: T.accent,
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.08em',
          cursor: 'pointer',
          marginTop: 8,
          flexShrink: 0,
          transition: 'all .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = `${T.accent}20`;
          e.currentTarget.style.borderColor = `${T.accent}50`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = `${T.accent}12`;
          e.currentTarget.style.borderColor = `${T.accent}30`;
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1" y="1" width="4" height="4" rx="1" stroke={T.accent} strokeWidth="1.2"/>
          <rect x="7" y="1" width="4" height="4" rx="1" stroke={T.accent} strokeWidth="1.2"/>
          <rect x="1" y="7" width="4" height="4" rx="1" stroke={T.accent} strokeWidth="1.2"/>
          <rect x="7" y="7" width="4" height="4" rx="1" stroke={T.accent} strokeWidth="1.2"/>
        </svg>
        PROGRAMS
      </button>
    </div>
  );
}
