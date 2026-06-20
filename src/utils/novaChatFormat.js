/**
 * NOVA Chat Message Formatting Utilities
 *
 * Transforms raw LLM response text into structured segments for rich rendering.
 * Supports: paragraphs, bullet lists, numbered lists, section headers,
 * code blocks, dividers, options blocks, and inline bold formatting.
 */

/**
 * Parse a NOVA message string into an array of structured segment objects.
 *
 * @param {string} text - Raw message content from NOVA
 * @returns {Array<{type: string, content?: string, items?: string[], language?: string}>}
 *
 * Segment types:
 *   { type: 'paragraph', content: '...' }
 *   { type: 'bullet',    items: ['...', '...'] }
 *   { type: 'numbered',  items: ['...', '...'] }
 *   { type: 'header',    content: '...' }
 *   { type: 'code',      content: '...', language: '...' }
 *   { type: 'divider' }
 *   { type: 'options',   items: ['...', '...', '...'] }
 */
export function parseNOVAMessage(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n');
  const segments = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line — skip (acts as paragraph separator naturally)
    if (trimmed === '') {
      i++;
      continue;
    }

    // Divider: --- or ___ or ***
    if (/^[-_*]{3,}$/.test(trimmed)) {
      segments.push({ type: 'divider' });
      i++;
      continue;
    }

    // Code block: ``` or ````
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      segments.push({
        type: 'code',
        content: codeLines.join('\n'),
        language: language || undefined,
      });
      continue;
    }

    // Options block: [OPTIONS] marker followed by option lines
    if (trimmed === '[OPTIONS]') {
      const items = [];
      i++;
      while (i < lines.length) {
        const optLine = lines[i].trim();
        if (optLine === '' || optLine === '[/OPTIONS]') {
          i++;
          break;
        }
        // Stop if we hit another marker
        if (optLine.startsWith('[') && optLine.endsWith(']')) break;
        items.push(optLine);
        i++;
      }
      if (items.length > 0) {
        segments.push({ type: 'options', items });
      }
      continue;
    }

    // Section header: lines ending with ":" or starting with "##" or "**...:**"
    if (
      /^##\s/.test(trimmed) ||
      /^\*\*[^*]+\*\*:/.test(trimmed) ||
      (/^[A-Z][A-Za-z\s]+:$/.test(trimmed) && trimmed.length < 60)
    ) {
      segments.push({ type: 'header', content: trimmed.replace(/^##\s*/, '') });
      i++;
      continue;
    }

    // Bullet list: lines starting with -, *, •, or +
    if (/^[\s]*[-*•+]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[\s]*[-*•+]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•+]\s+/, ''));
        i++;
      }
      segments.push({ type: 'bullet', items });
      continue;
    }

    // Numbered list: lines starting with 1., 2., etc.
    if (/^\s*\d+[.)]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      segments.push({ type: 'numbered', items });
      continue;
    }

    // Paragraph: collect consecutive non-empty lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '') {
      // Don't consume lines that belong to other segment types
      const nextTrimmed = lines[i].trim();
      if (
        /^[-*•+]\s/.test(nextTrimmed) ||
        /^\d+[.)]\s/.test(nextTrimmed) ||
        /^```/.test(nextTrimmed) ||
        /^[-_*]{3,}$/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      segments.push({ type: 'paragraph', content: paraLines.join('\n').trim() });
    }
  }

  return segments;
}

/**
 * Parse inline formatting within a text string.
 * Currently supports **bold** text.
 *
 * @param {string} text
 * @returns {Array<{text: string, bold: boolean}>}
 */
export function parseInlineFormatting(text) {
  if (!text) return [{ text: '', bold: false }];

  const tokens = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the bold segment
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    // The bold segment
    tokens.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last bold segment
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), bold: false });
  }

  // If no bold was found, return the whole text as a single token
  if (tokens.length === 0) {
    tokens.push({ text, bold: false });
  }

  return tokens;
}
