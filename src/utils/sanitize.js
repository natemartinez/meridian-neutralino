import DOMPurify from 'dompurify';

/**
 * Sanitize user-authored HTML before persisting it (e.g. to localStorage).
 *
 * Work log content is authored with a rich-text editor (tiptap) and stored as
 * HTML. DOMPurify strips script tags, event handlers, javascript: URLs and
 * other dangerous constructs while preserving safe formatting markup (bold,
 * lists, headings, code, etc.) that the editor needs.
 *
 * @param {string} html - Raw HTML (e.g. editor.getHTML())
 * @returns {string} Sanitized HTML safe to store and re-render
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'script', 'template'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  });
}

/**
 * Sanitize a plain-text value (folder names, log titles) for storage.
 * Strips any HTML-like markup and control characters, then trims/length-limits.
 *
 * @param {string} text - Raw user-provided text
 * @param {number} [maxLen] - Optional maximum length
 * @returns {string} Safe plain text
 */
export function sanitizeText(text, maxLen = 500) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    // Intentional: strip ASCII control chars (NUL, BS, FF, etc.) that
    // can break JSON/localStorage round-trips or render as invisible UI text.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Deep-sanitize the work-log store shape:
 *   folders: Array<{ id, name }>
 *   logs:    Record<folderId, Array<{ id, title, content, createdAt, updatedAt }>>
 *
 * Used both when persisting state and when reading back from localStorage so
 * tainted data is never written to, or trusted from, browser storage.
 *
 * @param {object} state - { folders, logs } loaded or about-to-be-saved
 * @returns {{ folders: Array, logs: object }} Sanitized copy
 */
export function sanitizeWorkLogsState({ folders = [], logs = {} } = {}) {
  const safeFolders = Array.isArray(folders)
    ? folders.map(f => ({
        ...f,
        name: sanitizeText(typeof f?.name === 'string' ? f.name : ''),
      }))
    : [];

  const safeLogs = {};
  if (logs && typeof logs === 'object') {
    for (const folderId of Object.keys(logs)) {
      const list = logs[folderId];
      if (!Array.isArray(list)) continue;
      safeLogs[folderId] = list.map(l => ({
        ...l,
        title:   sanitizeText(typeof l?.title === 'string' ? l.title : 'Untitled Log'),
        content: sanitizeHTML(typeof l?.content === 'string' ? l.content : ''),
      }));
    }
  }

  return { folders: safeFolders, logs: safeLogs };
}
