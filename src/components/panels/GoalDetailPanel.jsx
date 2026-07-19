import React from 'react';
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
  if (!proj) return null;
  const pct = progress(proj);
  const hasSubtasks = (proj.subtasks?.length || 0) > 0 || (proj.checkpoints?.length || 0) > 0;

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
        {proj.subtasks.length > 0 && (
          <>
            <div className="wsh">
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke={T.muted} strokeWidth="1.2"/><path d="M3 5l1.5 1.5 3-3" fill="none" stroke={T.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>
              Subtasks
            </div>
            {proj.subtasks.map(st => (
              <div key={st.id} className="wti">
                <div className={`wck${st.done ? ' done' : ''}`} onClick={() => toggleSubtask(proj.id, st.id)}>
                  {st.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" fill="none" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className={`wtx${st.done ? ' dn' : ''}`}>{st.title}</div>
                <button className="w-del" onClick={() => deleteSubtask(proj.id, st.id)}>×</button>
              </div>
            ))}
          </>
        )}
        {proj.checkpoints.length > 0 && (
          <>
            <div className="wsh" style={{ marginTop: proj.subtasks.length ? 10 : 0 }}>
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="none" stroke={T.blue} strokeWidth="1.2" transform="rotate(45 5 5)"/></svg>
              <span style={{ color: T.blue }}>Checkpoints</span>
              {/* Checkpoint info tooltip */}
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
                title="Checkpoints mark stages of a project where it's natural to take a break. Place them between groups of subtasks to track progress at major milestones."
              >ⓘ</span>
            </div>
            {proj.checkpoints.map(cp => (
              <div key={cp.id} className="wti">
                <div className={`wdm${cp.done ? ' done' : ''}`} onClick={() => toggleCheckpoint(proj.id, cp.id)}>
                  {cp.done && <svg width="7" height="7" viewBox="0 0 7 7" style={{ transform:'rotate(-45deg)' }}><path d="M1 3.5l1.8 1.8 3.5-3.5" fill="none" stroke={T.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className="wtx">{cp.title}</div>
                <button className="w-del" onClick={() => deleteCheckpoint(proj.id, cp.id)}>×</button>
              </div>
            ))}
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
            onKeyDown={e => e.key === 'Enter' && addSubtask()}
          />
        </div>
        <div style={{ display:'flex', gap:5, marginTop:5 }}>
          <button className="w-add-btn" onClick={addSubtask} disabled={!addInput.trim()}>+ Task</button>
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
        {/* Organize button — shown when goal has subtasks/checkpoints */}
        {hasSubtasks && onOrganize && (
          <button
            onClick={onOrganize}
            style={{
              marginTop:12,
              width:'100%',
              padding:'10px 12px',
              borderRadius:8,
              border:'none',
              color:'#fff',
              fontFamily:"'Syne',sans-serif",
              fontSize:12,
              fontWeight:700,
              cursor:'pointer',
              letterSpacing:'0.08em',
              position:'relative',
              overflow:'hidden',
              background: `linear-gradient(
                to bottom,
                rgba(247,113,113,0.55) 0%,
                rgba(247,113,113,0.55) 33.33%,
                rgba(240,180,41,0.55) 33.33%,
                rgba(240,180,41,0.55) 66.66%,
                rgba(83,170,255,0.55) 66.66%,
                rgba(83,170,255,0.55) 100%
              )`,
              boxShadow: '0 2px 8px rgba(255,107,53,0.3)',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
              transition:'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(255,107,53,0.45)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,107,53,0.3)';
            }}
          >✦ ORGANIZE TASKS ✦</button>
        )}
      </div>
    </>
  );
}
