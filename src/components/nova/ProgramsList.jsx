import React, { useState } from 'react';
import { T } from '../../utils/theme.js';

const PROGRAMS = [
  {
    id: 'briefing',
    label: 'Goals',
    desc: 'Full debrief to start your day',
    color: '#F59E0B',
    defaultPage: 'goals',
    subNavs: [],
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
    desc: 'Quick sprint, get locked in',
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
    desc: 'Reset and recalibrate',
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
    desc: 'Plan the next day',
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
    desc: 'Personal projects & roadmaps',
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
      padding: collapsed ? '8px 6px' : '8px 14px',
      gap: 4,
    }}>

      {PROGRAMS.map(prog => {
        const isActive = mainPage === `program-${prog.id}`;
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
                padding: collapsed ? '8px 0' : '10px 14px',
                justifyContent: collapsed ? 'flex-end' : 'flex-start',
                borderRadius:10, cursor:'pointer', userSelect:'none',
                background: isActive ? `${prog.color}15` : 'transparent',
                border: isActive ? `1px solid ${prog.color}40` : '1px solid transparent',
                transition:'all .18s',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = `${T.surface}80`;
                  e.currentTarget.style.borderColor = `${T.border}80`;
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <div style={{
                width: collapsed ? 28 : 34, height: collapsed ? 28 : 34, borderRadius:8,
                background:`${prog.color}18`,
                border:`1px solid ${prog.color}30`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                {prog.icon}
              </div>
              {!collapsed && (
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{
                    fontFamily:"'Syne',sans-serif",
                    fontSize:18, fontWeight:700,
                    color: isActive ? prog.color : T.text,
                    letterSpacing:'.02em',
                  }}>{prog.label}</div>
                  <div style={{
                    fontFamily:"'IBM Plex Mono',monospace",
                    fontSize:10, color:T.muted, marginTop:2,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>{prog.desc}</div>
                </div>
              )}
            </div>

            {/* ── Hover-reveal label tooltip (collapsed mode) ── */}
            {collapsed && isHovered && (
              <div style={{
                position:'absolute', left:'100%', top:'50%', transform:'translateY(-50%)',
                marginLeft:8, zIndex:50,
                background:T.card, border:`1px solid ${T.border}`, borderRadius:6,
                padding:'5px 10px', whiteSpace:'nowrap',
                fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700,
                color: isActive ? prog.color : T.text,
                boxShadow:'0 4px 12px rgba(0,0,0,.3)',
                pointerEvents:'none',
              }}>
                {prog.label}
              </div>
            )}

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
