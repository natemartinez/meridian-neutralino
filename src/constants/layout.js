/**
 * Shared layout constants for the Onward (timeline) canvas page.
 * These values must stay in sync across the draw loop, mouse handlers,
 * and any other code that computes row positions.
 */

/** First visible hour row (6 AM) */
export const ROW_START = 6;

/** Last visible hour row (midnight) */
export const ROW_END = 24;

/** Total number of hour rows */
export const TOTAL_ROWS = 19; // ROW_END - ROW_START

/** Number of hours visible in the viewport at once */
export const VISIBLE_HOURS = 5.75;

/** Padding above the first row in CSS pixels */
export const PAD = 24;

/** Fallback viewport height when canvas has no parent */
export const DEFAULT_CLIENT_HEIGHT = 800;
