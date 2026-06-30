import { T } from '../utils/theme';

/**
 * Pre-crafted prompts sent to NOVA when a startup action button is clicked.
 * These give NOVA immediate context about the user's intent, skipping
 * generic greetings and jumping straight into productive conversation.
 *
 * Each button:
 * - id: unique identifier
 * - icon: emoji displayed on the button
 * - label: short action name
 * - sublabel: brief description
 * - color: theme color for the button
 * - prompt: pre-crafted message sent as the user's first message to NOVA
 * - targetProgram: which NOVA program to navigate to
 * - contextRequired: if true, only show when relevant context exists (e.g., goals exist)
 */
export const ACTION_BUTTONS = [
  {
    id: 'briefing',
    icon: '☀',
    label: 'Brief the Day',
    sublabel: 'Morning debrief',
    color: T.accent,
    prompt:
      'I want to brief the day ahead. Run through my goals, priorities, and help me set 3 key objectives.',
    targetProgram: 'briefing',
    contextRequired: false,
  },
  {
    id: 'goals',
    icon: '✦',
    label: 'Review Goals',
    sublabel: 'Full goal rundown',
    color: T.green,
    prompt:
      'I want a complete rundown of all my goals, sub-goals, sub-tasks, and checkpoints visualized.',
    targetProgram: 'briefing',
    contextRequired: true, // only show if projects.length > 0
  },
  {
    id: 'focus',
    icon: '◎',
    label: 'Focus in Deep',
    sublabel: 'Lock in on a task',
    color: T.blue,
    prompt:
      'I want to lock in on a task. Help me choose what to focus on and build an action plan.',
    targetProgram: 'focus',
    contextRequired: false,
  },
  {
    id: 'calibration',
    icon: '◆',
    label: 'Explore Paths',
    sublabel: 'Long-term vision',
    color: T.accent,
    prompt:
      'I want to review my long-term projects and roadmaps. Run a calibration on my Paths.',
    targetProgram: 'calibration',
    contextRequired: false,
  },
  {
    id: 'quick-log',
    icon: '+',
    label: 'Quick Log',
    sublabel: 'Add a task',
    color: T.cyan,
    prompt: 'I need to quickly log a task and get it scheduled into my day.',
    targetProgram: 'briefing',
    contextRequired: false,
  },
];

/**
 * Decision buttons shown on the session summary card (Scenario B).
 * These control what happens when a user returns to an existing session.
 */
export const SESSION_DECISION_BUTTONS = [
  {
    id: 'continue',
    label: 'Continue Briefing',
    action: 'navigate',
    description: 'Open the last program with full chat history intact',
  },
  {
    id: 'start-fresh',
    label: 'Start Fresh',
    action: 'new_session',
    description: 'Clear that program\'s chat and start a new session',
  },
  {
    id: 'different-action',
    label: 'Different Action',
    action: 'toggle_palette',
    description: 'Show the full action button grid',
  },
  {
    id: 'dismiss',
    label: 'Dismiss → HQ',
    action: 'dismiss',
    description: 'Close startup canvas and show HQ',
  },
];
