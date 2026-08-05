/**
 * B2 — Canvas draw-loop regression guard
 *
 * The canvas is the core navigation surface (goals, onward, map, paths,
 * skills). In No-AI mode it must render without an API key — AI gating is
 * handled at the feature level (NOVA chat/insights/programs), never by
 * blocking the canvas.
 *
 * This test verifies:
 *   1. With `loaded=true`, a real canvas element, and `apiKey=null`, the
 *      draw loop starts (requests an animation frame and draws).
 *   2. The draw loop does NOT start when not loaded or not on a canvas page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from '@testing-library/react';
import useAppCanvas from './useAppCanvas.js';

// ── The drawPages module is the only 2D-heavy part of the draw loop. ──
// It is mocked so the test can verify the loop lifecycle (size sync + first
// frame) without a real canvas 2D context, which jsdom does not provide.
vi.mock('../utils/drawPages.js', () => ({
  drawOnwardPage: vi.fn(),
  drawMapPage: vi.fn(),
  drawPathsPage: vi.fn(),
  drawSkillsPage: vi.fn(),
  drawGoalsPage: vi.fn(),
}));

// Canvas 2D context stub — jsdom has no canvas implementation.
// fillRect is a spy so tests can assert a frame actually drew.
function createCanvasContext() {
  const ctx = {};
  const noop = () => {};
  [
    'clearRect', 'save', 'restore', 'beginPath', 'arc',
    'fill', 'stroke', 'translate', 'scale', 'rotate', 'moveTo',
    'lineTo', 'rect', 'closePath', 'clip',
  ].forEach(k => { ctx[k] = noop; });
  ctx.fillRect = vi.fn();
  ctx.canvas = { width: 0, height: 0 };
  ctx.fillStyle = '';
  ctx.strokeStyle = '';
  return ctx;
}

// A harness component that mounts the hook and exposes its return value.
function Harness({ props, onReady }) {
  const handlers = useAppCanvas(props);
  if (onReady) onReady(handlers);
  return null;
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  // Memoize the context so every getContext('2d') call (both inside the
  // draw-loop effect and from test assertions) returns the SAME instance.
  let ctx = null;
  canvas.getContext = vi.fn(() => {
    if (!ctx) ctx = createCanvasContext();
    return ctx;
  });
  // Give the canvas a parent with real dimensions so syncSize() proceeds.
  const parent = document.createElement('div');
  parent.getBoundingClientRect = vi.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
  }));
  // clientHeight is a read-only getter in jsdom — define it instead of assigning.
  Object.defineProperty(parent, 'clientHeight', { value: 600, configurable: true });
  parent.appendChild(canvas);
  return canvas;
}

function makeProps(overrides = {}) {
  const canvas = makeCanvas();
  const props = {
    // Guard conditions
    loaded: true,
    apiKey: null,
    mainPage: 'hq',

    // Refs used by draw loop
    canvasRef: { current: canvas },
    activePageRef: { current: 'goals' },
    starsRef: { current: [] },
    resizeRef: { current: null },
    roRef: { current: null },
    animRef: { current: null },
    animT: { current: 0 },
    emptyAlpha: { current: 0 },

    // Refs passed to drawPages
    projectsRef: { current: [] },
    selectedIdRef: { current: null },
    sunIdRef: { current: null },
    panRef: { current: { x: 0, y: 0 } },
    draggingRef: { current: null },
    onwardItemsRef: { current: [] },
    pendingDropRef: { current: null },
    dragOverHourRef: { current: null },
    onwardHitAreasRef: { current: [] },
    skillsRef: { current: {} },
    selectedSkillRef: { current: null },
    skillsHitAreasRef: { current: [] },
    hoveredWeekRef: { current: null },
    mapWeekRectsRef: { current: [] },
    pathsHitAreasRef: { current: [] },
    solarHitAreasRef: { current: [] },
    solarSunPosRef: { current: null },
    goalHitAreasRef: { current: [] },
    topGoalsRef: { current: [] },
    goalDragRef: { current: null },
    resizeDragRef: { current: null },
    onwardDragRef: { current: null },

    // Refs used by mouse handlers
    nodeDragged: { current: null },
    mouseDownPos: { current: null },
    draggedTaskRef: { current: null },

    // Setters used by mouse handlers
    setResizeDrag: vi.fn(),
    setOnwardItems: vi.fn(),
    setPan: vi.fn(),
    setDragging: vi.fn(),
    setProjects: vi.fn(),
    setHoveredWeek: vi.fn(),
    setDragOverHour: vi.fn(),
    setPendingDrop: vi.fn(),
    setDraggedTask: vi.fn(),
    setSelectedId: vi.fn(),
    setOnwardClickedItem: vi.fn(),
    setSelectedSkillId: vi.fn(),

    // Navigation / action helpers
    openWaypoint: vi.fn(),
    closeWaypoint: vi.fn(),
    confirmPendingDrop: vi.fn(),
    cancelPendingDrop: vi.fn(),

    ...overrides,
  };
  return { props, canvas };
}

describe('useAppCanvas — draw loop runs without an API key (B2)', () => {
  let container;
  let rafSpy;
  let cafSpy;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Fake timers let the test deterministically advance the RAF loop.
    vi.useFakeTimers();
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(Date.now()), 16);
    });
    cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.removeChild(container);
  });

  it('starts the draw loop with loaded=true, apiKey=null (canvas renders without AI)', async () => {
    const { props, canvas } = makeProps();
    const ReactDOM = require('react-dom/client');
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(React.createElement(Harness, { props }));
    });

    // The draw loop must have scheduled a frame even though apiKey is null.
    expect(rafSpy).toHaveBeenCalled();

    // Advance one frame so the draw code actually runs.
    await act(async () => {
      vi.advanceTimersByTime(16);
    });

    // A frame must have run and drawn to the canvas (stars + goals page).
    const ctx = canvas.getContext('2d');
    expect(ctx.fillRect).toHaveBeenCalled();

    // Only the goals draw function should be used on the HQ goals page.
    const drawPages = await import('../utils/drawPages.js');
    expect(drawPages.drawGoalsPage).toHaveBeenCalled();

    await act(async () => { root.unmount(); });
  });

  it('does not start the draw loop when not loaded', async () => {
    const { props } = makeProps({ loaded: false });
    const ReactDOM = require('react-dom/client');
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(React.createElement(Harness, { props }));
    });

    expect(rafSpy).not.toHaveBeenCalled();

    await act(async () => { root.unmount(); });
  });

  it('does not start the draw loop on a non-canvas page', async () => {
    const { props } = makeProps({ mainPage: 'tracking' });
    const ReactDOM = require('react-dom/client');
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(React.createElement(Harness, { props }));
    });

    expect(rafSpy).not.toHaveBeenCalled();

    await act(async () => { root.unmount(); });
  });
});
