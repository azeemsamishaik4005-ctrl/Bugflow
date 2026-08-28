import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Plus, Search, Filter, Edit3, Trash2, ShieldAlert, Sparkles, Moon, Sun, LayoutGrid } from 'lucide-react';
import { DEFECT_COMPONENTS } from '../constants';

export default function Dashboard({ issues, stats, componentStats, projects, onRefresh, onRequestReportIssue, onEditIssue, onDeleteIssue, token, theme, toggleTheme }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = !searchTerm || 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (issue.description && issue.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !statusFilter || issue.status === statusFilter;
    const matchesPriority = !priorityFilter || issue.priority === priorityFilter;
    const matchesComponent = !componentFilter || issue.component === componentFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesComponent;
  });

  const handleStatusChange = async (issueId, newStatus) => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            System Dashboard
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Real-time software telemetry, issue tracking, and resolution metrics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={toggleTheme} className="btn-secondary" title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{ padding: '10px' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={onRequestReportIssue} className="btn-primary">
            <Sparkles size={18} />
            Report Issue
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '36px'
      }}>
        {/* Total Issues Card */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Total Issues
            </span>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-light)'
            }}>
              <AlertCircle size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {stats.total || 0}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
            Across all active projects
          </span>
        </div>

        {/* Critical Bugs Card */}
        <div className="glass-card" style={{ padding: '22px', borderLeft: '4px solid #EF4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Critical Bugs
            </span>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F87171'
            }}>
              <AlertTriangle size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F87171' }}>
            {stats.critical || 0}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#F87171', marginTop: '4px', display: 'inline-block' }}>
            Requires immediate resolution
          </span>
        </div>

        {/* In Progress Card */}
        <div className="glass-card" style={{ padding: '22px', borderLeft: '4px solid #3B82F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              In Progress
            </span>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}>
              <Clock size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38BDF8' }}>
            {stats.inProgress || 0}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
            Currently under active work
          </span>
        </div>

        {/* Resolved Card */}
        <div className="glass-card" style={{ padding: '22px', borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Resolved Issues
            </span>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4ADE80'
            }}>
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#4ADE80' }}>
            {stats.resolved || 0}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#4ADE80', marginTop: '4px', display: 'inline-block' }}>
            Successfully closed
          </span>
        </div>
      </div>

      {/* Defects by Component Chart */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <LayoutGrid size={20} color="var(--primary-light)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Defects by Component</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {componentStats && Object.keys(componentStats).length > 0 ? (
            (() => {
              const maxVal = Math.max(...Object.values(componentStats), 1);
              return Object.entries(componentStats).map(([comp, count]) => {
                const percentage = (count / maxVal) * 100;
                return (
                  <div key={comp} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '160px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>
                      {comp}
                    </div>
                    <div style={{ flex: 1, height: '10px', background: 'var(--btn-secondary-bg)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--primary-violet) 0%, var(--primary-light) 100%)',
                        borderRadius: '6px',
                        transition: 'width 0.5s ease-out'
                      }}></div>
                    </div>
                    <div style={{ width: '30px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {count}
                    </div>
                  </div>
                );
              });
            })()
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>No component data available</div>
          )}
        </div>
      </div>

      {/* Table Filter Control Bar */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '42px' }}
                placeholder="Search issues by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              className="input-field"
              style={{ width: '160px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Retest/Verify">Retest/Verify</option>
              <option value="Closed">Closed</option>
            </select>

            <select
              className="input-field"
              style={{ width: '150px' }}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="P1">P1 (Urgent)</option>
              <option value="P2">P2 (High)</option>
              <option value="P3">P3 (Normal)</option>
            </select>
            
            <select
              className="input-field"
              style={{ width: '180px' }}
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
            >
              <option value="">All Components</option>
              {DEFECT_COMPONENTS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Recent Issues Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Recent Issues</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing {filteredIssues.length} items</span>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>ID</th>
                <th style={{ width: '100px' }}>Type</th>
                <th>Title & Description</th>
                <th style={{ width: '100px' }}>Priority</th>
                <th style={{ width: '110px' }}>Severity</th>
                <th style={{ width: '140px' }}>Status</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No issues found matching criteria. Click <strong>Report Issue</strong> to create one.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr key={issue.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary-light)', fontWeight: 700 }}>
                      #{issue.id}
                    </td>
                    <td>
                      <span className={`badge ${issue.type === 'Feature' ? 'badge-p3' : 'badge-p1'}`}>
                        {issue.type || 'Bug'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {issue.title}
                        {issue.component && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--primary-glow)', color: 'var(--primary-light)', borderRadius: '4px', fontWeight: 600 }}>
                            {issue.component}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        maxWidth: '450px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {issue.description}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${(issue.priority || 'p2').toLowerCase()}`}>
                        {issue.priority || 'P2'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${(issue.severity || 'major').toLowerCase()}`}>
                        {issue.severity || 'Major'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={issue.status}
                        onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                        className="input-field"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.8rem',
                          height: 'auto',
                          background: issue.status === 'Resolved' || issue.status === 'Closed' ? 'rgba(16, 185, 129, 0.15)' :
                                      issue.status === 'In Progress' || issue.status === 'Retest/Verify' ? 'rgba(59, 130, 246, 0.15)' :
                                      'rgba(139, 92, 246, 0.15)',
                          color: issue.status === 'Resolved' || issue.status === 'Closed' ? '#4ADE80' :
                                 issue.status === 'In Progress' || issue.status === 'Retest/Verify' ? '#38BDF8' :
                                 'var(--primary-light)',
                          borderColor: 'transparent',
                          fontWeight: 700
                        }}
                      >
                        <option value="Open" style={{ background: 'var(--bg-modal)', color: 'var(--text-main)' }}>Open</option>
                        <option value="In Progress" style={{ background: 'var(--bg-modal)', color: 'var(--text-main)' }}>In Progress</option>
                        <option value="Resolved" style={{ background: 'var(--bg-modal)', color: 'var(--text-main)' }}>Resolved</option>
                        <option value="Retest/Verify" style={{ background: 'var(--bg-modal)', color: 'var(--text-main)' }}>Retest/Verify</option>
                        <option value="Closed" style={{ background: 'var(--bg-modal)', color: 'var(--text-main)' }}>Closed</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => onEditIssue(issue)}
                          title="Edit Issue"
                          style={{
                            background: 'var(--btn-secondary-bg)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                            padding: '6px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => onDeleteIssue(issue.id)}
                          title="Delete Issue"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#F87171',
                            padding: '6px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
