/**
 * Component tests for NovaSidebarBlock
 *
 * Covers:
 *   - Collapsed state (returns null)
 *   - Default state (compass icon, NOVA label, confidence badge)
 *   - NovaCompassOpen state (NOVA CHAT label, accent border)
 *   - Confidence levels (high ≥70, medium ≥40, low <40)
 *   - Click behavior (onToggleCompass, fallback onOpenInsights/onBackToHQ)
 *   - Insights page state (onBackToHQ fallback)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from '@testing-library/react';
import NovaSidebarBlock from './NovaSidebarBlock.jsx';

/**
 * Render a React element without StrictMode by using createRoot directly.
 */
function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const ReactDOM = require('react-dom/client');
  const rootInstance = ReactDOM.createRoot(container);
  act(() => { rootInstance.render(React.createElement('div', null, ui)); });
  return {
    container,
    rootInstance,
    cleanup: () => {
      act(() => { rootInstance.unmount(); });
      document.body.removeChild(container);
    },
    getByText: (text) => {
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
        throw new Error(`Text "${text}" not found`);
      }
      if (matching.length === 1) return matching[0];
      const interactive = matching.filter(el =>
        el.tagName === 'BUTTON' || el.tagName === 'A' ||
        el.getAttribute('role') === 'button'
      );
      if (interactive.length > 0) return interactive[0];
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
        return matching[0];
      } catch {
        return null;
      }
    },
    click: (el) => { act(() => { el.click(); }); },
  };
}

function createDefaultProps(overrides = {}) {
  return {
    novaState: { syncEvents: [] },
    mainPage: 'hq',
    onOpenInsights: vi.fn(),
    onBackToHQ: vi.fn(),
    novaCompassOpen: false,
    onToggleCompass: vi.fn(),
    collapsed: false,
    ...overrides,
  };
}

