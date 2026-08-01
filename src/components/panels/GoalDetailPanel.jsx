import React, { useState } from 'react';
import { T } from '../../utils/theme.js';
import { progress } from '../../utils/helpers.js';

export default function GoalDetailPanel({
  proj,
  renamingGoalId, renameValue, setRenamingGoalId, setRenameValue,
  addInput, setAddInput,
  toggleSubtask, toggleCheckpoint, deleteSubtask, deleteCheckpoint,
  addSubtask, addCheckpoint, completeGoal, renameGoal,
  closeWaypoint, setConfirmDelete,
  topGoals, onToggleTopGoal,
  onOrganize,
}) {
  const [expandedCPs, setExpandedCPs] = useState(() => new Set());
  const [activeCP, setActiveCP] = useState(null); // which checkpoint the add input targets

  if (!proj) return null;
  const pct = progress(proj);

  const toggleExpanded = (cpId) => {
    setExpandedCPs(prev => {
      const next = new Set(prev);
      if (next.has(cpId)) next.delete(cpId);
      else next.add(cpId);
      return next;
    });
  };

  // Derived helper: auto-compute checkpoint done state from nested subtasks
  const cpDone = (cp) => cp.subtasks && cp.subtasks.length > 0 && cp.subtasks.every(s => s.done);

  return (
    <>
      <div className="wp-accent" style={{ background: proj.color }} />
      <div className="wp-hd">
        <button className="wp-close" onClick={closeWaypoint}>×</button>
        <div className="wp-badge">
          <span style={{ width:5, height:5, borderRadius:'50%', background:proj.color, display:'inline-block' }} />
          <span style={{ color: proj.color }}>Goal</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {renamingGoalId === proj.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => { renameGoal(proj.id, renameValue); setRenamingGoalId(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { renameGoal(proj.id, renameValue); setRenamingGoalId(null); }
                if (e.key === 'Escape') setRenamingGoalId(null);
              }}
              style={{ flex:1, background:'transparent', border:'none', borderBottom:`1px solid ${proj.color}`, color:proj.color, fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, outline:'none', padding:'2px 0', width:'100%' }}
            />
          ) : (
            <div className="wp-ttl" style={{ color: proj.color, flex:1 }}>{proj.title}</div>
          )}
          <button
            title="Rename goal"
            onClick={() => { setRenamingGoalId(proj.id); setRenameValue(proj.title); }}
            style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:12, padding:'2px 4px', flexShrink:0, lineHeight:1 }}
          >✎</button>
          <button
            title="Delete goal"
            onClick={() => setConfirmDelete(proj.id)}
            style={{ background:'none', border:'none', color:T.rose, cursor:'pointer', fontSize:14, padding:'2px 4px', flexShrink:0, lineHeight:1, opacity:.7 }}
          >🗑</button>
        </div>
        {proj.desc && <div className="wp-dsc">{proj.desc}</div>}
      </div>
      <div className="wp-pg">
        <div className="wp-pgr">
          <span>Progress</span>
          <span style={{ fontSize:12, fontWeight:700, color: proj.color }}>{pct}%</span>
        </div>
        <div className="wp-pgtr">
          <div className="wp-pgf" style={{ width:`${pct}%`, background: proj.color }} />
        </div>
      </div>
      <div className="wp-bdy">
        {/* ── Checkpoints (collapsible containers with nested subtasks) ── */}
        {proj.checkpoints.length > 0 && (
          <>
            <div className="wsh">
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="none" stroke={T.blue} strokeWidth="1.2" transform="rotate(45 5 5)"/></svg>
              <span style={{ color: T.blue }}>Checkpoints</span>
              <span
                style={{
                  position:'relative',
                  display:'inline-flex',
                  alignItems:'center',
                  justifyContent:'center',
                  marginLeft:4,
                  width:14,
                  height:14,
                  borderRadius:'50%',
                  background:`${T.blue}20`,
                  color:T.blue,
                  fontSize:8,
                  fontWeight:700,
                  cursor:'help',
                  fontFamily:"'IBM Plex Mono',monospace",
                  lineHeight:1,
                }}
                title="Checkpoints are sub-goals that group subtasks. Complete all subtasks in a checkpoint to mark it done."
              >ⓘ</span>
            </div>
            {proj.checkpoints.map(cp => {
              const isExpanded = expandedCPs.has(cp.id);
              const isDone = cp.done || cpDone(cp);
              const cpSubs = cp.subtasks || [];
              const doneCount = cpSubs.filter(s => s.done).length;
              return (
                <div key={cp.id} style={{ marginBottom:4 }}>
                  {/* Checkpoint header row */}
                  <div
                    className="wti"
                    style={{ cursor:'pointer', userSelect:'none' }}
                    onClick={() => toggleExpanded(cp.id)}
                  >
                    <div
                      className={`wdm${isDone ? ' done' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleCheckpoint(proj.id, cp.id); }}
                    >
                      {isDone && <svg width="7" height="7" viewBox="0 0 7 7" style={{ transform:'rotate(-45deg)' }}><path d="M1 3.5l1.8 1.8 3.5-3.5" fill="none" stroke={T.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="wtx" style={{ flex:1, color: isDone ? T.green : T.blue, fontWeight:600 }}>
                      {cp.title}
                    </div>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, marginRight:4 }}>
                      {cpSubs.length > 0 ? `${doneCount}/${cpSubs.length}` : ''}
                    </span>
                    <button
                      className="w-del"
                      onClick={(e) => { e.stopPropagation(); deleteCheckpoint(proj.id, cp.id); }}
                      style={{ fontSize:10 }}
                    >×</button>
                    <span style={{ fontSize:8, color:T.muted, marginLeft:2, transition:'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  </div>

                  {/* Expanded: show nested subtasks */}
                  {isExpanded && (
                    <div style={{ marginLeft:16, borderLeft:`1px solid ${T.border}`, paddingLeft:8 }}>
                      {cpSubs.map(st => (
                        <div key={st.id} className="wti" style={{ marginBottom:2 }}>
                          <div className={`wck${st.done ? ' done' : ''}`} onClick={() => toggleSubtask(proj.id, st.id, cp.id)}>
                            {st.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" fill="none" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div className={`wtx${st.done ? ' dn' : ''}`}>{st.title}</div>
                          <button className="w-del" onClick={() => deleteSubtask(proj.id, st.id, cp.id)}>×</button>
                        </div>
                      ))}
                      {/* Add subtask inline to this checkpoint */}
                      {activeCP === cp.id ? (
                        <div style={{ display:'flex', gap:4, marginTop:4, marginBottom:4 }}>
                          <input
                            className="w-add-inp"
                            style={{ flex:1, fontSize:10, padding:'3px 6px' }}
                            placeholder="Add subtask..."
                            value={addInput}
                            onChange={e => setAddInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { addSubtask(cp.id); setActiveCP(null); }
                              if (e.key === 'Escape') setActiveCP(null);
                            }}
                            autoFocus
                          />
                          <button
                            className="w-add-btn"
                            style={{ fontSize:9, padding:'3px 8px' }}
                            onClick={() => { addSubtask(cp.id); setActiveCP(null); }}
                            disabled={!addInput.trim()}
                          >+</button>
                        </div>
                      ) : (
                        <div
                          style={{ padding:'3px 8px', fontSize:9, color:T.muted, cursor:'pointer' }}
                          onClick={() => { setActiveCP(cp.id); setAddInput(''); }}
                        >+ Add subtask</div>
                      )}
                    </div>
                  )}
                  {/* Collapsed: show a compact summary */}
                  {!isExpanded && cpSubs.length > 0 && (
                    <div style={{ marginLeft:28, fontSize:8, color:T.muted, lineHeight:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>
                      {cpSubs.map(s => s.title).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

      </div>
      <div className="wp-ftr">
        <div className="w-add-row">
          <input
            className="w-add-inp"
            placeholder="Add subtask or checkpoint..."
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                // Add to first checkpoint if available, otherwise add as top-level (fallback for goals with no CPs)
                const firstCp = proj.checkpoints?.[0];
                addSubtask(firstCp?.id);
              }
            }}
          />
        </div>
        <div style={{ display:'flex', gap:5, marginTop:5 }}>
          <button className="w-add-btn" onClick={() => { const firstCp = proj.checkpoints?.[0]; addSubtask(firstCp?.id); }} disabled={!addInput.trim()}>+ Task</button>
          <button className="w-add-btn" onClick={addCheckpoint} disabled={!addInput.trim()}>◆ CP</button>
        </div>
        {pct === 100 && !proj.completedAt && (
          <button
            onClick={() => completeGoal(proj.id)}
            style={{ marginTop:10, width:'100%', background:`${T.green}12`, border:`1px solid ${T.green}40`, borderRadius:6, padding:'7px', color:T.green, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.05em' }}
          >✓ Mark Complete</button>
        )}
        {!topGoals.includes(proj.id) && (
          <button
            onClick={() => onToggleTopGoal(proj.id)}
            style={{ marginTop:10, width:'100%', background:`${T.accent}12`, border:`1px solid ${T.accent}35`, borderRadius:6, padding:'7px', color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.05em' }}
          >◎ Mark as Top Goal</button>
        )}
        {topGoals.includes(proj.id) && (
          <div style={{ marginTop:10, textAlign:'center', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.accent, opacity:.7 }}>
            ★ Top Goal · <span style={{ cursor:'pointer', textDecoration:'underline' }} onClick={() => onToggleTopGoal(proj.id)}>Remove</span>
          </div>
        )}
      </div>
    </>
  );
}
