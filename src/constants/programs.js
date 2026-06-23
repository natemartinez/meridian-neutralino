/**
 * Program-related constants and helpers.
 * Programs are special canvas-based views that show their connected canvas
 * instead of the standard chat interface.
 */

// Programs that show their connected canvas instead of chat
export const PROGRAMS_WITH_CANVAS = [
  'program-briefing',
  'program-focus',
  'program-preview',
  'program-calibration',
];

// Default canvas page for each program
export const PROGRAM_DEFAULT_PAGES = {
  briefing: 'goals',
  focus: 'onward',
  preview: 'map',
  calibration: 'paths',
};

/** Returns true if the page is a canvas-based page (HQ or one of the canvas programs). */
export const isCanvasPage = (page) =>
  page === 'hq' || PROGRAMS_WITH_CANVAS.includes(page);

/** Returns true if the page is a program page (starts with "program-"). */
export const isProgram = (page) => page.startsWith('program-');

/** Extract the program ID from a program page string (e.g. "program-briefing" → "briefing"). */
export const extractProgId = (page) => page.replace('program-', '');
