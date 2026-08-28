import React, { useState } from 'react';
import { FolderKanban, Plus, Layers, User, Calendar, Sun, Moon } from 'lucide-react';

export default function ProjectsView({ projects, onRefresh, token, theme, toggleTheme }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      setName('');
      setDescription('');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Projects Workspace</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Organize software modules and assign issue tracking pipelines.
          </p>
        </div>
        
        <button onClick={toggleTheme} className="btn-secondary" title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{ padding: '10px' }}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Create Project Card */}
        <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>
            New Project
          </h3>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '10px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleCreateProject}>
            <div className="form-group">
              <label>Project Name *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Auth Gateway Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Description</label>
              <textarea
                className="input-field"
                rows={4}
                placeholder="Brief summary of project scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button type="submit" disabled={creating} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={18} />
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>

        {/* Projects List Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {projects.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
              No projects created yet. Use the form on the left to add one!
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(124, 58, 237, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary-light)'
                    }}>
                      <FolderKanban size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{project.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{project.id}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} color="var(--primary-light)" />
                    <span><strong>{project.issue_count || 0}</strong> Issues</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} color="#60A5FA" />
                    <span>{project.owner_name || 'Admin'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
