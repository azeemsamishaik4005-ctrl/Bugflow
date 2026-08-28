import React, { useState } from 'react';
import { Plus, Calendar, Activity, Edit3, Trash2, Play, CheckCircle2, Sun, Moon } from 'lucide-react';

export default function SprintPlanning({ sprints = [], projects = [], issues = [], token, onRefresh, theme, toggleTheme }) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(projects.length > 0 ? projects[0].id : '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  const [editingSprint, setEditingSprint] = useState(null);

  const handleCreateOrUpdateSprint = async (e) => {
    e.preventDefault();
    if (!name || !projectId) {
      setError('Name and Project are required');
      return;
    }
    setCreating(true);
    setError('');

    try {
      const isUpdate = !!editingSprint;
      const url = isUpdate ? `/api/sprints/${editingSprint.id}` : '/api/sprints';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, name, start_date: startDate, end_date: endDate })
      });
      if (res.ok) {
        setName('');
        setStartDate('');
        setEndDate('');
        setEditingSprint(null);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${isUpdate ? 'update' : 'create'} sprint`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (sprint) => {
    setEditingSprint(sprint);
    setName(sprint.name);
    setProjectId(sprint.project_id);
    setStartDate(sprint.start_date ? sprint.start_date.split('T')[0] : '');
    setEndDate(sprint.end_date ? sprint.end_date.split('T')[0] : '');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sprint? Issues will be moved to backlog.')) return;
    try {
      const res = await fetch(`/api/sprints/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/sprints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const calculateProgress = (sprintId) => {
    const sprintIssues = issues.filter(i => i.sprint_id === sprintId);
    const total = sprintIssues.length;
    if (total === 0) return { total: 0, open: 0, inProgress: 0, resolved: 0, percent: 0 };
    
    const resolved = sprintIssues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
    const inProgress = sprintIssues.filter(i => i.status === 'In Progress' || i.status === 'Retest/Verify' || i.status === 'In Review').length;
    const open = total - resolved - inProgress;
    const percent = Math.round((resolved / total) * 100);
    
    return { total, open, inProgress, resolved, percent };
  };

  return (
    <div style={{ padding: '32px' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>Sprint Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Organize your backlog into manageable chunks of work.</p>
        </div>
        
        <button onClick={toggleTheme} className="btn-secondary" title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{ padding: '10px' }}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {error && <div style={{ color: '#F87171', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {editingSprint ? 'Edit Sprint' : 'Create Sprint'}
            </h2>
            {editingSprint && (
              <button onClick={() => { setEditingSprint(null); setName(''); setStartDate(''); setEndDate(''); }} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
            )}
          </div>
          <form onSubmit={handleCreateOrUpdateSprint} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Name</label>
              <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required placeholder="Sprint 1" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Project</label>
              <select className="input-field" value={projectId} onChange={e => setProjectId(e.target.value)} required>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Start Date</label>
              <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>End Date</label>
              <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Saving...' : (editingSprint ? 'Update Sprint' : <><Plus size={16} /> Create Sprint</>)}
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sprints.map(sprint => {
            const progress = calculateProgress(sprint.id);
            return (
              <div key={sprint.id} style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{sprint.name}</h3>
                      <span style={{ fontSize: '0.85rem', color: sprint.status === 'Completed' ? '#4ADE80' : sprint.status === 'Planned' ? 'var(--text-muted)' : 'var(--primary-light)', background: sprint.status === 'Completed' ? 'rgba(74, 222, 128, 0.1)' : sprint.status === 'Planned' ? 'rgba(156, 163, 175, 0.1)' : 'rgba(168, 85, 247, 0.1)', padding: '4px 12px', borderRadius: '20px' }}>
                        {sprint.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : 'TBD'} - {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : 'TBD'}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {sprint.status !== 'Completed' && sprint.status !== 'Active' && (
                      <button onClick={() => handleUpdateStatus(sprint.id, 'Active')} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}><Play size={14}/> Start</button>
                    )}
                    {sprint.status === 'Active' && (
                      <button onClick={() => handleUpdateStatus(sprint.id, 'Completed')} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#10B981' }}><CheckCircle2 size={14}/> Complete</button>
                    )}
                    <button onClick={() => handleEdit(sprint)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Edit3 size={16}/></button>
                    <button onClick={() => handleDelete(sprint.id)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#F87171', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={16}/></button>
                  </div>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <span>Progress: {progress.percent}%</span>
                    <span>{progress.total} Issues ({progress.resolved} Resolved, {progress.inProgress} In Progress, {progress.open} Open)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--btn-secondary-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress.percent}%`, height: '100%', background: 'var(--primary-light)', transition: 'width 0.3s' }}></div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '8px' }}>Issues in this Sprint:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {issues.filter(i => i.sprint_id === sprint.id).length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>No issues assigned yet. Use the issue editor to assign issues.</div>
                    ) : (
                      issues.filter(i => i.sprint_id === sprint.id).map(issue => (
                        <div key={issue.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-main)' }}>{issue.title}</span>
                          <span style={{ color: issue.status === 'Resolved' || issue.status === 'Closed' ? '#4ADE80' : 'var(--text-muted)' }}>{issue.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {sprints.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-subtle)' }}>
              <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>No sprints created yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

