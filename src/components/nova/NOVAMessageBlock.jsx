import React, { useMemo } from 'react';
import { T } from '../../utils/theme.js';
import { parseNOVAMessage, parseInlineFormatting } from '../../utils/novaChatFormat.js';

/**
 * NOVAMessageBlock
 *
 * Renders a single NOVA assistant message as structured, visually distinct
 * segments — paragraphs, bullet lists, numbered lists, section headers,
 * code blocks, dividers, and options — instead of a monolithic text block.
 *
 * Props:
 *   content        - Raw message string from NOVA
 *   color          - Program accent color (e.g. meta.color)
 *   onOptionSelect - (optionText: string) => void  (optional, for multiple-choice)
 */
export default function NOVAMessageBlock({ content, color, onOptionSelect }) {
  const segments = useMemo(() => parseNOVAMessage(content), [content]);
  const accentColor = color || T.accent;

  if (!segments.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {segments.map((seg, idx) => {
        switch (seg.type) {
          case 'paragraph':
            return (
              <ParagraphBlock
                key={idx}
                content={seg.content}
                accentColor={accentColor}
              />
            );

          case 'bullet':
            return (
              <BulletListBlock
                key={idx}
                items={seg.items}
                accentColor={accentColor}
              />
            );

          case 'numbered':
            return (
              <NumberedListBlock
                key={idx}
                items={seg.items}
                accentColor={accentColor}
              />
            );

          case 'header':
            return (
              <HeaderBlock
                key={idx}
                content={seg.content}
                accentColor={accentColor}
              />
            );

          case 'code':
            return (
              <CodeBlock
                key={idx}
                content={seg.content}
                language={seg.language}
              />
            );

          case 'options':
            return (
              <OptionsBlock
                key={idx}
                items={seg.items}
                accentColor={accentColor}
                onOptionSelect={onOptionSelect}
              />
            );

            return (
              <div
                key={idx}
                style={{
                  height: 1,
                  background: `${T.border}60`,
                  margin: '2px 0',
                }}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

/* ── Paragraph ── */
function ParagraphBlock({ content, accentColor }) {
  const tokens = useMemo(() => parseInlineFormatting(content), [content]);

  return (
    <div style={{ lineHeight: 1.7, fontSize: 14, color: T.text }}>
      {tokens.map((token, i) =>
        token.bold ? (
          <strong
            key={i}
            style={{ color: accentColor, fontWeight: 700 }}
          >
            {token.text}
          </strong>
        ) : (
          <span key={i}>{token.text}</span>
        )
      )}
    </div>
  );
}

/* ── Bullet List ── */
function BulletListBlock({ items, accentColor }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        paddingLeft: 4,
        borderLeft: `2px solid ${accentColor}40`,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            lineHeight: 1.6,
            fontSize: 14,
            color: T.text,
          }}
        >
          <span style={{ color: accentColor, flexShrink: 0, userSelect: 'none' }}>•</span>
          <InlineText content={item} accentColor={accentColor} />
        </div>
      ))}
    </div>
  );
}

/* ── Numbered List ── */
function NumberedListBlock({ items, accentColor }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        paddingLeft: 4,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            lineHeight: 1.6,
            fontSize: 14,
            color: T.text,
          }}
        >
          <span
            style={{
              color: accentColor,
              flexShrink: 0,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              minWidth: 16,
              textAlign: 'right',
              userSelect: 'none',
            }}
          >
            {i + 1}.
          </span>
          <InlineText content={item} accentColor={accentColor} />
        </div>
      ))}
    </div>
  );
}

/* ── Section Header ── */
function HeaderBlock({ content, accentColor }) {
  const tokens = useMemo(() => parseInlineFormatting(content), [content]);

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        color: accentColor,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1.5,
        marginTop: 2,
      }}
    >
      {tokens.map((token, i) =>
        token.bold ? (
          <strong key={i} style={{ fontWeight: 700 }}>
            {token.text}
          </strong>
        ) : (
          <span key={i}>{token.text}</span>
        )
      )}
    </div>
  );
}

/* ── Code Block ── */
function CodeBlock({ content, language }) {
  return (
    <div
      style={{
        background: '#0d0f17',
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: '8px 10px',
        overflowX: 'auto',
      }}
    >
      {language && (
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 7,
            color: T.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {language}
        </div>
      )}
      <pre
        style={{
          margin: 0,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          color: T.text,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </pre>
    </div>
  );
}

/* ── Options Block (multiple-choice) ── */
function OptionsBlock({ items, accentColor, onOptionSelect }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginTop: 4,
        paddingTop: 8,
        borderTop: `1px solid ${T.border}60`,
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => onOptionSelect?.(item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: `${accentColor}10`,
            border: `1px solid ${accentColor}30`,
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            color: T.text,
            lineHeight: 1.5,
            transition: 'all .14s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = `${accentColor}20`;
            e.currentTarget.style.borderColor = `${accentColor}60`;
            e.currentTarget.style.transform = 'translateX(3px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = `${accentColor}10`;
            e.currentTarget.style.borderColor = `${accentColor}30`;
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: `${accentColor}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              color: accentColor,
              flexShrink: 0,
            }}
          >
            {i + 1}
          </span>
          <span style={{ flex: 1 }}>{item}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Inline Text (handles bold within list items) ── */
function InlineText({ content, accentColor }) {
  const tokens = useMemo(() => parseInlineFormatting(content), [content]);

  return (
    <span style={{ flex: 1 }}>
      {tokens.map((token, i) =>
        token.bold ? (
          <strong
            key={i}
            style={{ color: accentColor, fontWeight: 700 }}
          >
            {token.text}
          </strong>
        ) : (
          <span key={i}>{token.text}</span>
        )
      )}
    </span>
  );
}
