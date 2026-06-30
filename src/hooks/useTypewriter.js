import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTypewriter — Character-by-character text reveal with configurable delay.
 *
 * @param {string}  text         - The full text to type out
 * @param {Object}  opts
 * @param {number}  opts.delayMs - Milliseconds per character (default: 20)
 * @param {boolean} opts.enabled - Whether the typewriter effect is active (default: true)
 * @returns {{
 *   displayedText: string,     // The progressively revealed text
 *   isComplete: boolean,       // Whether the full text has been revealed
 *   skipToEnd: () => void,    // Immediately reveal all remaining text
 *   progress: number,          // 0-1 progress ratio
 * }}
 */
export function useTypewriter(text, { delayMs = 20, enabled = true } = {}) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const intervalRef = useRef(null);
  const isCompleteRef = useRef(false);
  const textRef = useRef(text);

  // Track text changes to reset the typewriter
  useEffect(() => {
    textRef.current = text;

    // Reset when text changes
    setDisplayedLength(0);
    isCompleteRef.current = false;

    if (!enabled || !text) {
      setDisplayedLength(text?.length || 0);
      isCompleteRef.current = true;
      return;
    }

    // Start the interval
    intervalRef.current = setInterval(() => {
      setDisplayedLength(prev => {
        const next = prev + 1;
        if (next >= textRef.current.length) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          isCompleteRef.current = true;
          return textRef.current.length;
        }
        return next;
      });
    }, delayMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, delayMs, enabled]);

  // Skip to end — reveal all remaining text immediately
  const skipToEnd = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayedLength(textRef.current.length);
    isCompleteRef.current = true;
  }, []);

  const totalLength = text?.length || 0;
  const isComplete = displayedLength >= totalLength;
  const progress = totalLength > 0 ? displayedLength / totalLength : 1;

  return {
    displayedText: text?.slice(0, displayedLength) || '',
    isComplete,
    skipToEnd,
    progress,
  };
}
