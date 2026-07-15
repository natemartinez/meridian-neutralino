import React from 'react';
import { T } from '../../utils/theme.js';
import { computePlanningConfidence } from '../../utils/nova.js';

export default function NovaSidebarBlock({
  novaState, mainPage, onOpenInsights, onBackToHQ,
  novaCompassOpen, onToggleCompass, collapsed,
}) {
  const confidence = computePlanningConfidence(novaState.syncEvents);
  const confidenceColor = confidence >= 70 ? T.green : confidence >= 40 ? T.accent : T.muted;
  const confidenceLabel = confidence >= 70 ? 'Knows you well' : confidence >= 40 ? 'Learning fast' : 'Getting started';
  const insightsOpen = mainPage === 'nova-insights';

  // When sidebar is collapsed, this block is hidden (CSS display:none).
  // A floating compass icon handles toggling from collapsed state.
  if (collapsed) return null;

  return (
    <div className="sec nova-block">
      <div
        style={{
          width:'100%',
          borderRadius:7,
          border:`1px solid ${novaCompassOpen ? T.accent : T.border}`,
          background:T.card,
          overflow:'hidden',
          cursor:'pointer',
          transition:'border-color .2s',
          margin:'0 4px',
        }}
        onClick={() => {
          if (onToggleCompass) {
            onToggleCompass();
          } else {
            // Fallback: existing behavior
            insightsOpen ? onBackToHQ() : onOpenInsights();
          }
        }}
      >
        {/* Compass header — replaces confidence bar */}
        <div style={{ padding:'8px 10px 6px', textAlign:'center' }}>
          <div style={{
            fontSize:22,
            lineHeight:1.2,
            marginBottom:2,
            filter: novaCompassOpen ? 'brightness(1.2)' : 'none',
            transition:'filter .2s',
          }}>
            🧭
          </div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize:9,
            color: novaCompassOpen ? T.accent : T.muted,
            letterSpacing:'.08em',
            transition:'color .2s',
          }}>
            {novaCompassOpen ? 'NOVA CHAT' : 'NOVA'}
          </div>
          {/* Confidence badge — small overlay */}
          <div style={{
            display:'inline-flex',
            alignItems:'center',
            gap:3,
            marginTop:3,
            padding:'1px 6px',
            borderRadius:4,
            background:`${confidenceColor}18`,
          }}>
            <span style={{
              fontFamily:"'Syne',sans-serif",
              fontWeight:700,
              fontSize:10,
              color:confidenceColor,
            }}>{confidence}%</span>
            <span style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize:7.5,
              color:confidenceColor,
              opacity:.7,
            }}>{confidenceLabel}</span>
          </div>
          {/* Mini confidence bar */}
          <div style={{
            height:2,
            borderRadius:2,
            background:T.border,
            overflow:'hidden',
            marginTop:4,
          }}>
            <div style={{
              height:'100%',
              width:`${confidence}%`,
              background:confidenceColor,
              borderRadius:2,
              transition:'width .5s ease',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
