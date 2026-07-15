import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../utils/theme.js';

/**
 * RoutingChatBox — A general-purpose input positioned between the NOVA greeting
 * and the action buttons on the HQ landing page (StartupCanvas). It accepts
 * open-ended queries and, based on keyword matching against known programs,
 * routes the user to the appropriate program or feature section via
 * onSendPreCraftedPrompt.
 *
 * Props:
 *   onSendPreCraftedPrompt — (programId, promptText) => void — navigates + sends prompt
 *   novaLoading            — boolean — whether NOVA is currently loading
 */

// ── Intent routing map ──
const INTENT_ROUTES = [
  {
    keywords: ['brief', 'morning', 'debrief', 'goals', 'objective', 'plan today', "today's plan", 'day ahead'],
    programId: 'briefing',
    prompt: 'I want to brief the day ahead. Run through my goals, priorities, and help me set 3 key objectives.',
    label: 'Briefing',
  },
  {
    keywords: ['focus', 'deep work', 'lock in', 'concentrate', 'pomodoro', 'task', 'action plan'],
    programId: 'focus',
    prompt: 'I want to lock in on a task. Help me choose what to focus on and build an action plan.',
    label: 'Focus',
  },
  {
    keywords: ['preview', 'tomorrow', 'plan ahead', 'next day', 'schedule', 'upcoming'],
    programId: 'preview',
    prompt: 'Preview tomorrow and help me plan ahead.',
    label: 'Preview',
  },
  {
    keywords: ['paths', 'calibration', 'roadmap', 'project', 'milestone', 'long-term', 'vision', 'explore'],
    programId: 'calibration',
    prompt: 'I want to review my long-term projects and roadmaps. Run a calibration on my Paths.',
    label: 'Paths',
  },
  {
    keywords: ['track', 'log', 'session', 'history', 'stats', 'time', 'productivity'],
    programId: 'tracking',
    prompt: null,
    label: 'Tracking',
  },
];

function detectIntent(text) {
  const lower = text.toLowerCase();
  for (const route of INTENT_ROUTES) {
    if (route.keywords.some(kw => lower.includes(kw))) {
      return route;
    }
  }
  return null;
}

export default function RoutingChatBox({
  onSendPreCraftedPrompt,
  novaLoading,
}) {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Debounced intent detection
  useEffect(() => {
    if (!input.trim()) {
      setSuggestion(null);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const intent = detectIntent(input);
      if (intent) {
        setSuggestion(intent);
      } else {
        setSuggestion(null);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [input]);

  const routeTo = (programId, promptText) => {
    if (onSendPreCraftedPrompt) {
      onSendPreCraftedPrompt(programId, promptText);
    }
    setInput('');
    setSuggestion(null);
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || novaLoading) return;

    const intent = detectIntent(text);
    if (intent) {
      routeTo(intent.programId, intent.prompt || text);
    }
    // If no intent detected, do nothing (user should be more specific)
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = () => {
    if (!suggestion || novaLoading) return;
    routeTo(suggestion.programId, suggestion.prompt || input.trim());
  };

  return (
    <div style={{
      padding: '0 24px 12px',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask NOVA anything — brief the day, focus, preview tomorrow, explore paths…"
          rows={1}
          style={{
            flex: 1,
            background: T.card,
            border: suggestion ? `1px solid ${T.accent}60` : `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '9px 12px',
            color: T.text,
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11,
            outline: 'none',
            resize: 'none',
            lineHeight: 1.5,
            transition: 'border-color .15s',
            minHeight: 36,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={novaLoading || !input.trim()}
          style={{
            background: novaLoading || !input.trim() ? T.border : T.accent,
            border: 'none',
            borderRadius: 8,
            color: '#000',
            cursor: novaLoading || !input.trim() ? 'default' : 'pointer',
            padding: '8px 14px',
            fontFamily: "'Syne',sans-serif",
            fontSize: 11,
            fontWeight: 700,
            transition: 'background .15s',
            alignSelf: 'stretch',
            opacity: novaLoading || !input.trim() ? 0.5 : 1,
          }}
        >Ask NOVA</button>
      </div>

      {/* ── Intent suggestion chip ── */}
      {suggestion && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
          padding: '2px 4px',
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 9,
            color: T.muted,
          }}>
            Route to:
          </span>
          <button
            onClick={handleSuggestionClick}
            style={{
              background: `${T.accent}15`,
              border: `1px solid ${T.accent}40`,
              borderRadius: 5,
              padding: '3px 10px',
              color: T.accent,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.04em',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}25`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${T.accent}15`; }}
          >
            {suggestion.label} →
          </button>
        </div>
      )}
    </div>
  );
}