describe('NovaSidebarBlock', () => {
  let cleanupFns = [];

  afterEach(() => {
    cleanupFns.forEach(fn => fn());
    cleanupFns = [];
    vi.restoreAllMocks();
  });

  function renderComp(props) {
    const r = render(React.createElement(NovaSidebarBlock, props));
    cleanupFns.push(r.cleanup);
    return r;
  }

  // ── Collapsed state ──

  describe('collapsed state', () => {
    it('returns null when collapsed is true', () => {
      const r = renderComp(createDefaultProps({ collapsed: true }));
      // Component returns null, so container should have no .sec.nova-block
      expect(r.container.querySelector('.sec.nova-block')).toBeNull();
    });
  });

  // ── Default state ──

  describe('default state', () => {
    it('renders the compass icon', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText('🧭')).toBeTruthy();
    });

    it('renders the NOVA label when compass is closed', () => {
      const r = renderComp(createDefaultProps({ novaCompassOpen: false }));
      expect(r.getByText('NOVA')).toBeTruthy();
    });

    it('renders the NOVA CHAT label when compass is open', () => {
      const r = renderComp(createDefaultProps({ novaCompassOpen: true }));
      expect(r.getByText('NOVA CHAT')).toBeTruthy();
    });

    it('renders the confidence percentage', () => {
      const r = renderComp(createDefaultProps());
      expect(r.getByText(/^\d+%$/)).toBeTruthy();
    });

    it('renders the confidence label', () => {
      const r = renderComp(createDefaultProps());
      // With empty syncEvents, confidence is 0 → "Getting started"
      expect(r.getByText('Getting started')).toBeTruthy();
    });
  });

  // ── Confidence levels ──

  describe('confidence levels', () => {
    it('shows "Knows you well" for high confidence (≥70)', () => {
      // Build syncEvents to produce high confidence
      // Need: accepted tasks, completed tasks, rich data, insight engagement
      const syncEvents = [];
      // 30 accepted + 0 rejected = 100% acceptance (30% * 1.0 = 30%)
      // 30 completed / 30 accepted = 100% completion (35% * 1.0 = 35%)
      // 40+ meaningful events = 100% richness (15% * 1.0 = 15%)
      // 20 accepted / 20 total = 100% engagement (20% * 1.0 = 20%)
      // Total = 100%
      for (let i = 0; i < 30; i++) {
        syncEvents.push({ type: 'task_accepted' });
        syncEvents.push({ type: 'task_completed' });
      }
      for (let i = 0; i < 20; i++) {
        syncEvents.push({ type: 'insight_accepted' });
      }
      // Add some extra meaningful events for richness
      for (let i = 0; i < 10; i++) {
        syncEvents.push({ type: 'briefing_done' });
      }

      const r = renderComp(createDefaultProps({
        novaState: { syncEvents },
      }));
      expect(r.getByText('Knows you well')).toBeTruthy();
    });

    it('shows "Learning fast" for medium confidence (40-69)', () => {
      // Build syncEvents to produce ~50% confidence
      const syncEvents = [];
      // 10 accepted + 10 rejected = 50% acceptance (30% * 0.5 = 15%)
      // 5 completed / 10 accepted = 50% completion (35% * 0.5 = 17.5%)
      // 20 meaningful / 40 saturation = 50% richness (15% * 0.5 = 7.5%)
      // 5 accepted / 10 total = 50% engagement (20% * 0.5 = 10%)
      // Total ≈ 50%
      for (let i = 0; i < 10; i++) {
        syncEvents.push({ type: 'task_accepted' });
        syncEvents.push({ type: 'task_rejected' });
      }
      for (let i = 0; i < 5; i++) {
        syncEvents.push({ type: 'task_completed' });
      }
      for (let i = 0; i < 5; i++) {
        syncEvents.push({ type: 'insight_accepted' });
        syncEvents.push({ type: 'insight_dismissed' });
      }

      const r = renderComp(createDefaultProps({
        novaState: { syncEvents },
      }));
      expect(r.getByText('Learning fast')).toBeTruthy();
    });

    it('shows "Getting started" for low confidence (<40)', () => {
      // Empty syncEvents → confidence = 0
      const r = renderComp(createDefaultProps({
        novaState: { syncEvents: [] },
      }));
      expect(r.getByText('Getting started')).toBeTruthy();
    });
  });

  // ── Click behavior ──

  describe('click behavior', () => {
    it('calls onToggleCompass when provided', () => {
      const onToggleCompass = vi.fn();
      const r = renderComp(createDefaultProps({ onToggleCompass }));

      const block = r.container.querySelector('.sec.nova-block > div');
      expect(block).toBeTruthy();
      r.click(block);
      expect(onToggleCompass).toHaveBeenCalledOnce();
    });

    it('calls onOpenInsights when onToggleCompass is not provided and not on insights page', () => {
      const onOpenInsights = vi.fn();
      const onBackToHQ = vi.fn();
      const r = renderComp(createDefaultProps({
        onToggleCompass: undefined,
        onOpenInsights,
        onBackToHQ,
        mainPage: 'hq',
      }));

      const block = r.container.querySelector('.sec.nova-block > div');
      r.click(block);
      expect(onOpenInsights).toHaveBeenCalledOnce();
      expect(onBackToHQ).not.toHaveBeenCalled();
    });

    it('calls onBackToHQ when onToggleCompass is not provided and on insights page', () => {
      const onOpenInsights = vi.fn();
      const onBackToHQ = vi.fn();
      const r = renderComp(createDefaultProps({
        onToggleCompass: undefined,
        onOpenInsights,
        onBackToHQ,
        mainPage: 'nova-insights',
      }));

      const block = r.container.querySelector('.sec.nova-block > div');
      r.click(block);
      expect(onBackToHQ).toHaveBeenCalledOnce();
      expect(onOpenInsights).not.toHaveBeenCalled();
    });
  });
});
