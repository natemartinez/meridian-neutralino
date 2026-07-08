/**
 * Component tests for NovaCompassChat
 *
 * Covers:
 *   - Initial render (welcome message, suggestions, input)
 *   - handleSend (empty input, loading guard, response with/without actions, API error)
 *   - handleConfirmAction (success, failure, dispatch throws)
 *   - handleCancelAction
 *   - handleUndo (success, failure)
 *   - 10s undo timer
 *   - handleSuggestionClick
 *   - Conditional rendering (suggestions visibility, action confirmation UI, undo bar)
 *
 * NOTE: React 19 StrictMode double-renders components. To avoid duplicate DOM
 * nodes and stale closure issues, we render into a container without StrictMode
 * by using React.createElement + createRoot directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NovaCompassChat from './NovaCompassChat.jsx';

// jsdom does not implement scrollIntoView — stub it globally
Element.prototype.scrollIntoView = vi.fn();

/**
 * Build a response content string that includes a JSON actions block.
 * The component passes response.content to parseActionsFromResponse,
 * which looks for ```json ... ``` blocks or inline { "actions": [...] }.
 */
function buildActionResponse(content, actions) {
  const jsonBlock = JSON.stringify({ actions });
  return `${content}\n\`\`\`json\n${jsonBlock}\n\`\`\``;
}

/**
 * Render a React element without StrictMode by using createRoot directly.
 * This avoids the double-rendering that React 19 StrictMode causes.
 */
function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = React.createElement(
    'div',
    { 'data-testroot': '' },
    ui
  );
  const ReactDOM = require('react-dom/client');
  const rootInstance = ReactDOM.createRoot(container);
  act(() => { rootInstance.render(root); });
  return {
    container,
    rootInstance,
    cleanup: () => {
      act(() => { rootInstance.unmount(); });
      document.body.removeChild(container);
    },

    /**
     * Find a single element whose textContent matches the given text.
     * Supports both string and RegExp patterns.
     *
     * Strategy: find elements whose textContent matches, then prefer
     * interactive/leaf elements (button, input, textarea, [role=button])
     * over container divs. This ensures getByText('Send') returns the
     * <button> element rather than a parent <div>.
     */
    getByText: (text) => {
      const elements = container.querySelectorAll('*');
      const isRegex = typeof text === 'object' && text instanceof RegExp;

      // Find all matching elements
      const matching = Array.from(elements).filter(el => {
        if (isRegex) return text.test(el.textContent?.trim());
        return el.textContent?.trim() === text;
      });

      if (matching.length === 0) {
        // Fallback: partial match (string only)
        if (!isRegex) {
          const partial = Array.from(elements).filter(el =>
            el.textContent && el.textContent.includes(text)
          );
          if (partial.length > 0) return partial[0];
        }
        throw new Error(`Text "${text}" not found`);
      }

      if (matching.length === 1) return matching[0];

      // Multiple matches — prefer interactive elements (button, input, etc.)
      // or the deepest (most specific) element
      const interactive = matching.filter(el =>
        el.tagName === 'BUTTON' ||
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'A' ||
        el.getAttribute('role') === 'button'
      );
      if (interactive.length > 0) return interactive[0];

      // Prefer leaf elements (no children) over container elements
      const leaf = matching.filter(el => el.children.length === 0);
      if (leaf.length > 0) return leaf[0];

      return matching[0];
    },

    queryByText: (text) => {
      try {
        const elements = container.querySelectorAll('*');
        const isRegex = typeof text === 'object' && text instanceof RegExp;
        const matching = Array.from(elements).filter(el => {
          if (isRegex) return text.test(el.textContent?.trim());
          return el.textContent?.trim() === text;
        });
        if (matching.length === 0) {
          if (!isRegex) {
            const partial = Array.from(elements).filter(el =>
              el.textContent && el.textContent.includes(text)
            );
            if (partial.length > 0) return partial[0];
          }
          return null;
        }
        if (matching.length === 1) return matching[0];
        const interactive = matching.filter(el =>
          el.tagName === 'BUTTON' || el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' || el.tagName === 'A' ||
          el.getAttribute('role') === 'button'
        );
        if (interactive.length > 0) return interactive[0];
        const leaf = matching.filter(el => el.children.length === 0);
        if (leaf.length > 0) return leaf[0];
        return matching[0];
      } catch {
        return null;
      }
    },

    getByPlaceholderText: (placeholder) => {
      const el = container.querySelector(`[placeholder="${placeholder}"]`);
      if (!el) throw new Error(`Placeholder "${placeholder}" not found`);
      return el;
    },

    getAllByText: (text) => {
      const elements = container.querySelectorAll('*');
      const isRegex = typeof text === 'object' && text instanceof RegExp;
      return Array.from(elements).filter(el => {
        if (isRegex) return text.test(el.textContent?.trim());
        return el.textContent?.trim() === text;
      });
    },

    queryAllByText: (text) => {
      const elements = container.querySelectorAll('*');
      const isRegex = typeof text === 'object' && text instanceof RegExp;
      return Array.from(elements).filter(el => {
        if (isRegex) return text.test(el.textContent?.trim());
        return el.textContent?.trim() === text;
      });
    },

    click: (el) => { act(() => { el.click(); }); },
  };
}

