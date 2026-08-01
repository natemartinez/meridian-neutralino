import React, { useCallback, useEffect, useRef } from 'react';
import { T } from '../../utils/theme.js';
import { useTypewriter } from '../../hooks/useTypewriter.js';
import NOVAMessageBlock from './NOVAMessageBlock.jsx';

/**
 * TypewriterMessageBlock — Wraps NOVAMessageBlock with a character-by-character
 * typewriter animation for the most recent NOVA message.
 *
 * The typewriter progressively reveals the raw content string. On each tick,
 * the partial text is re-parsed into segments so that markdown formatting
 * (paragraphs, lists, code blocks, headers, options) renders correctly as it
 * appears. Code blocks are revealed line-by-line to maintain readability.
 *
 * Props:
 *   content        - Raw message string from NOVA
 *   color          - Program accent color
 *   onOptionSelect - (optionText: string) => void
 *   isLatest       - If true, apply typewriter effect; if false, render instantly
 *   typewriterDelay - Milliseconds per character (default: 20)
 */
export default function TypewriterMessageBlock({
  content,
  color,
  onOptionSelect,
  options,
  isLatest = false,
  typewriterDelay = 20,
}) {
  const {
    displayedText,
    isComplete,
    skipToEnd,
    progress,
  } = useTypewriter(content, {
    delayMs: typewriterDelay,
    enabled: isLatest && !!content,
  });

  const containerRef = useRef(null);
  const hasSkippedRef = useRef(false);

  // Auto-scroll to bottom as text is revealed
  useEffect(() => {
    if (isLatest && containerRef.current) {
      const el = containerRef.current.closest('[style*="overflow"]') || containerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [displayedText, isLatest]);

  // Skip to end on click/tap
  const handleClick = useCallback(() => {
    if (!isComplete && isLatest) {
      skipToEnd();
      hasSkippedRef.current = true;
    }
  }, [isComplete, isLatest, skipToEnd]);

  // If not the latest message, render instantly with full content
  if (!isLatest) {
    return (
      <NOVAMessageBlock
        content={content}
        color={color}
        onOptionSelect={onOptionSelect}
        options={options}
      />
    );
  }

  // If typewriter is complete, render full content (no animation wrapper needed)
  if (isComplete) {
    return (
      <NOVAMessageBlock
        content={content}
        color={color}
        onOptionSelect={onOptionSelect}
        options={options}
      />
    );
  }

  // During typewriter animation, render the progressively revealed content
  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ cursor: 'pointer', position: 'relative' }}
      title="Click to reveal full response"
    >
      <NOVAMessageBlock
        content={displayedText}
        color={color}
        onOptionSelect={onOptionSelect}
        options={options}
      />

      {/* Blinking cursor indicator while typing */}
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 12,
          background: color || T.accent,
          marginLeft: 2,
          borderRadius: 1,
          animation: 'typewriterBlink 0.8s step-end infinite',
          verticalAlign: 'middle',
          opacity: 0.8,
        }}
      />

      {/* Progress indicator (subtle) */}
      <div
        style={{
          position: 'absolute',
          bottom: -14,
          right: 0,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 7,
          color: T.muted,
          letterSpacing: '0.04em',
          opacity: 0.5,
        }}
      >
        {Math.round(progress * 100)}%
      </div>
    </div>
  );
}
