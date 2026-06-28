import { T } from './theme.js';

export function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

export function rgba(hex, a) {
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawGlow(ctx, x, y, R, color, alpha) {
  const {r,g,b} = hexToRgb(color);
  const gr = ctx.createRadialGradient(x,y,0,x,y,R*3.2);
  gr.addColorStop(0,  `rgba(${r},${g},${b},${alpha})`);
  gr.addColorStop(.4, `rgba(${r},${g},${b},${alpha*.35})`);
  gr.addColorStop(1,  `rgba(${r},${g},${b},0)`);
  ctx.save(); ctx.beginPath(); ctx.arc(x,y,R*3.2,0,Math.PI*2);
  ctx.fillStyle=gr; ctx.fill(); ctx.restore();
}

export function drawProgressArc(ctx, x, y, R, pct, color, dpr) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,R,-Math.PI/2,Math.PI*3/2);
  ctx.strokeStyle=rgba(color,.18); ctx.lineWidth=3*dpr; ctx.stroke();
  if (pct > 0) {
    ctx.beginPath(); ctx.arc(x,y,R,-Math.PI/2,-Math.PI/2+(Math.PI*2)*pct);
    ctx.strokeStyle=color; ctx.lineWidth=3*dpr; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();
}

export function drawSubtaskNode(ctx, x, y, R, color, done, dpr) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2);
  ctx.fillStyle = done ? rgba(color,.22) : T.card; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2);
  ctx.strokeStyle = done ? color : rgba(color,.42);
  ctx.lineWidth = done ? 1.5*dpr : 1*dpr;
  if (!done) ctx.setLineDash([3*dpr,3*dpr]);
  ctx.stroke(); ctx.setLineDash([]);
  if (done) {
    ctx.beginPath();
    ctx.moveTo(x-4*dpr,y); ctx.lineTo(x-1*dpr,y+3*dpr); ctx.lineTo(x+5*dpr,y-3*dpr);
    ctx.strokeStyle=color; ctx.lineWidth=1.5*dpr; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();
}

export function drawCheckpointNode(ctx, x, y, sz, color, done, dpr) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
  ctx.beginPath(); ctx.rect(-sz/2,-sz/2,sz,sz);
  ctx.fillStyle = done ? rgba(color,.2) : T.card; ctx.fill();
  ctx.strokeStyle = done ? color : rgba(color,.45);
  ctx.lineWidth = 1.5*dpr; ctx.stroke();
  ctx.restore();
  if (done) {
    ctx.save(); ctx.beginPath();
    ctx.moveTo(x-3*dpr,y); ctx.lineTo(x-1*dpr,y+2*dpr); ctx.lineTo(x+4*dpr,y-3*dpr);
    ctx.strokeStyle=color; ctx.lineWidth=1.5*dpr; ctx.lineCap='round'; ctx.stroke(); ctx.restore();
  }
}

/**
 * Draw the Eisenhower Matrix quadrant background fills, axes, and labels.
 *
 * Drawing order:
 *   1. Quadrant background tints (subtle per-quadrant color)
 *   2. Axis lines (solid, prominent)
 *   3. Axis labels ("URGENCY →" on X-axis, "IMPORTANCE →" on Y-axis)
 *   4. Quadrant header labels (top-left of each quadrant)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} dpr - Device pixel ratio
 * @param {number} w - Canvas width (CSS pixels)
 * @param {number} h - Canvas height (CSS pixels)
 * @param {object} quadrants - Quadrant config object (QUADRANTS from helpers.js)
 * @param {number} axisX - X-coordinate of the vertical divider
 * @param {number} axisY - Y-coordinate of the horizontal divider
 */
