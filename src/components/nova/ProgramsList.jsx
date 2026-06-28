import React, { useState } from 'react';
import { T } from '../../utils/theme.js';

const PROGRAMS = [
  {
    id: 'hq',
    label: 'HQ',
    desc: 'Command center',
    color: T.accent,
    defaultPage: null,
    subNavs: [],
    icon: (
      <svg width="16" height="16" viewBox="0 0 13 13">
        <path d="M6.5 1.5 L12 6 L11 6 L11 11.5 L2 11.5 L2 6 L1 6 Z" fill="none" stroke={T.accent} strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M4.5 11.5 L4.5 7 L8.5 7 L8.5 11.5" fill="none" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'briefing',
    label: 'Goals',
    desc: 'Morning debrief',
    color: '#F59E0B',
    defaultPage: 'goals',
    subNavs: [
      { id: 'briefing', label: 'BRIEFING' },
    ],
    icon: (
      <svg width="16" height="16" viewBox="0 0 13 13">
        <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="#F59E0B" strokeWidth="1.4"/>
        <path d="M6.5 4v3l2 1" fill="none" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'focus',
    label: 'Focus',
    desc: 'Deep focus',
    color: T.blue,
    defaultPage: 'onward',
    subNavs: [
      { id: 'onward',   label: 'ONWARD' },
      { id: 'worklogs', label: 'WORK LOGS' },
    ],
    icon: (
      <svg width="16" height="16" viewBox="0 0 13 13">
        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.blue} strokeWidth="1.4"/>
        <circle cx="6.5" cy="6.5" r="2" fill={T.blue}/>
      </svg>
    ),
  },
  {
    id: 'regroup',
    label: 'Re-group',
    desc: 'Reset & refocus',
    color: T.purple,
    defaultPage: null,
    subNavs: [],
    icon: (
      <svg width="16" height="16" viewBox="0 0 13 13">
        <path d="M2 6.5 A4.5 4.5 0 0 1 10 3.5" fill="none" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M11 6.5 A4.5 4.5 0 0 1 3 9.5" fill="none" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
        <polygon points="10,1.5 12,4 8,4" fill={T.purple}/>
        <polygon points="3,8.5 1,11 5,11" fill={T.purple}/>
      </svg>
    ),
  },
  {
    id: 'preview',
    label: 'Preview',
    desc: 'Plan ahead',
    color: T.cyan,
    defaultPage: 'map',
    subNavs: [],
    icon: (
      <svg width="16" height="16" viewBox="0 0 13 13">
        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.cyan} strokeWidth="1.4"/>
        <circle cx="6.5" cy="6.5" r="1.5" fill={T.cyan}/>
        <path d="M6.5 4v3l2 1" fill="none" stroke={T.cyan} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'calibration',
    label: 'Paths',
    desc: 'Long-term vision',
    color: T.accent,
    defaultPage: 'paths',
    subNavs: [],
    icon: (
      <svg width="16" height="16" viewBox="0 0 13 13">
        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.accent} strokeWidth="1.4"/>
        <circle cx="6.5" cy="6.5" r="2.5" fill="none" stroke={T.accent} strokeWidth="1.2"/>
        <circle cx="6.5" cy="6.5" r="1" fill={T.accent}/>
      </svg>
    ),
  },
];

export default function ProgramsList({ mainPage, onOpenProgram, onBackToHQ, addSyncEvent, onSubNavNavigate, onOpenProgramWithPage, collapsed }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-evenly',
      padding: collapsed ? '8px 0' : '14px 14px',
      gap: 22,
    }}>

      {PROGRAMS.map(prog => {
        const isHq = prog.id === 'hq';
        const isActive = isHq ? mainPage === 'hq' : mainPage === `program-${prog.id}`;
        const isHovered = hoveredId === prog.id;
        const hasSubNavs = prog.subNavs.length > 0;
        return (
          <div
            key={prog.id}
            style={{
              position: 'relative',
            }}
            onMouseEnter={() => setHoveredId(prog.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              onClick={() => {
                if (isActive) { onBackToHQ(); }
                else if (isHq) {
                  onBackToHQ();
                }
                else {
                  if (onOpenProgramWithPage) {
                    onOpenProgramWithPage(prog.id, prog.defaultPage);
                  } else {
                    onOpenProgram(prog.id);
                  }
                  addSyncEvent('program_opened', prog.id);
                }
              }}
              style={{
                display:'flex', alignItems:'center', gap: collapsed ? 0 : 12,
                padding: collapsed ? '6px 0' : '14px 14px',
                justifyContent: 'flex-start',
                borderRadius:10, cursor:'pointer', userSelect:'none',
                background: (!collapsed && isActive) ? `${prog.color}15` : 'transparent',
                border: (!collapsed && isActive) ? `1px solid ${prog.color}40` : '1px solid transparent',
                transition: collapsed ? 'none' : 'all .18s',
              }}
              onMouseEnter={e => {
                if (collapsed) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                } else if (!isActive) {
                  e.currentTarget.style.background = `${T.surface}80`;
                  e.currentTarget.style.borderColor = `${T.border}80`;
                }
              }}
              onMouseLeave={e => {
                if (collapsed) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                } else if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <div style={{
                width: collapsed ? 32 : 38, height: collapsed ? 32 : 38, borderRadius:9,
                background:`${prog.color}18`,
                border:`1px solid ${prog.color}30`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                boxShadow: (collapsed && (isActive || isHovered)) ? `0 0 12px 2px ${prog.color}50` : 'none',
                transition:'box-shadow .2s ease',
              }}>
                <div style={{ transform:'scale(1.25)', transformOrigin:'center' }}>{prog.icon}</div>
              </div>
              {!collapsed && (
                <div className="prg-txt" style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontFamily:"'Syne',sans-serif",
                    fontSize:'clamp(14px, 1.3vw, 19px)', fontWeight:700,
                    color: isActive ? prog.color : T.text,
                    letterSpacing:'.02em',
                    lineHeight:1.2,
                  }}>{prog.label}</div>
                  <div style={{
                    overflow:'hidden',
                    maxHeight: isHovered ? 28 : 0,
                    opacity: isHovered ? 1 : 0,
                    transition:'all 0.2s ease',
                  }}>
                    <div style={{
                      fontFamily:"'IBM Plex Mono',monospace",
                      fontSize:'clamp(9px, 0.8vw, 11px)', color:T.muted, marginTop:2,
                      lineHeight:1.3,
                    }}>{prog.desc}</div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Hover-reveal sub-nav chips ── */}
            {!collapsed && hasSubNavs && (
              <div style={{
                display: 'flex',
                gap: 4,
                padding: '0 14px',
                marginTop: 0,
                overflow: 'hidden',
                maxHeight: isHovered ? 28 : 0,
                opacity: isHovered ? 1 : 0,
                transition: 'all 0.2s ease',
              }}>
                {prog.subNavs.map(sub => (
                  <span
                    key={sub.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSubNavNavigate) {
                        onSubNavNavigate(prog.id, sub.id);
                      } else {
                        // Fallback: open program first
                        onOpenProgram(prog.id);
                      }
                    }}
                    style={{
                      fontSize: 8,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: `${prog.color}18`,
                      border: `1px solid ${prog.color}30`,
                      color: prog.color,
                      fontFamily: "'IBM Plex Mono',monospace",
                      letterSpacing: '.05em',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${prog.color}30`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${prog.color}18`; }}
                  >{sub.label}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
