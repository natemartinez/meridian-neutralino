import { useEffect } from 'react';
import { T } from '../utils/theme.js';
import { resolveGoalRenderPos, calculateQuadrant } from '../utils/helpers.js';
import { drawOnwardPage, drawMapPage, drawPathsPage, drawSkillsPage, drawGoalsPage } from '../utils/drawPages.js';
import { isCanvasPage } from '../constants/programs.js';
import { ROW_START, ROW_END, VISIBLE_HOURS, TOTAL_ROWS, PAD, DEFAULT_CLIENT_HEIGHT } from '../constants/layout.js';

/**
 * useAppCanvas — encapsulates the canvas draw loop and all 6 mouse handlers.
 *
 * Accepts all dependencies (refs, setters, navigation helpers, constants) as a
 * single options object and returns the mouse handler functions.
 */
export default function useAppCanvas({
  // Guard conditions
  loaded,
  apiKey,
  mainPage,

  // Refs used by draw loop
  canvasRef,
  activePageRef,
  starsRef,
  resizeRef,
  roRef,
  animRef,
  animT,
  emptyAlpha,

  // Refs passed to drawPages
  projectsRef,
  selectedIdRef,
  sunIdRef,
  panRef,
  draggingRef,
  onwardItemsRef,
  pendingDropRef,
  dragOverHourRef,
  onwardHitAreasRef,
  skillsRef,
  selectedSkillRef,
  skillsHitAreasRef,
  hoveredWeekRef,
  mapWeekRectsRef,
  pathsHitAreasRef,
  solarHitAreasRef,
  solarSunPosRef,
  goalHitAreasRef,
  topGoalsRef,
  goalDragRef,
  resizeDragRef,
  onwardDragRef,

  // Refs used by mouse handlers
  nodeDragged,
  mouseDownPos,
  draggedTaskRef,

  // Setters used by mouse handlers
  setResizeDrag,
  setOnwardItems,
  setPan,
  setDragging,
  setProjects,
  setHoveredWeek,
  setDragOverHour,
  setPendingDrop,
  setDraggedTask,
  setSelectedId,
  setOnwardClickedItem,
  setSelectedSkillId,

  // Navigation / action helpers
  openWaypoint,
  closeWaypoint,
  confirmPendingDrop,
  cancelPendingDrop,
}) {
  // ── Canvas draw loop ──────────────────────────────────────
  useEffect(() => {
    console.log('[DEBUG] useAppCanvas draw-loop effect', {
      mainPage,
      loaded,
      hasApiKey: !!apiKey,
      isCanvasPage: isCanvasPage(mainPage),
      hasCanvas: !!canvasRef.current,
    });
    if (!loaded || !apiKey || !isCanvasPage(mainPage)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    // Track last known dimensions to avoid unnecessary canvas clears during animation
    let lastW = -1;
    let lastH = -1;

    function syncSize() {
      const parent = canvas.parentElement;
      if (!parent) return false;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      const newW = Math.round(rect.width * dpr);
      const newH = Math.round(rect.height * dpr);

      // Skip if dimensions haven't changed — avoids clearing the canvas buffer
      if (newW === lastW && newH === lastH) return false;

      lastW = newW;
      lastH = newH;

      const page = activePageRef.current;
      const isOnward = page === 'onward';
      const isMap    = page === 'map';
      const visibleHeight = rect.height;
      const rowHeightPx = visibleHeight / VISIBLE_HOURS;

      if (isOnward) {
        const contentHeight = TOTAL_ROWS * rowHeightPx + 48;
        canvas.width  = newW;
        canvas.height = Math.round(contentHeight * dpr);
        canvas.style.width  = rect.width  + 'px';
        canvas.style.height = contentHeight + 'px';
      } else if (isMap) {
        // Map fills the available space (parent width minus waypoint padding)
        canvas.width  = newW;
        canvas.height = newH;
        canvas.style.width  = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
      } else {
        canvas.width  = newW;
        canvas.height = newH;
        canvas.style.width  = rect.width  + 'px';
        canvas.style.height = rect.height + 'px';
      }

      starsRef.current = Array.from({ length: 42 }, () => ({
        // NOSONAR: star-field values are purely visual (positions, size, opacity,
        // twinkle timing); no security implications, so Math.random is fine.
        x:    Math.random() * rect.width,
        y:    Math.random() * rect.height,
        s:    Math.random() * 1.4 + .25,
        base: Math.random() * .18 + .03,
        ts:   Math.random() * 1.2 + .3,
        to:   Math.random() * Math.PI * 2,
      }));

      return true;
    }

    // Initial size sync
    syncSize();
    const ctx = canvas.getContext('2d');

    const refs = {
      projectsRef, selectedIdRef, sunIdRef, panRef, draggingRef, activePageRef,
      onwardItemsRef, pendingDropRef, dragOverHourRef, onwardHitAreasRef,
      skillsRef, selectedSkillRef, skillsHitAreasRef,
      hoveredWeekRef, mapWeekRectsRef,
      pathsHitAreasRef,
      solarHitAreasRef, solarSunPosRef,
      emptyAlpha, starsRef, animT,
      resizeDragRef,
      onwardDragRef,
      goalHitAreasRef, topGoalsRef, goalDragRef,
    };

    function frame() {
      animT.current += .016;
      // Check for size changes once per frame instead of using ResizeObserver
      // This avoids clearing the canvas multiple times during CSS transitions
      syncSize();
      const t    = animT.current;
      const w    = canvas.width;
      const h    = canvas.height;
      const page = activePageRef.current;

      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = T.bg; ctx.fillRect(0,0,w,h);

      // Star field (all pages)
      starsRef.current.forEach(s => {
        const tw = .5 + .5 * Math.sin(t * s.ts + s.to);
        ctx.save(); ctx.beginPath();
        ctx.arc(s.x*dpr, s.y*dpr, s.s*dpr, 0, Math.PI*2);
        ctx.fillStyle = `rgba(214,226,245,${s.base*(.3+.7*tw)})`; ctx.fill(); ctx.restore();
      });

      if (page === 'onward') {
        const parent = canvas.parentElement;
        const viewH  = parent ? parent.clientHeight * dpr : h;
        const scrollY = parent ? parent.scrollTop * dpr : 0;
        drawOnwardPage(ctx, dpr, w, viewH, t, scrollY, refs);
      } else if (page === 'map') {
        drawMapPage(ctx, dpr, w, h, t, refs);
      } else if (page === 'paths') {
        drawPathsPage(ctx, dpr, w, h, t, refs);
      } else if (page === 'skills') {
        drawSkillsPage(ctx, dpr, w, h, t, refs);
      } else {
        drawGoalsPage(ctx, dpr, w, h, t, refs);
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [loaded, apiKey, mainPage]);

  // ── Canvas mouse handlers ─────────────────────────────────
  const onCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    nodeDragged.current  = false;
    mouseDownPos.current = { cx, cy, clientX: e.clientX, clientY: e.clientY };

    // Check for resize handle click on Onward page
    if (activePageRef.current === 'onward') {
      const hit = onwardHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
      if (hit && hit.id.startsWith('resize:')) {
        const itemId = hit.resizeItemId;
        const item = onwardItemsRef.current.find(it => it.id === itemId);
        if (item) {
          const parent = canvas.parentElement;
          const clientH = parent ? parent.clientHeight : DEFAULT_CLIENT_HEIGHT;
          const rowHcss = clientH / VISIBLE_HOURS;
          const minuteOffset = item.hour % 60;
          const minuteFrac = minuteOffset / 60;
          const itemTopY = PAD + (Math.floor(item.hour / 60) - ROW_START) * rowHcss + minuteFrac * rowHcss;
          const startDuration = item.duration || 60;
          setResizeDrag({ itemId, startY: cy, startDuration, hour: Math.floor(item.hour / 60), startMinute: item.hour % 60, itemTopY });
          return;
        }
      }

      // Check for onward card body drag (not resize handle, not confirm/cancel buttons)
      if (hit && !hit.id.startsWith('resize:') && !hit.id.startsWith('confirm') && !hit.id.startsWith('cancel')) {
        const itemId = hit.id;
        const item = onwardItemsRef.current.find(it => it.id === itemId);
        if (item) {
          const parent = canvas.parentElement;
          const clientH = parent ? parent.clientHeight : DEFAULT_CLIENT_HEIGHT;
          const rowHcss = clientH / VISIBLE_HOURS;
          const minuteOffset = item.hour % 60;
          const minuteFrac = minuteOffset / 60;
          const itemTopY = PAD + (Math.floor(item.hour / 60) - ROW_START) * rowHcss + minuteFrac * rowHcss;
          onwardDragRef.current = {
            itemId,
            startY: cy,
            startHour: item.hour,
            startDuration: item.duration || 60,
            offsetY: 0,
            itemTopY,
          };
          return;
        }
      }
    }

    if (activePageRef.current !== 'goals') return;

    const projs  = projectsRef.current;

    // Goals page: viewport is locked (no pan). Only goal nodes are draggable.
    // Use the same re-homed position resolver as drawGoalsPage so click/drag
    // detection matches exactly where goals are rendered on canvas.
    const axisXcss = rect.width / 2;
    const axisYcss = rect.height / 2;
    const clickedProj = projs.find((p) => {
      const pp = resolveGoalRenderPos(p, axisXcss, axisYcss);
      return Math.hypot(cx - pp.x, cy - pp.y) < 44;
    });

    if (clickedProj) {
      const pp = resolveGoalRenderPos(clickedProj, axisXcss, axisYcss);
      const d  = { type: 'node', id: clickedProj.id, ox: cx - pp.x, oy: cy - pp.y };
      draggingRef.current = d;
      setDragging(d);
    }
    // If no goal was clicked, do nothing — no pan on the goals page.
  };

  const onCanvasMouseMove = (e) => {
    // Map hover detection (does not need drag state)
    if (activePageRef.current === 'map') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const my   = e.clientY - rect.top;
      const rects = mapWeekRectsRef.current;
      let found = null;
      for (const wr of rects) {
        if (my >= wr.y && my < wr.y + wr.h) { found = wr.weekIdx; break; }
      }
      if (found !== hoveredWeekRef.current) {
        hoveredWeekRef.current = found;
        setHoveredWeek(found);
      }
      return;
    }
    // Handle resize drag on Onward page
    if (activePageRef.current === 'onward') {
      const rd = resizeDragRef.current;
      if (rd) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cy = e.clientY - rect.top;
        const dy = cy - rd.startY;
        const parent = canvas.parentElement;
        const clientH = parent ? parent.clientHeight : DEFAULT_CLIENT_HEIGHT;
        const rowHcss = clientH / VISIBLE_HOURS;
        // Convert pixel delta to minutes (1 hour = rowHcss pixels)
        const deltaMinutes = Math.round(dy / rowHcss * 60);
        // Clamp duration between 15 and 240 minutes
        const newDuration = Math.max(15, Math.min(240, rd.startDuration + deltaMinutes));
        setOnwardItems(prev => prev.map(it =>
          it.id === rd.itemId ? { ...it, duration: newDuration } : it
        ));
        return;
      }

      // Handle onward card body drag
      const od = onwardDragRef.current;
      if (od) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cy = e.clientY - rect.top;
        od.offsetY = cy - od.startY;
        return;
      }
    }
    if (activePageRef.current !== 'goals') return;

    const d = draggingRef.current;
    if (!d || d.type !== 'node') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    if (mouseDownPos.current) {
      const dist = Math.hypot(cx - mouseDownPos.current.cx, cy - mouseDownPos.current.cy);
      if (dist > 4) nodeDragged.current = true;
    }
    if (nodeDragged.current) {
      // Viewport is locked (no pan), so position is directly canvas-relative
      setProjects(prev => prev.map(p => p.id === d.id
        ? { ...p, pos: { x: cx - d.ox, y: cy - d.oy } }
        : p
      ));
    }
  };

  // Drag and drop handlers for subtask/checkpoint to time block
  const onCanvasDragOver = (e) => {
    if (activePageRef.current !== 'onward') return;
    e.preventDefault();
    const task = draggedTaskRef.current;
    if (!task) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cy = e.clientY - rect.top;
    // Calculate which hour row is being hovered (cy is absolute canvas CSS Y)
    const parent = canvas.parentElement;
    const clientH = parent ? parent.clientHeight : DEFAULT_CLIENT_HEIGHT;
    const rowHcss = clientH / VISIBLE_HOURS;
    const totalRows = ROW_END - ROW_START;
    const hi = Math.floor((cy - PAD) / rowHcss);
    if (hi >= 0 && hi < totalRows) {
      setDragOverHour(ROW_START + hi);
    }
  };
  const onCanvasDragLeave = () => {
    setDragOverHour(null);
  };
  const onCanvasDrop = (e) => {
    if (activePageRef.current !== 'onward') return;
    e.preventDefault();
    const task = draggedTaskRef.current;
    const hour = dragOverHourRef.current;
    if (task && hour !== null) {
      // Set pending drop - shows ghost block with confirm/cancel buttons
      setPendingDrop({ task, hour: hour * 60 }); // hour in minutes
    }
    setDragOverHour(null);
    setDraggedTask(null);
  };

  const onCanvasMouseUp = (e) => {
    const page = activePageRef.current;
    const md   = mouseDownPos.current;
    const wasClick = md && Math.hypot(e.clientX - md.clientX, e.clientY - md.clientY) < 5;

    // Clear resize drag state on mouse up — use ref, not state, since setResizeDrag is async
    if (resizeDragRef.current) {
      setResizeDrag(null);
    }

    // Commit onward card drag if active
    if (onwardDragRef.current) {
      const od = onwardDragRef.current;
      const parent = canvasRef.current?.parentElement;
      const clientH = parent ? parent.clientHeight : DEFAULT_CLIENT_HEIGHT;
      const rowHcss = clientH / VISIBLE_HOURS;

      // Calculate drop position
      const dropY = od.itemTopY + od.offsetY;
      const dropHourFrac = ROW_START + (dropY - PAD) / rowHcss;
      // Convert fractional hour to total minutes, clamp to valid range
      const newHour = Math.max(ROW_START * 60, Math.min(ROW_END * 60 - 15, Math.round(dropHourFrac * 60)));

      // Only update if position actually changed
      if (newHour !== od.startHour) {
        setOnwardItems(prev => prev.map(it =>
          it.id === od.itemId ? { ...it, hour: newHour } : it
        ));
      }

      onwardDragRef.current = null;
    }

    if (wasClick && page === 'onward') {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const hit = onwardHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
        if (hit) {
          // Handle confirm/cancel drop buttons
          if (hit.id === 'confirm-drop') {
            confirmPendingDrop();
            draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
            return;
          }
          if (hit.id === 'cancel-drop') {
            cancelPendingDrop();
            draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
            return;
          }
          // Regular task click
          const item = onwardItemsRef.current.find(it => it.id === hit.id);
          if (item) setOnwardClickedItem({ ...item, cardX: e.clientX, cardY: e.clientY });
        }
      }
      draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
      return;
    }

    if (wasClick && page === 'paths') {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const hit = pathsHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
        if (hit) setSelectedId(id => id === hit.id ? null : hit.id);
      }
      draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
      return;
    }

    if (wasClick && page === 'skills') {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const hit = skillsHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
        if (hit) {
          selectedSkillRef.current = hit.id;
          setSelectedSkillId(id => id === hit.id ? null : hit.id);
        }
      }
      draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
      return;
    }

    if (page === 'map') {
      draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
      return;
    }

    // Goals click logic
    if (wasClick) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cx   = e.clientX - rect.left;
        const cy   = e.clientY - rect.top;

        // Check sun click
        const sun = solarSunPosRef.current;
        if (sun.id && Math.hypot(cx - sun.x, cy - sun.y) < sun.R) {
          if (selectedIdRef.current === sun.id) {
            setSelectedId(null); closeWaypoint();
          } else {
            setSelectedId(sun.id); openWaypoint({ type: 'goal', id: sun.id });
          }
          draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
          return;
        }

        // Check goal planet clicks (from drawGoalsPage hit areas)
        const hitGoal = goalHitAreasRef.current.find(a => Math.hypot(cx - a.x, cy - a.y) < a.R);
        if (hitGoal) {
          if (selectedIdRef.current === hitGoal.id) {
            setSelectedId(null); closeWaypoint();
          } else {
            setSelectedId(hitGoal.id); openWaypoint({ type: 'goal', id: hitGoal.id });
          }
          draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
          return;
        }
      }
    }

    // ── Quadrant calculation on drop ──
    // If a goal was dragged (not a click), calculate its quadrant from final position.
    // During drag, onCanvasMouseMove already updates pos via setProjects, so we just
    // need to derive the quadrant from the current pos in state.
    if (activePageRef.current === 'goals' && !wasClick && draggingRef.current?.type === 'node') {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const axisX = rect.width / 2;
        const axisY = rect.height / 2;
        const draggedId = draggingRef.current.id;
        // Find the goal in the ref (most up-to-date position) and calculate quadrant
        const goal = projectsRef.current.find(p => p.id === draggedId);
        if (goal && goal.pos) {
          const quadrant = calculateQuadrant(goal.pos, axisX, axisY);
          if (quadrant !== goal.quadrant) {
            setProjects(prev => prev.map(p =>
              p.id === draggedId ? { ...p, quadrant } : p
            ));
          }
        }
      }
    }

    draggingRef.current  = null;
    mouseDownPos.current = null;
    setDragging(null);
  };

  return {
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onCanvasDragOver,
    onCanvasDragLeave,
    onCanvasDrop,
  };
}
