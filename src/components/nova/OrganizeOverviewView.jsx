import React, { useState, useCallback, useMemo } from 'react';
import { T } from '../../utils/theme.js';
import { QUADRANTS } from '../../utils/helpers.js';

const ORGANIZE_COLOR = '#ff6b35';

/**
 * OrganizeOverviewView — the Organize program's non-chat display.
 *
 * Shows a read-only snapshot of the current data (goals, paths, gaps, today,
 * momentum) compiled from the Blackboard, plus a button that triggers a
 * one-shot NOVA analysis. NOVA's proposal renders as a card with Confirm/Cancel
 * (agency guard): the user must explicitly approve before any mutation runs.
 *
 * There is NO chat input and NO conversation history.
 */
export default function OrganizeOverviewView({
  blackboard,
  novaState,
  apiKey,
  runOrganizeAnalysis,
  novaLoading,
  onNewGoal,
  createGoalWithPaths,
  linkGoalToPath,
  mergePaths,
  pathsStore,
  setPathsStore,
  addSyncEvent,
  onBack,
  T: theme,
}) {
  const t = theme || T;
  const [dismissed, setDismissed] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [error, setError] = useState(null);

  const bb = blackboard || {};
  const analysis = novaState?.organizeAnalysis || null;

  const pathTitleById = useMemo(() => {
    const map = {};
    (pathsStore || []).forEach(p => { map[p.id] = p.title; });
    return map;
  }, [pathsStore]);

  const findGoalIdByTitle = useCallback((title) => {
    if (!title) return null;
    const norm = title.trim().toLowerCase();
    // blackboard goals carry `id` — match by title across them
    return (bb.activeGoals || []).find(g => g.title?.trim().toLowerCase() === norm)?.id || null;
  }, [bb.activeGoals]);

  const describeAction = useCallback((action) => {
    switch (action?.type) {
      case 'create-goal': {
        const cat = action.category ? ` (${action.category})` : '';
        const link = action.pathId ? ` — linked to path "${pathTitleById[action.pathId] || action.pathId}"` : '';
        return `Create goal "${action.goalTitle}"${cat}${link}`;
      }
      case 'link-goal': {
        const pathName = action.pathId ? (pathTitleById[action.pathId] || action.pathId) : 'a path';
        return `Link "${action.goalTitle}" to path "${pathName}"`;
      }
      case 'merge-paths': {
        const names = (action.pathIds || []).map(id => pathTitleById[id] || id);
        return `Merge paths: ${names.join(' + ')}`;
      }
      case 'create-path':
        return `Create new path "${action.goalTitle}"`;
      default:
        return null;
    }
  }, [pathTitleById]);

  const handleAnalyze = async () => {
    if (novaLoading || !apiKey) return;
    setError(null);
    setDismissed(false);
    setExecuted(false);
    try {
      await runOrganizeAnalysis();
    } catch (e) {
      setError(e?.message || 'Analysis failed. Please try again.');
    }
  };

  const handleConfirm = useCallback(async () => {
    if (!analysis?.action || executed) return;
    const action = analysis.action;
    setExecuted(true);
    try {
      switch (action.type) {
        case 'create-goal': {
          const pathIds = action.pathId ? [action.pathId] : [];
          const goalData = {
            title: action.goalTitle,
            category: action.category || 'short',
            deadline: action.category === 'open' ? null : '',
          };
          if (createGoalWithPaths) {
            createGoalWithPaths(goalData, pathIds);
          } else if (onNewGoal) {
            onNewGoal();
          }
          addSyncEvent?.('organize_action', `create-goal: ${action.goalTitle}`);
          break;
        }
        case 'link-goal': {
          const goalId = findGoalIdByTitle(action.goalTitle);
          if (goalId && action.pathId && linkGoalToPath) {
            linkGoalToPath(goalId, action.pathId);
            addSyncEvent?.('organize_action', `link-goal: ${action.goalTitle} → ${action.pathId}`);
          } else {
            setExecuted(false);
            setError('Could not find the goal to link. It may have been renamed.');
            return;
          }
          break;
        }
        case 'merge-paths': {
          if (action.pathIds && action.pathIds.length >= 2 && mergePaths) {
            mergePaths(action.pathIds[0], action.pathIds[1]);
            addSyncEvent?.('organize_action', `merge-paths: ${action.pathIds[0]} + ${action.pathIds[1]}`);
          } else {
            setExecuted(false);
            setError('Could not merge paths — invalid path ids.');
            return;
          }
          break;
        }
        case 'create-path': {
          if (setPathsStore) {
            setPathsStore(prev => [{
              id: Date.now(),
              title: action.goalTitle,
              description: '',
              color: '#53aaff',
              status: 'active',
              createdAt: new Date().toISOString(),
              milestones: [],
            }, ...prev]);
            addSyncEvent?.('organize_action', `create-path: ${action.goalTitle}`);
          } else {
            setExecuted(false);
            setError('Could not create the path.');
            return;
          }
          break;
        }
        default:
          setExecuted(false);
          return;
      }
    } catch (e) {
      setExecuted(false);
      setError(e?.message || 'Action execution failed.');
    }
  }, [analysis, executed, createGoalWithPaths, onNewGoal, addSyncEvent, findGoalIdByTitle, linkGoalToPath, mergePaths, setPathsStore]);

  // ── Snapshot sections ──
  const activeGoals = bb.activeGoals || [];
  const paths = bb.paths || [];
  const gaps = bb.gaps || [];
  const quadrantDist = bb.quadrantDistribution || { q1: 0, q2: 0, q3: 0, q4: 0 };

  const sectionTitle = (text) => (
    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color: ORGANIZE_COLOR, letterSpacing:'.08em', marginBottom:8 }}>
      {text}
    </div>
  );

  const chip = (label, color = t.muted) => (
    <span style={{
      fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color,
      background:`${color}18`, border:`1px solid ${color}40`,
      borderRadius:4, padding:'2px 6px', whiteSpace:'nowrap',
    }}>{label}</span>
  );

  return (
    <div style={{
      position:'absolute', inset:0, background:t.bg, zIndex:10,
      display:'flex', flexDirection:'column', overflowY:'auto',
    }}>
      {/* ── Header ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', borderBottom:`1px solid ${t.border}`,
        position:'sticky', top:0, background:t.bg, zIndex:2,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:ORGANIZE_COLOR, letterSpacing:'.06em' }}>
            ⟐ ORGANIZE
          </span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:t.muted }}>
            current snapshot
          </span>
        </div>
        <button
          onClick={onBack}
          style={{
            background:'none', border:`1px solid ${t.border}`, borderRadius:6,
            color:t.muted, cursor:'pointer', fontSize:10, padding:'4px 10px',
            fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'.05em',
          }}
        >← BACK</button>
      </div>

      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:18 }}>
        {/* ── Momentum strip ── */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {chip(`Streak ${bb.currentStreak || 0}d`, t.accent)}
          {chip(`Done today ${bb.todayCompletedCount || 0}`, t.green)}
          {chip(`Focused ${bb.todayFocusedMinutes || 0}min`, t.cyan)}
          {Object.entries(quadrantDist).filter(([, c]) => c > 0).map(([q, c]) => (
            <span key={q} style={{
              fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
              color: QUADRANTS[q]?.color || t.muted,
              background:`${QUADRANTS[q]?.color || t.muted}18`,
              border:`1px solid ${QUADRANTS[q]?.color || t.muted}40`,
              borderRadius:4, padding:'2px 6px', whiteSpace:'nowrap',
            }}>{q.toUpperCase()} {c}</span>
          ))}
        </div>

        {/* ── Goals ── */}
        <div>
          {sectionTitle(`GOALS — ${activeGoals.length}`)}
          {activeGoals.length === 0 ? (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.muted }}>No active goals.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {activeGoals.map(g => (
                <div key={g.id} style={{
                  background:t.card, border:`1px solid ${t.border}`, borderRadius:8,
                  padding:'8px 10px', display:'flex', flexDirection:'column', gap:5,
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:t.text, fontWeight:600 }}>{g.title}</span>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:t.muted }}>{g.progress || 0}%</span>
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                    {g.category && chip(g.category, ORGANIZE_COLOR)}
                    {g.quadrant && chip(g.quadrant.toUpperCase(), QUADRANTS[g.quadrant]?.color || t.blue)}
                    {g.daysUntilDeadline !== null && g.daysUntilDeadline !== undefined
                      ? chip(g.daysUntilDeadline < 0 ? 'overdue' : `${g.daysUntilDeadline}d`, g.daysUntilDeadline < 7 ? t.rose : t.muted)
                      : g.deadline ? chip('no deadline', t.muted) : chip('open', t.muted)}
                    {(g.pathIds || []).length > 0
                      ? g.pathIds.map(pid => chip(`⛭ ${pathTitleById[pid] || pid}`, t.blue))
                      : chip('orphan', t.rose)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Paths ── */}
        <div>
          {sectionTitle(`PATHS — ${paths.length}`)}
          {paths.length === 0 ? (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.muted }}>No paths yet.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {paths.map(p => (
                <div key={p.id} style={{
                  background:t.card, border:`1px solid ${t.border}`, borderRadius:8,
                  padding:'8px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <span style={{
                      width:8, height:8, borderRadius:'50%', background: p.status === 'active' ? t.green : t.muted, flexShrink:0,
                    }} />
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:t.text }}>{p.title}</span>
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                    {chip(`${p.completedMilestones || 0}/${p.milestoneCount || 0} milestones`, t.cyan)}
                    {(p.linkedGoalIds || []).length > 0 && chip(`${p.linkedGoalIds.length} goals`, t.blue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Gaps ── */}
        <div>
          {sectionTitle(`GAPS — ${gaps.length}`)}
          {gaps.length === 0 ? (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.muted }}>No gaps — everything is connected.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {gaps.map((gap, i) => (
                <div key={i} style={{
                  background:`${ORGANIZE_COLOR}0a`, border:`1px solid ${ORGANIZE_COLOR}40`, borderRadius:8,
                  padding:'8px 10px', display:'flex', flexDirection:'column', gap:4,
                }}>
                  {gap.type === 'unlinked-path' ? (
                    <>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.text }}>
                        Path "{gap.pathTitle}" has unlinked milestones:
                      </span>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {(gap.unlinkedMilestones || []).map(m => chip(m.title, t.rose))}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.text }}>
                      Goal "{gap.goalTitle}" ({gap.category || 'open'}) is not linked to any path.
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Analyze ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
          <button
            onClick={handleAnalyze}
            disabled={novaLoading || !apiKey}
            style={{
              background: novaLoading || !apiKey ? t.border : `${ORGANIZE_COLOR}18`,
              border:`1px solid ${novaLoading || !apiKey ? t.border : ORGANIZE_COLOR}60`,
              borderRadius:8, color: novaLoading || !apiKey ? t.muted : ORGANIZE_COLOR,
              cursor: novaLoading || !apiKey ? 'default' : 'pointer',
              padding:'8px 12px', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700,
              letterSpacing:'.05em',
            }}
          >
            {novaLoading ? 'NOVA IS ANALYZING…' : apiKey ? '⟐ RUN NOVA ANALYSIS' : 'SET API KEY TO ANALYZE'}
          </button>
          {!apiKey && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:t.muted }}>
              Add your API key in Settings to let NOVA propose actions for your approval.
            </div>
          )}
        </div>

        {/* ── Proposal card (agency guard) ── */}
        {analysis && !dismissed && (
          <div style={{
            background:`${ORGANIZE_COLOR}0d`, border:`1px solid ${ORGANIZE_COLOR}55`,
            borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8,
          }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:ORGANIZE_COLOR, letterSpacing:'.08em' }}>
              NOVA PROPOSES
            </div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:t.text, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
              {analysis.content}
            </div>
            {analysis.action && (
              <div style={{
                background:t.bg, border:`1px solid ${t.border}`, borderRadius:6,
                padding:'6px 8px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.accent,
              }}>
                {executed ? '✓ Applied' : `→ ${describeAction(analysis.action)}`}
              </div>
            )}
            {(analysis.options || []).length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {analysis.options.map((opt, i) => (
                  <div key={i} style={{
                    fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:t.muted,
                    background:t.bg, border:`1px solid ${t.border}`, borderRadius:4, padding:'4px 6px',
                  }}>• {opt}</div>
                ))}
              </div>
            )}
            {error && (
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:t.rose }}>⚠ {error}</div>
            )}
            {!executed && (
              <div style={{ display:'flex', gap:6 }}>
                <button
                  onClick={handleConfirm}
                  disabled={!analysis.action || novaLoading}
                  style={{
                    background:`${t.green}18`, border:`1px solid ${t.green}50`, borderRadius:6,
                    color:t.green, cursor:'pointer', padding:'6px 12px',
                    fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:'.05em',
                  }}
                >✓ CONFIRM</button>
                <button
                  onClick={() => setDismissed(true)}
                  disabled={novaLoading}
                  style={{
                    background:'none', border:`1px solid ${t.border}`, borderRadius:6,
                    color:t.muted, cursor:'pointer', padding:'6px 12px',
                    fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:'.05em',
                  }}
                >✕ DISMISS</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