// ── Helpers ──

function createMockActionRegistry() {
  return {
    dispatch: vi.fn(() => ({ success: true })),
    getAvailableActions: vi.fn(() => []),
  };
}

function createDefaultProps(overrides = {}) {
  return {
    novaState: {},
    setNovaState: vi.fn(),
    novaLoading: false,
    sendNOVAMessage: vi.fn(() => Promise.resolve({ content: 'Hello from NOVA' })),
    mainPage: 'hq',
    activePage: 'goals',
    projects: [],
    setProjects: vi.fn(),
    onwardItems: [],
    setOnwardItems: vi.fn(),
    actionRegistry: createMockActionRegistry(),
    novaInteractions: { fireEvent: vi.fn() },
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Tests ──

describe('NovaCompassChat', () => {
  let cleanupFns = [];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanupFns.forEach(fn => fn());
    cleanupFns = [];
    vi.restoreAllMocks();
  });

  function renderComp(props) {
    const r = render(React.createElement(NovaCompassChat, props));
    cleanupFns.push(r.cleanup);
    return r;
  }

  // ── Initial Render ──

  describe('initial render', () => {
    it('renders the welcome message', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText("Hi, I'm NOVA. How can I help you right now?")).toBeTruthy();
    });

    it('renders the NOVA CHAT header', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText('NOVA CHAT')).toBeTruthy();
    });

    it('renders the close button', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText('✕')).toBeTruthy();
    });

    it('renders suggestion buttons when no messages sent yet', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText('Add a task to review Q2 metrics')).toBeTruthy();
      expect(r.getByText('What should I focus on today?')).toBeTruthy();
      expect(r.getByText('Break down my current goal')).toBeTruthy();
    });

    it('renders the input field', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByPlaceholderText('Message NOVA...')).toBeTruthy();
    });

    it('renders the Send button', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText('Send')).toBeTruthy();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const r = renderComp(createDefaultProps({ onClose }));
      r.click(r.getByText('✕'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('shows loading indicator when novaLoading is true', () => {
      const r = renderComp(createDefaultProps({ novaLoading: true }));
      const dots = r.container.querySelectorAll('span');
      const pulseDot = Array.from(dots).find(
        d => d.style.animation && d.style.animation.includes('pulse')
      );
      expect(pulseDot).toBeTruthy();
    });
  });

  // ── handleSend ──

  describe('handleSend', () => {
    it('does not send empty input', async () => {
      const sendNOVAMessage = vi.fn();
      const r = renderComp(createDefaultProps({ sendNOVAMessage }));
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      expect(sendBtn.disabled).toBe(true);
    });

    it('does not send when novaLoading is true', async () => {
      const sendNOVAMessage = vi.fn();
      const r = renderComp(createDefaultProps({ sendNOVAMessage, novaLoading: true }));
      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'hello');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      expect(sendBtn.disabled).toBe(true);
    });

    it('sends message and displays response without actions', async () => {
      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({ content: 'Here is some helpful advice.' })
      );
      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'help me');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(sendNOVAMessage).toHaveBeenCalledWith('compass', 'help me');
      });

      await vi.waitFor(() => {
        expect(r.getByText('Here is some helpful advice.')).toBeTruthy();
      });
    });

    it('sends message and shows action confirmation when response has actions', async () => {
      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('I have added a task for you.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } },
          ]),
        })
      );
      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'add a task');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('NOVA wants to:')).toBeTruthy();
      });

      await vi.waitFor(() => {
        expect(r.getByText('Add task: "Review Q2"')).toBeTruthy();
      });

      expect(r.getByText('Confirm')).toBeTruthy();
      expect(r.getByText('Cancel')).toBeTruthy();
    });

    it('handles API error gracefully', async () => {
      const sendNOVAMessage = vi.fn(() => Promise.reject(new Error('Network error')));
      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'hello');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText(/Error: Network error/)).toBeTruthy();
      });
    });

    it('handles empty response content', async () => {
      const sendNOVAMessage = vi.fn(() => Promise.resolve({ content: '' }));
      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'hello');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText("Sorry, I didn't get a response. Please try again.")).toBeTruthy();
      });
    });
  });

  // ── handleConfirmAction ──

  describe('handleConfirmAction', () => {
    it('dispatches action on confirm and shows success', async () => {
      const dispatch = vi.fn(() => ({ success: true, createdId: 'item-1' }));
      const actionRegistry = createMockActionRegistry();
      actionRegistry.dispatch = dispatch;

      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Adding a task.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage, actionRegistry }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'add a task');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Confirm')).toBeTruthy();
      });

      r.click(r.getByText('Confirm'));

      await vi.waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith('ADD_ONWARD_ITEM', { title: 'Review Q2' }, {});
      });

      await vi.waitFor(() => {
        expect(r.getByText(/Done!/)).toBeTruthy();
      });
    });

    it('shows error when dispatch fails', async () => {
      const dispatch = vi.fn(() => ({ success: false, error: 'Goal not found' }));
      const actionRegistry = createMockActionRegistry();
      actionRegistry.dispatch = dispatch;

      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Toggling subtask.', [
            { type: 'TOGGLE_SUBTASK', params: { goalId: 'g1', subtaskId: 'st1' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage, actionRegistry }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'toggle');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Confirm')).toBeTruthy();
      });

      r.click(r.getByText('Confirm'));

      await vi.waitFor(() => {
        expect(r.getByText(/Could not complete action/)).toBeTruthy();
      });
    });

    it('shows error when dispatch throws', async () => {
      const dispatch = vi.fn(() => { throw new Error('Unexpected error'); });
      const actionRegistry = createMockActionRegistry();
      actionRegistry.dispatch = dispatch;

      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Doing something.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Test' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage, actionRegistry }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'do it');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Confirm')).toBeTruthy();
      });

      r.click(r.getByText('Confirm'));

      await vi.waitFor(() => {
        expect(r.getByText(/Error executing action/)).toBeTruthy();
      });
    });
  });

  // ── handleCancelAction ──

  describe('handleCancelAction', () => {
    it('cancels pending action and shows cancellation message', async () => {
      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Adding a task.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'add a task');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Cancel')).toBeTruthy();
      });

      r.click(r.getByText('Cancel'));

      await vi.waitFor(() => {
        expect(r.getByText(/Cancelled/)).toBeTruthy();
      });
    });
  });

  // ── handleUndo ──

  describe('handleUndo', () => {
    it('shows undo button after successful action and can undo', async () => {
      const dispatch = vi.fn();
      dispatch.mockReturnValueOnce({ success: true, createdId: 'item-1' });
      dispatch.mockReturnValueOnce({ success: true });

      const actionRegistry = createMockActionRegistry();
      actionRegistry.dispatch = dispatch;

      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Adding a task.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage, actionRegistry }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'add a task');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Confirm')).toBeTruthy();
      });

      r.click(r.getByText('Confirm'));

      await vi.waitFor(() => {
        expect(r.getByText('↩ Undo')).toBeTruthy();
      });

      r.click(r.getByText('↩ Undo'));

      await vi.waitFor(() => {
        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch).toHaveBeenLastCalledWith('DELETE_ONWARD_ITEM', { id: 'item-1' }, {});
      });

      await vi.waitFor(() => {
        expect(r.getByText(/Action undone/)).toBeTruthy();
      });
    });

    it('shows error when undo fails', async () => {
      const dispatch = vi.fn();
      dispatch.mockReturnValueOnce({ success: true, createdId: 'item-1' });
      dispatch.mockReturnValueOnce({ success: false, error: 'Item not found' });

      const actionRegistry = createMockActionRegistry();
      actionRegistry.dispatch = dispatch;

      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Adding a task.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage, actionRegistry }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'add a task');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Confirm')).toBeTruthy();
      });

      r.click(r.getByText('Confirm'));

      await vi.waitFor(() => {
        expect(r.getByText('↩ Undo')).toBeTruthy();
      });

      r.click(r.getByText('↩ Undo'));

      await vi.waitFor(() => {
        expect(r.getByText(/Could not undo/)).toBeTruthy();
      });
    });
  });

  // ── 10s undo timer ──

  describe('undo timer', () => {
    it('clears undo state after 10 seconds', async () => {
      const dispatch = vi.fn(() => ({ success: true, createdId: 'item-1' }));
      const actionRegistry = createMockActionRegistry();
      actionRegistry.dispatch = dispatch;

      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({
          content: buildActionResponse('Adding a task.', [
            { type: 'ADD_ONWARD_ITEM', params: { title: 'Review Q2' } },
          ]),
        })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage, actionRegistry }));

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'add a task');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Confirm')).toBeTruthy();
      });

      r.click(r.getByText('Confirm'));

      await vi.waitFor(() => {
        expect(r.getByText('↩ Undo')).toBeTruthy();
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      await vi.waitFor(() => {
        expect(r.queryAllByText('↩ Undo').length).toBe(0);
      });
    });
  });

  // ── handleSuggestionClick ──

  describe('handleSuggestionClick', () => {
    it('sends suggestion text when suggestion button is clicked', async () => {
      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({ content: 'Here is some advice.' })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      r.click(r.getByText('Add a task to review Q2 metrics'));

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await vi.waitFor(() => {
        expect(sendNOVAMessage).toHaveBeenCalledWith('compass', 'Add a task to review Q2 metrics');
      });
    });
  });

  // ── Conditional Rendering ──

  describe('conditional rendering', () => {
    it('hides suggestions after a message is sent', async () => {
      const sendNOVAMessage = vi.fn(() =>
        Promise.resolve({ content: 'Response' })
      );

      const r = renderComp(createDefaultProps({ sendNOVAMessage }));

      expect(r.getByText('Suggestions')).toBeTruthy();

      const input = r.getByPlaceholderText('Message NOVA...');
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'hello');
      const sendBtn = r.getByText('Send');
      expect(sendBtn.tagName).toBe('BUTTON');
      r.click(sendBtn);

      await vi.waitFor(() => {
        expect(r.getByText('Response')).toBeTruthy();
      });

      expect(r.queryAllByText('Suggestions').length).toBe(0);
    });
  });
});
