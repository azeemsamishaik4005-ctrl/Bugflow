import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, LayoutGrid, List as ListIcon, Clock, Plus, Bug, Sparkles, AlertCircle, AlertTriangle, MessageSquare, CheckCircle2, Sun, Moon
} from 'lucide-react';
import { DEFECT_COMPONENTS } from '../constants';

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'P1': return '#EF4444';
    case 'P2': return '#F59E0B';
    case 'P3': return '#3B82F6';
    default: return 'var(--text-muted)';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Open': return '#3B82F6';
    case 'In Progress': return '#F59E0B';
    case 'Resolved': return '#10B981';
    case 'Closed': return 'var(--text-subtle)';
    default: return 'var(--text-muted)';
  }
};

export default function IssuesView({ issues, projects, onRequestReportIssue, onEditIssue, token, theme, toggleTheme }) {
  const [viewMode, setViewMode] = useState(localStorage.getItem('defectx_issues_view') || localStorage.getItem('bugflow_issues_view') || 'grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [sortBy, setSortBy] = useState('recently_updated'); // recently_updated, newest, priority, status

  // Milestone 4: Semantic Search State
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticResults, setSemanticResults] = useState(null);
  const [semanticLoading, setSemanticLoading] = useState(false);

  // Toggle View
  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('defectx_issues_view', mode);
  };

  // Debounced Semantic Search
  React.useEffect(() => {
    if (!semanticMode || !searchTerm.trim() || searchTerm.trim().length < 2) {
      setSemanticResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSemanticLoading(true);
      try {
        const res = await fetch('/api/ai/semantic-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ query: searchTerm, limit: 30 })
        });
        if (res.ok) {
          const data = await res.json();
          setSemanticResults(data.results || []);
        }
      } catch (err) {
        console.error('Semantic search failed', err);
      } finally {
        setSemanticLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchTerm, semanticMode, token]);

  // Filter & Sort Issues
  const filteredAndSortedIssues = useMemo(() => {
    let baseList = issues;

    // When semantic mode is on and we have results, use semantic ranking
    if (semanticMode && semanticResults && searchTerm.trim().length >= 2) {
      const semMap = new Map(semanticResults.map(s => [s.id, s]));
      baseList = semanticResults.map(s => {
        const original = issues.find(i => i.id === s.id);
        return {
          ...(original || {}),
          ...s,
          similarity: s.similarity,
          matched_terms: s.matched_terms
        };
      });
    }

    let result = baseList.filter(issue => {
      // If in semantic mode with results, search filter is already handled by vector engine
      const matchesSearch = (semanticMode && semanticResults) ? true : (!searchTerm || 
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (issue.description && issue.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        `DEF-${issue.id}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `ISS-${issue.id}`.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = !statusFilter || issue.status === statusFilter;
      const matchesPriority = !priorityFilter || issue.priority === priorityFilter;
      const matchesComponent = !componentFilter || issue.component === componentFilter;
      const issueHealth = typeof issue.health_indicator === 'object' && issue.health_indicator !== null
        ? (issue.health_indicator.status || issue.health_indicator.label || 'Healthy')
        : (issue.health_indicator || 'Healthy');
      const matchesHealth = !healthFilter || issueHealth === healthFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesComponent && matchesHealth;
    });

    if (!semanticMode || !semanticResults) {
      result.sort((a, b) => {
        if (sortBy === 'recently_updated') {
          const dateA = new Date(a.updated_at || a.created_at);
          const dateB = new Date(b.updated_at || b.created_at);
          return dateB - dateA;
        }
        if (sortBy === 'newest') {
          return new Date(b.created_at) - new Date(a.created_at);
        }
        if (sortBy === 'priority') {
          const priorityOrder = { 'P1': 1, 'P2': 2, 'P3': 3 };
          return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
        }
        if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        return 0;
      });
    }

    return result;
  }, [issues, searchTerm, statusFilter, priorityFilter, componentFilter, healthFilter, sortBy, semanticMode, semanticResults]);

  const getTimeAgo = (dateString) => {
    const diff = Math.floor((new Date() - new Date(dateString)) / 60000); // minutes
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* File Manager Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              Issues
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Browse and manage reported software defects
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px' }}>
              <button 
                onClick={() => toggleViewMode('grid')} 
                style={{ 
                  background: viewMode === 'grid' ? 'var(--primary-glow)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => toggleViewMode('list')} 
                style={{ 
                  background: viewMode === 'list' ? 'var(--primary-glow)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}
                title="List View"
              >
                <ListIcon size={18} />
              </button>
            </div>
            
            <button onClick={toggleTheme} className="btn-secondary" title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{ padding: '10px' }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={onRequestReportIssue} className="btn-primary">
              <Plus size={18} />
              Report Issue
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Filters, Sorting */}
        <div style={{ 
          display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '16px', 
          background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)',
          alignItems: 'center'
        }}>
          
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder={semanticMode ? "Semantic Search: e.g., login token expiration..." : "Search issues by ID, title, or keyword..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '38px', margin: 0, height: '38px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setSemanticMode(!semanticMode)}
            className="btn-secondary"
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: semanticMode ? 'var(--primary-glow)' : undefined,
              color: semanticMode ? 'var(--primary-light)' : 'var(--text-muted)',
              borderColor: semanticMode ? 'var(--primary-light)' : undefined,
              fontWeight: semanticMode ? 700 : 500
            }}
            title="Enable TF-IDF Vector & Technical Synonym Search across all defects"
          >
            <Sparkles size={15} color={semanticMode ? 'var(--primary-light)' : 'var(--text-muted)'} />
            AI Semantic Search
          </button>

          <select className="input-field" style={{ width: 'auto', height: '38px', margin: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          <select className="input-field" style={{ width: 'auto', height: '38px', margin: 0 }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="P1">P1 (Urgent)</option>
            <option value="P2">P2 (High)</option>
            <option value="P3">P3 (Normal)</option>
          </select>

          <select className="input-field" style={{ width: 'auto', height: '38px', margin: 0 }} value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}>
            <option value="">All Health</option>
            <option value="Healthy">Healthy</option>
            <option value="Attention Needed">Attention Needed</option>
            <option value="At Risk">At Risk</option>
            <option value="Critical Overdue">Critical Overdue</option>
          </select>

          <select className="input-field" style={{ width: 'auto', height: '38px', margin: 0 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recently_updated">Sort: Recently Updated</option>
            <option value="newest">Sort: Newest First</option>
            <option value="priority">Sort: Highest Priority</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>

        {semanticMode && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '8px',
            padding: '8px 14px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--primary-light)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} /> AI Semantic Matching active: TF-IDF indexing & technical synonym expansion.
            </span>
            {semanticLoading && <span>Searching conceptual similarity...</span>}
            {semanticResults && <span>Found {semanticResults.length} conceptually matched defect{semanticResults.length === 1 ? '' : 's'}</span>}
          </div>
        )}
      </div>

      {/* Issues Content Area */}
      <div style={{ flex: 1 }}>
        {filteredAndSortedIssues.length === 0 ? (
          <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            padding: '80px 20px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' 
          }}>
            <Bug size={64} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '8px' }}>No Issues Found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', textAlign: 'center' }}>
              {issues.length === 0 
                ? "Start by reporting your first software defect." 
                : "There are no reported issues matching your current filters."}
            </p>
            {issues.length === 0 ? (
              <button onClick={onRequestReportIssue} className="btn-primary"><Plus size={16}/> Report Issue</button>
            ) : (
              <button onClick={() => { setSearchTerm(''); setStatusFilter(''); setPriorityFilter(''); setComponentFilter(''); setHealthFilter(''); setSemanticMode(false); }} className="btn-secondary">
                Clear Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px',
            alignItems: 'start'
          }}>
            {filteredAndSortedIssues.map(issue => (
              <div 
                key={issue.id}
                className="issue-card-hover"
                onClick={() => onEditIssue(issue)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* File Icon Area */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', borderBottom: '1px solid var(--btn-secondary-bg)' }}>
                  {issue.type === 'Feature' ? <Sparkles size={48} color="#10B981" opacity={0.8} /> : <Bug size={48} color="var(--primary-light)" opacity={0.8} />}
                </div>

                {/* Meta */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', background: 'var(--border-hover)', color: 'var(--text-main)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        DEF-{issue.id}
                      </span>
                      {issue.similarity !== undefined && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: 'var(--primary-light)', fontWeight: 700 }}>
                          {Math.round(issue.similarity * 100)}% Match
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span title="Discussions" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <MessageSquare size={12} /> {issue.discussion_count || 0}
                      </span>
                    </div>
                  </div>
                  
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', lineHeight: '1.3' }}>
                    {issue.title}
                  </h3>
                  
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {issue.description}
                  </p>
                </div>

                {/* Footer Badges */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                      color: getPriorityColor(issue.priority)
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getPriorityColor(issue.priority) }}></span>
                      {issue.priority}
                    </span>
                    
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                      color: getStatusColor(issue.status)
                    }}>
                      ● {issue.status}
                    </span>
                  </div>

                  {/* Health Indicator Pill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {(() => {
                      const healthObj = issue.health_indicator;
                      const health = typeof healthObj === 'object' && healthObj !== null
                        ? (healthObj.status || healthObj.label || 'Healthy')
                        : (healthObj || 'Healthy');
                      const color = 
                        health === 'Critical Overdue' ? '#EF4444' :
                        health === 'At Risk' ? '#F97316' :
                        health === 'Attention Needed' ? '#F59E0B' : '#10B981';
                      return (
                        <span style={{ fontSize: '0.72rem', color: color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}></span>
                          {health}
                        </span>
                      );
                    })()}

                    {issue.component && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', background: 'rgba(255,255,255,0.03)', padding: '1px 6px', borderRadius: '4px' }}>
                        {issue.component}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      👤 {issue.assignee_name?.split(' ')[0] || 'Unassigned'}
                    </span>
                    <span>Updated {getTimeAgo(issue.updated_at || issue.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>ID</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Title</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Health</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Priority</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Assignee</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Updated</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>💬</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedIssues.map(issue => (
                  <tr 
                    key={issue.id} 
                    onClick={() => onEditIssue(issue)}
                    style={{ borderBottom: '1px solid var(--btn-secondary-bg)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--btn-secondary-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      DEF-{issue.id}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {issue.type === 'Feature' ? <Sparkles size={14} color="#10B981" /> : <Bug size={14} color="var(--primary-light)" />}
                        <span>{issue.title}</span>
                        {issue.similarity !== undefined && (
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: 'var(--primary-light)', fontWeight: 700 }}>
                            {Math.round(issue.similarity * 100)}% Match
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {(() => {
                        const healthObj = issue.health_indicator;
                        const health = typeof healthObj === 'object' && healthObj !== null
                          ? (healthObj.status || healthObj.label || 'Healthy')
                          : (healthObj || 'Healthy');
                        const color = 
                          health === 'Critical Overdue' ? '#EF4444' :
                          health === 'At Risk' ? '#F97316' :
                          health === 'Attention Needed' ? '#F59E0B' : '#10B981';
                        const bg = 
                          health === 'Critical Overdue' ? 'rgba(239, 68, 68, 0.15)' :
                          health === 'At Risk' ? 'rgba(249, 115, 22, 0.15)' :
                          health === 'Attention Needed' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                        return (
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: bg, color: color, fontWeight: 700 }}>
                            {health}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600,
                        background: `${getStatusColor(issue.status)}20`, color: getStatusColor(issue.status)
                      }}>
                        {issue.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                        color: getPriorityColor(issue.priority)
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getPriorityColor(issue.priority) }}></span>
                        {issue.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{issue.assignee_name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{getTimeAgo(issue.updated_at || issue.created_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>{issue.discussion_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .issue-card-hover:hover {
          transform: translateY(-2px) scale(1.01);
          border-color: var(--primary-light) !important;
          box-shadow: 0 4px 20px var(--primary-glow);
        }
      `}} />
    </div>
  );
}
