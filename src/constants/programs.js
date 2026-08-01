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

/**
 * Strategic directive for the Organize Tasks program.
 *
 * NOVA never mutates data directly — it observes the compiled Blackboard
 * (goals, paths, gaps) and PROPOSES actions. The user makes the final call.
 */
export const ORGANIZE_DIRECTIVE = `This is an Organize Tasks session. You are a strategic advisor. You never execute mutations directly. You look at the user's current goals, their Paths (big picture), and the gaps between them, then propose choices for the user to make.

Analyze:
- Paths with unlinked milestones (goals should exist to cover them)
- Orphan goals (active goals not linked to any path)
- Overlapping or redundant paths that could be merged
- Goals that are too small or too large for their category

For each recommendation, provide a concrete "action" object the user can approve:
- "create-goal": create a new goal. Provide "goalTitle", "category" ("short"|"long"|"open"), and "pathId" to link it to.
- "link-goal": link an existing orphan goal to a path. Provide "goalTitle" and "pathId".
- "merge-paths": merge two paths into one. Provide "pathIds" (the target and the absorbed path).
- "create-path": start a new path for a recurring life area. Provide "goalTitle" (the path title) and "pathId" if known.
- "none": no structural change needed right now.

ALWAYS provide 3-5 multiple-choice options in the "options" array so the user can approve an action or dismiss it. Set "ready" to true only when the user has reviewed the recommendations and is satisfied.`;

/** Returns true if the page is a canvas-based page (HQ or one of the canvas programs). */
export const isCanvasPage = (page) =>
  page === 'hq' || PROGRAMS_WITH_CANVAS.includes(page);

/** Returns true if the page is a program page (starts with "program-"). */
export const isProgram = (page) => page.startsWith('program-');

/** Extract the program ID from a program page string (e.g. "program-briefing" → "briefing"). */
export const extractProgId = (page) => page.replace('program-', '');