export function drawMatrixAxes(ctx, dpr, w, h, quadrants, axisX, axisY) {
  // ── 1. Quadrant background tints ──
  // axisX, axisY, w, h are all in physical (dpr-scaled) pixels — no * dpr needed
  const quadConfigs = [
    { q: quadrants.q1, x: axisX, y: 0,       w: w - axisX, h: axisY },
    { q: quadrants.q2, x: 0,      y: 0,       w: axisX,     h: axisY },
    { q: quadrants.q3, x: axisX,  y: axisY,   w: w - axisX, h: h - axisY },
    { q: quadrants.q4, x: 0,      y: axisY,   w: axisX,     h: h - axisY },
  ];

  for (const { q, x, y, w: qw, h: qh } of quadConfigs) {
    ctx.save();
    ctx.fillStyle = rgba(q.color, 0.03);
    ctx.fillRect(x, y, qw, qh);
    ctx.restore();
  }

  // ── 2. Axis lines ──
  ctx.save();
  ctx.strokeStyle = 'rgba(214,226,245,0.15)';
  ctx.lineWidth = 1.5 * dpr;

  // Vertical axis (urgency divider)
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, h);
  ctx.stroke();

  // Horizontal axis (importance divider)
  ctx.beginPath();
  ctx.moveTo(0, axisY);
  ctx.lineTo(w, axisY);
  ctx.stroke();
  ctx.restore();

  // ── 3. Axis labels ──
  const labelFont = `600 ${9 * dpr}px 'IBM Plex Mono',monospace`;
  const labelColor = 'rgba(214,226,245,0.12)';

  // X-axis: "URGENCY →" at the right edge, just above the horizontal axis line
  ctx.save();
  ctx.font = labelFont;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('URGENCY →', w - 12 * dpr, axisY - 6 * dpr);
  ctx.restore();

  // Y-axis: "IMPORTANCE →" rotated, positioned further down so the full word is visible
  ctx.save();
  ctx.translate(axisX - 6 * dpr, 80 * dpr);
  ctx.rotate(-Math.PI / 2);
  ctx.font = labelFont;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('IMPORTANCE →', 0, 0);
  ctx.restore();

  // ── 4. Quadrant header labels ──
  // Offsets (16px) are in CSS pixels, multiply by dpr to convert to physical
  const headerConfigs = [
    { q: quadrants.q1, x: axisX + 16 * dpr, y: 16 * dpr },
    { q: quadrants.q2, x: 16 * dpr,         y: 16 * dpr },
    { q: quadrants.q3, x: axisX + 16 * dpr, y: axisY + 16 * dpr },
    { q: quadrants.q4, x: 16 * dpr,         y: axisY + 16 * dpr },
  ];

  for (const { q, x, y } of headerConfigs) {
    drawQuadrantLabel(ctx, dpr, q.title, q.subtitle, q.color, x, y);
  }
}

/**
 * Draw a single quadrant header label (title + subtitle).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} dpr
 * @param {string} title - Quadrant title (e.g. "DO FIRST")
 * @param {string} subtitle - Quadrant subtitle (e.g. "Urgent + Important")
 * @param {string} color - Quadrant accent color
 * @param {number} x - X position (physical/dpr-scaled pixels)
 * @param {number} y - Y position (physical/dpr-scaled pixels)
 */
export function drawQuadrantLabel(ctx, dpr, title, subtitle, color, x, y) {
  // x, y are already in physical (dpr-scaled) pixels — no * dpr needed
  // Title — increased opacity and font size for readability
  ctx.save();
  ctx.font = `700 ${14 * dpr}px 'Syne',sans-serif`;
  ctx.fillStyle = rgba(color, 0.75);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, x, y);
  ctx.restore();

  // Subtitle
  ctx.save();
  ctx.font = `${8 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.fillStyle = rgba(color, 0.75);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(subtitle, x, y + 18 * dpr);
  ctx.restore();
}

export function rrect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  } else {
    const rad = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rad, y);
    ctx.lineTo(x+w-rad, y);  ctx.quadraticCurveTo(x+w, y,   x+w, y+rad);
    ctx.lineTo(x+w, y+h-rad); ctx.quadraticCurveTo(x+w, y+h, x+w-rad, y+h);
    ctx.lineTo(x+rad, y+h);  ctx.quadraticCurveTo(x,   y+h, x,   y+h-rad);
    ctx.lineTo(x, y+rad);    ctx.quadraticCurveTo(x,   y,   x+rad, y);
    ctx.closePath();
  }
}
