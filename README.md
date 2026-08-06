
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


## Installation

Meridian is a **native desktop application** built with [Neutralino.js](https://neutralino.js.org/) — it is **not** a localhost web app.

### What "native desktop" means here

- The UI is a React single-page app, but it runs inside your OS's **native WebView** (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux) — not a browser tab, and not a bundled Chromium/Electron runtime.
- A small native Neutralino server hosts the frontend locally inside the app and exposes a minimal, allowlisted set of OS capabilities (window control, events, extensions).
- A separate **Node.js extension process** (`extensions/meridian/`) provides the heavier native features — OS keychain storage for your API key, a local SQLite database (`better-sqlite3`), and app state files — via an internal IPC channel.
- The binary is small and memory-light because it reuses your OS's own WebView instead of shipping a full browser engine.

### Prerequisites

| Dependency | Version           | Notes                                        |
| ------------| -------------------| ----------------------------------------------|
| Node.js    | `>= 22`           | Required for tooling + the extension runtime |
| npm        | bundled with Node | Package manager                              |

Platform prerequisites (for Neutralino's WebView):

- **macOS**: none — uses the system WKWebView.
- **Windows 10/11**: Microsoft Edge **WebView2 Runtime** (preinstalled on current Windows).
- **Linux**: WebKitGTK + GTK3 dev libraries (e.g. `webkit2gtk-4.1`, `libgtk-3-dev`).

### Setup & run

```bash
# 1. Install root dependencies (React, Vite, Neutralino CLI)
npm install

# 2. Install the extension's native dependencies (better-sqlite3)
cd extensions/meridian && npm install && cd ..

# 3a. Run in the native desktop shell (Neutralino window)
npm start

# 3b. Or run the renderer alone in a browser for quick UI iteration
npm run dev
```

### Tests, lint, and release build

```bash
npm test          # unit tests (Vitest)
npm run lint      # ESLint on src/
npm run dist      # production build -> resources.neu + native binary (macOS .app)
```

> When you launch via `npm start`, the app runs as a desktop window with the OS keychain and local SQLite enabled. `npm run dev` is browser-only: key storage and the extension database are stubbed, and API calls go directly to OpenRouter from the browser.


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

**Entry:** NovaCompassChat.jsx → sendNOVAMessage('compass', text)
**Architecture:** Multi-turn conversation loop with history (programChats).

**Diagram:**
```
User types → sendNOVAMessage('compass', text) → compileBlackboard() → buildBlackboardUserMessage() → OpenRouter API → parseActionsFromResponse() → render chat + action buttons
```

### Flow 2: Subtask-building
**Entry:** StartupCanvas.jsx → suggestSubtasks(...) (defined in useNOVA.js)
**Architecture:** A one-shot LLM call — no chat history, no FSM, triggered imperatively from the startup canvas.


**Diagram:**
```
User clicks "Suggest Subtasks" → suggestSubtasks(goal) → compileBlackboard() → buildBlackboardUserMessage() → OpenRouter API → parseSubtasksResponse() → render checklist UI
```

### Flow 3: Organize Tasks
**Entry:** OrganizeOverviewView.jsx → runOrganizeAnalysis() (defined in useNOVA.js)
**Architecture:** A one-shot analysis, explicitly documented as "NOT a chat turn" (useNOVA.js) — the result is stored in novaState.organizeAnalysis, never in programChats.


**Diagram:**
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
| App state (goals, logs, timers, UI prefs) | `~/.config/meridian/meridian-state.json` | Plaintext on disk |
| Settings (model, morning time) | `~/.config/meridian/settings.json` | Plaintext on disk |
| Pomodoro timer state | `~/.config/meridian-pomodoro/state.json` | Plaintext on disk |
| SQLite database (NOVA sessions, insights, check-ins, knowledge pool) | `~/.config/meridian/nova-memory.db` | Plaintext on disk |
| OpenRouter API key | OS keychain (encrypted) **or** local app storage | See below |

### Your OpenRouter API key

- The key is sent **only** to `openrouter.ai` to authenticate your own requests.
- When encrypted storage is enabled (`--enable-encrypted-storage`), the key is stored in your **OS keychain** (Keychain on macOS, Credential Manager on Windows, libsecret on Linux) and is not written to the plaintext JSON file.
- When encrypted storage is not available, the key is stored locally on this device (not server-side). The UI tells you which mode is active.
- The key is **never** written to `localStorage`, and is masked in all logs (`sk-or-v1-…abcd`).

### What leaves your device

- **AI requests**: When NOVA is enabled, the current app context (goals, focus, plan) is sent to the OpenRouter provider you selected so the model can respond. This is required for AI features.
- **API key validation**: A lightweight auth request is sent to OpenRouter when you save/validate a key.
- **No telemetry, analytics, or crash reporting**: Meridian does not phone home.
