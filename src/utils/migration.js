/**
 * Migration utilities for the Goals → Paths taxonomy upgrade.
 *
 * Introduces `category: 'short' | 'long' | 'open'` and `pathIds: string[]`
 * on goal records, deprecating the legacy `scale` field. Fully idempotent —
 * safe to run on every app load.
 *
 * Taxonomy:
 *   - 'short': deadline expected within ~2 weeks
 *   - 'long':  deadline in months/years (includes former Path-mirrored goals)
 *   - 'open':  no deadline needed; `deadline` MUST be null, defaults to Q2
 */

const normalize = (s) => (s || '').toString().toLowerCase().trim();

/**
 * Best-effort title matching between a goal and the paths store.
 * A strong match is when one normalized title contains the other,
 * with a minimum length guard to avoid trivial collisions.
 *
 * @param {string} goalTitle
 * @param {Array}  paths - Paths store (meridian_projects)
 * @returns {string|null} Matched path id, or null
 */
export function matchPathByTitle(goalTitle, paths) {
  const g = normalize(goalTitle);
  if (!g || !Array.isArray(paths)) return null;
  for (const p of paths) {
    const pt = normalize(p.title);
    if (!pt) continue;
    if (g.length >= 4 && pt.length >= 4 && (g.includes(pt) || pt.includes(g))) {
      return p.id;
    }
  }
  return null;
}

/**
 * Derive a goal's `category` from legacy fields.
 * Preserves an existing valid `category`; otherwise maps from `scale`,
 * falling back to deadline presence when scale is missing.
 *
 * @param {{ category?: string, scale?: string, deadline?: string|null }} goal
 * @returns {'short'|'long'|'open'}
 */
export function inferCategory(goal) {
  if (goal.category && ['short', 'long', 'open'].includes(goal.category)) {
    return goal.category;
  }
  switch (goal.scale) {
    case 'short':
      return 'short';
    case 'medium':
    case 'long':
      return 'long';
    default: {
      // No scale — fall back to deadline presence
      if (goal.deadline) return 'long';
      return 'open';
    }
  }
}

/**
 * Idempotent migration: assigns `category`, backfills `pathIds`, and
 * removes the deprecated `scale` field on every goal.
 *
 * Invariants enforced:
 *   - `category` is one of 'short' | 'long' | 'open'
 *   - `pathIds` is an array (existing links preserved)
 *   - `category === 'open'` ⇒ `deadline === null`
 *
 * @param {Array} projects - Goals store (meridian_projects_v2)
 * @param {Array} paths    - Paths store (meridian_projects)
 * @returns {Array} New projects array with `category` + `pathIds`
 */
export function migrateGoalCategories(projects, paths = []) {
  return (projects || []).map((goal) => {
    const category = inferCategory(goal);

    let pathIds = Array.isArray(goal.pathIds) ? goal.pathIds : [];
    if (!pathIds.length) {
      const matched = matchPathByTitle(goal.title, paths);
      if (matched) pathIds = [matched];
    }

    // Open goals never carry a deadline
    const deadline = category === 'open' ? null : goal.deadline || null;

    const next = { ...goal, category, pathIds, deadline };
    if ('scale' in next) delete next.scale;
    return next;
  });
}
