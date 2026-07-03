import { useState, useEffect } from 'react';
import { PROJECT_COLORS } from '../../constants/colors';
import { uid, quadrantCenter } from '../../utils/helpers.js';

function AddMilestoneInline({ projectId, onAdd, color }) {
  const [value, setValue] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onAdd(projectId, value); setValue(''); }}}
        placeholder="Add milestone..."
        style={{ flex: 1, background: '#121820', border: '1px solid #1b2336', borderRadius: 6, padding: '7px 12px', color: '#d6e2f5', fontFamily: 'IBM Plex Mono', fontSize: 13, outline: 'none' }}
      />
      <button onClick={() => { if (value.trim()) { onAdd(projectId, value); setValue(''); } }}
              style={{ background: 'transparent', border: `1px solid ${color}`, borderRadius: 6, color, padding: '7px 14px', fontFamily: 'IBM Plex Mono', fontSize: 13, cursor: 'pointer' }}>
        +
      </button>
    </div>
  );
}

export default function PathsView({ setGoalsProjects, goalsProjects, onNavigateToGoals }) {
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meridian_projects') || '[]'); }
    catch { return []; }
  });
  const [expandedId, setExpandedId] = useState(null);
  const [showModal,  setShowModal]  = useState(false);

  const [title,           setTitle]           = useState('');
  const [desc,            setDesc]            = useState('');
  const [color,           setColor]           = useState('#53aaff');
  const [newMilestone,    setNewMilestone]    = useState('');
  const [draftMilestones, setDraftMilestones] = useState([]);

  useEffect(() => {
    localStorage.setItem('meridian_projects', JSON.stringify(projects));
  }, [projects]);

  // ── Sync subtasks from goals back to Paths milestones ──
  // Whenever goalsProjects changes, update the local projects' milestones
  // to reflect any subtask changes made in the goals page.
  useEffect(() => {
    if (!goalsProjects || !goalsProjects.length) return;
    setProjects(prev => prev.map(p => {
      const matchingGoal = goalsProjects.find(g => g.id === p.id);
      if (!matchingGoal) return p;
      // Map goal subtasks to milestones (preserving existing milestone IDs where possible)
      const syncedMilestones = matchingGoal.subtasks.map(st => {
        const existing = p.milestones.find(m => m.title === st.title);
        return {
          id: existing?.id || uid(),
          title: st.title,
          completed: st.done,
          date: existing?.date || null,
        };
      });
      return { ...p, milestones: syncedMilestones };
    }));
  }, [goalsProjects]);

  function createProject() {
    if (!title.trim()) return;
    const project = {
      id: Date.now(), title: title.trim(), description: desc.trim(),
      color, status: 'active', createdAt: new Date().toISOString(), milestones: draftMilestones,
    };
    setProjects(prev => [project, ...prev]);
    setExpandedId(project.id);
    setTitle(''); setDesc(''); setColor('#53aaff'); setDraftMilestones([]); setNewMilestone(''); setShowModal(false);
  }

  function toggleMilestone(projectId, milestoneId) {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated = p.milestones.map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
      const allDone = updated.every(m => m.completed);
      return { ...p, milestones: updated, status: allDone ? 'completed' : p.status === 'completed' ? 'active' : p.status };
    }));
  }

  function addMilestone(projectId, title) {
    if (!title.trim()) return;
    setProjects(prev => prev.map(p =>
      p.id !== projectId ? p : { ...p, milestones: [...p.milestones, { id: Date.now(), title: title.trim(), completed: false, date: null }] }
    ));
  }

  function addToGoals(project) {
    if (!setGoalsProjects) return;

    // Check if this project already exists as a goal
    const existingGoal = goalsProjects?.find(g => g.id === project.id);
    if (existingGoal) {
      // Already added — just navigate to goals page
      if (onNavigateToGoals) onNavigateToGoals(project.id);
      return;
    }

    // Create a new goal from this project
    const mirroredGoal = {
      id: project.id,
      color: project.color,
      pos: quadrantCenter('q2', 600, 400),
      quadrant: 'q2',
      title: project.title,
      desc: project.description || '',
      measurable: '',
      achievable: '',
      relevant: '',
      deadline: '',
      priority: 'low',
      scale: 'medium',
      inFocus: false,
      completedAt: null,
      subtasks: project.milestones.map(m => ({
        id: uid(),
        title: m.title,
        done: m.completed || false,
        skill: null,
      })),
      checkpoints: [],
    };
    setGoalsProjects(prev => [mirroredGoal, ...prev]);

    // Navigate to goals page with this goal selected
    if (onNavigateToGoals) onNavigateToGoals(project.id);
  }

  function getProgress(project) {
    if (!project.milestones.length) return 0;
    return project.milestones.filter(m => m.completed).length / project.milestones.length;
  }

  const inputStyle = {
    width: '100%', background: '#121820', border: '1px solid #1b2336', borderRadius: 8,
    padding: '10px 14px', color: '#d6e2f5', fontFamily: 'IBM Plex Mono', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', marginBottom: 14,
  };

  return (
    <div style={{ padding: 30, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <button onClick={() => setShowModal(true)} style={{ background: 'transparent', border: '1px solid #f0b429', borderRadius: 8, color: '#f0b429', padding: '9px 18px', fontFamily: 'IBM Plex Mono', fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
          + New Project
        </button>
      </div>

      {projects.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 100, color: '#56687f', fontFamily: 'IBM Plex Mono', fontSize: 14 }}>
          No projects yet. Start one.
        </div>
      )}

      {projects.map(project => {
        const isExpanded = expandedId === project.id;
        const progress   = getProgress(project);
        const done       = project.milestones.filter(m => m.completed).length;
        const isInGoals  = goalsProjects?.some(g => g.id === project.id);

        return (
          <div key={project.id} style={{ background: '#0d1017', border: `1px solid ${isExpanded ? project.color + '55' : '#1b2336'}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>

            <div onClick={() => setExpandedId(isExpanded ? null : project.id)}
                 style={{ padding: '18px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'Syne', fontSize: 17, color: '#d6e2f5', fontWeight: 600 }}>{project.title}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: `1px solid ${project.color}44`, color: project.status === 'completed' ? '#3ecf7e' : project.status === 'paused' ? '#56687f' : project.color }}>
                    {project.status.toUpperCase()}
                  </span>
                  {isInGoals && (
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#53aaff22', color: '#53aaff', border: '1px solid #53aaff44' }}>
                      IN GOALS
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: '#1b2336', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: project.color, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#56687f', whiteSpace: 'nowrap' }}>
                    {done}/{project.milestones.length} milestones
                  </span>
                </div>
              </div>
              <span style={{ color: '#56687f', fontSize: 12, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </div>

            {isExpanded && (
              <div style={{ padding: '0 22px 22px', borderTop: '1px solid #1b2336' }}>
                {project.description && (
                  <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#56687f', margin: '14px 0 20px' }}>{project.description}</p>
                )}

                <div style={{ marginTop: 14, position: 'relative' }}>
                  {project.milestones.length > 1 && (
                    <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 1, background: '#1b2336' }} />
                  )}
                  {project.milestones.map(m => (
                    <div key={m.id} onClick={() => toggleMilestone(project.id, m.id)}
                         style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14, cursor: 'pointer', position: 'relative' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: m.completed ? project.color : 'transparent', border: `2px solid ${m.completed ? project.color : '#1b2336'}`, transition: 'all 0.2s', zIndex: 1 }} />
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: m.completed ? '#56687f' : '#d6e2f5', textDecoration: m.completed ? 'line-through' : 'none' }}>
                        {m.title}
                      </span>
                    </div>
                  ))}
                </div>

                <AddMilestoneInline projectId={project.id} onAdd={addMilestone} color={project.color} />

                <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
                  {['active', 'paused', 'completed'].map(s => (
                    <button key={s} onClick={() => setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: s } : p))}
                            style={{ background: project.status === s ? project.color + '22' : 'transparent', border: `1px solid ${project.status === s ? project.color : '#1b2336'}`, borderRadius: 5, color: project.status === s ? project.color : '#56687f', padding: '4px 12px', fontFamily: 'IBM Plex Mono', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); addToGoals(project); }}
                    style={{
                      background: isInGoals ? '#53aaff22' : 'transparent',
                      border: `1px solid ${isInGoals ? '#53aaff' : '#53aaff66'}`,
                      borderRadius: 5,
                      color: isInGoals ? '#53aaff' : '#53aaffcc',
                      padding: '4px 12px',
                      fontFamily: 'IBM Plex Mono',
                      fontSize: 11,
                      cursor: 'pointer',
                      letterSpacing: 1,
                    }}
                  >
                    {isInGoals ? 'Open in Goals →' : '+ Add to Goals'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#0d1017', border: '1px solid #1b2336', borderRadius: 14, padding: 34, width: 520 }}>
            <h3 style={{ fontFamily: 'Syne', color: '#f0b429', margin: '0 0 22px', fontSize: 20 }}>New Project</h3>

            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#56687f', display: 'block', marginBottom: 5 }}>NAME</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Personal Portfolio" />

            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#56687f', display: 'block', marginBottom: 5 }}>DESCRIPTION (optional)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ ...inputStyle, height: 72, resize: 'none' }} />

            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#56687f', display: 'block', marginBottom: 10 }}>COLOR</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {PROJECT_COLORS.map(c => (
                <div key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid white' : '2px solid transparent', boxSizing: 'border-box' }} />
              ))}
            </div>

            <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#56687f', display: 'block', marginBottom: 5 }}>MILESTONES</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter' && newMilestone.trim()) { setDraftMilestones(prev => [...prev, { id: Date.now(), title: newMilestone.trim(), completed: false, date: null }]); setNewMilestone(''); }}}
                     placeholder="Type milestone, press Enter" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
            </div>
            {draftMilestones.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#d6e2f5' }}>
                <span style={{ color: '#56687f' }}>{i + 1}.</span>
                {m.title}
                <span onClick={() => setDraftMilestones(prev => prev.filter(x => x.id !== m.id))}
                      style={{ marginLeft: 'auto', color: '#f77171', cursor: 'pointer' }}>✕</span>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => { setShowModal(false); setTitle(''); setDesc(''); setColor('#53aaff'); setDraftMilestones([]); setNewMilestone(''); }}
                      style={{ flex: 1, background: 'transparent', border: '1px solid #1b2336', borderRadius: 8, color: '#56687f', padding: '11px 0', fontFamily: 'IBM Plex Mono', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={createProject}
                      style={{ flex: 2, background: '#f0b429', border: 'none', borderRadius: 8, color: '#07090f', padding: '11px 0', fontFamily: 'IBM Plex Mono', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
