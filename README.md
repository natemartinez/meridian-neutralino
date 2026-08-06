
## Overview: Your New Productivity Companion

Meridian is an AI-orchestrated productivity engine that **connects your long-term picture directly** to your **short-term execution**. Instead of letting you drown in endless to-do lists, the **built-in AI coach (NOVA)** supports you to pinpoint your **absolute highest priorities** and **break them down into actionable steps**. 

It then helps you map those microtasks directly into a structured, time-blocked schedule, ensuring you always know exactly what to focus on and when.

This application's architecture divides the application logic from AI’s logic, then puts together an organized JSON snippet using both the current state of the App & NOVA to give to the OpenRouter LLM to have the response returned. This design was built to optimize the state management flow. Currently, NOVA can be **powered by any OpenRouter model**.

## Features

- **Goal Management**: Create, track, and organize your long-term goals using the Eisenhower Quadrant Matrix 
- **AI Coach (NOVA)**: Built-in AI assistant that helps you prioritize and break down tasks and holds context to enhance responses
- **Long-term Planning (Paths)**: Create and manage long-term plans with milestones and subtasks that's automatically connected to the relevant tasks
- **Time-Blocking**: Schedule your tasks in structured time blocks
- **Work Logs**: Track your work sessions and productivity
- **Pomodoro Timer**: Built-in timer for focused work sessions
- **Deadlines**: Set and track deadlines for your goals
- **Canvas**: Visual workspace for planning and organizing

## Architecture

The interaction between NOVA and the App data follows **One pipeline, three contracts:**
All three flows converge on the same core: compileBlackboard() produces a flat JSON snapshot, injected as a user-role message (never into the cached system prompt), and the LLM's output is validated against a schema from nova-schemas.js.

Example from the Blackboard to OpenRouter:

```json
{
  "goals": [
    {
      "id": "goal-1",
      "title": "Complete project proposal",
      "status": "in_progress",
      "subtasks": [
        {
          "id": "subtask-1",
          "title": "Research competitors",
          "status": "completed"
        }
      ]
    }
  ]
}
```



### Flow 1: NOVA Chat

Entry: NovaCompassChat.jsx → sendNOVAMessage('compass', text)

Architecture: Multi-turn conversation loop with history (programChats).
Schema: CHAT_SCHEMA_OPENROUTER (content, options, ready).
Output contract: Free-form text + optional clickable options + optional embedded actions parsed by parseActionsFromResponse().
Commit path: Chat renders inline; if NOVA returns an action, the user sees a Confirm/Cancel button with undo (NovaCompassChat.jsx) before actionRegistry.dispatch() executes.
Signature: conversation loop + action registry + undo.

Diagram:
```
User types → sendNOVAMessage('compass', text) → compileBlackboard() → buildBlackboardUserMessage() → OpenRouter API → parseActionsFromResponse() → render chat + action buttons
```

### Flow 2: Subtask-building
Entry: StartupCanvas.jsx → suggestSubtasks(...) (defined in useNOVA.js)

Architecture: A one-shot LLM call — no chat history, no FSM, triggered imperatively from the startup canvas.
Schema: None — the prompt asks for a bare JSON array of { title, description }, parsed directly in suggestSubtasks().
Output contract: A structured array, not a message.
Commit path: Suggestions render as a checklist UI; acceptance calls handleBreakdownTask(goal, suggestions), persisting subtasks directly into the goal — no action registry, no undo — because the mutation is user-initiated, not NOVA-initiated.
Signature: one-shot generator → direct structured mutation of goal data.

Diagram:
```
User clicks "Suggest Subtasks" → suggestSubtasks(goal) → compileBlackboard() → buildBlackboardUserMessage() → OpenRouter API → parseSubtasksResponse() → render checklist UI
```

### Flow 3: Organize Tasks
Entry: OrganizeOverviewView.jsx → runOrganizeAnalysis() (defined in useNOVA.js)

Architecture: A one-shot analysis, explicitly documented as "NOT a chat turn" (useNOVA.js) — the result is stored in novaState.organizeAnalysis, never in programChats.
Schema: ORGANIZE_SCHEMA_OPENROUTER — the most elaborate: content, options, plus a structured action proposal (create-goal / link-goal / merge-paths / create-path), sanitized by extractOrganizeAction().
Output contract: Structured proposal object + human-readable content.
Commit path: Rendered as a proposal card with ✓ CONFIRM / ✕ DISMISS (OrganizeOverviewView.jsx) — the "agency guard" documented in ORGANIZE_DIRECTIVE: "You never execute mutations directly... propose choices for the user to make." On confirm, the view calls createGoalWithPaths / linkGoalToPath / mergePaths / setPathsStore directly.
Signature: one-shot analysis → schema-constrained action proposal → agency-guard Confirm/Cancel.

Diagram:
```
User clicks "Analyze & Organize" → runOrganizeAnalysis() → compileBlackboard() → buildBlackboardUserMessage() → OpenRouter API → extractOrganizeAction() → render proposal card with Confirm/Dismiss buttons
```

### Key Architecture Points: 

- *The Blackboard is the only data the LLM sees*: injected per-turn using `buildBlackboardUserMessage()`. This is the "organized JSON snippet" sent to OpenRouter's API.

- Static system prompt is cacheable: `buildNOVASystemPrompt()` contains only behavioral directives + schema instructions, no changable data to *maximize OpenRouter's prompt-cache hit rate*.

- The LLM never mutates state directly: all mutations funnel through `createActionRegistry()` with preconditions, or through explicit user Confirm/Cancel UI.


### No-AI mode

You can use Meridian **without any AI or API key**: goals, work logs, pomodoro, streaks, deadlines, and the canvas all work fully offline. AI features (NOVA chat, insights, program planning) are simply disabled until you add a key.



## Data & Privacy

Meridian is a local-first desktop application. Your goals, work logs, pomodoro history, streaks, and settings are stored **on your device only**, never on a Meridian server (there is none).


### What is stored where

| Data | Location | Notes |
| --- | --- | --- |
| App state (goals, logs, timers, UI prefs) | Local app storage (JSON via Neutralino, `~/.config/meridian/storage.json`) | Plaintext on disk |
| SQLite database (extension, if used) | Local `meridian.db` | Plaintext on disk |
| OpenRouter API key | OS keychain (encrypted) **or** local app storage | See below |
| AI mode / settings | Local app storage | Plaintext on disk |

### Your OpenRouter API key

- The key is sent **only** to `openrouter.ai` to authenticate your own requests.
- When encrypted storage is enabled (`--enable-encrypted-storage`), the key is stored in your **OS keychain** (Keychain on macOS, Credential Manager on Windows, libsecret on Linux) and is not written to the plaintext JSON file.
- When encrypted storage is not available, the key is stored locally on this device (not server-side). The UI tells you which mode is active.
- The key is **never** written to `localStorage`, and is masked in all logs (`sk-or-v1-…abcd`).

### What leaves your device

- **AI requests**: When NOVA is enabled, the current app context (goals, focus, plan) is sent to the OpenRouter provider you selected so the model can respond. This is required for AI features.
- **API key validation**: A lightweight auth request is sent to OpenRouter when you save/validate a key.
- **No telemetry, analytics, or crash reporting**: Meridian does not phone home.
