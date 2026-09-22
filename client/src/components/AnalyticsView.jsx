import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Clock, AlertCircle, AlertTriangle, CheckCircle2, 
  Users, RefreshCw, Filter, Layers, Sun, Moon, Sparkles, FolderKanban, ShieldAlert,
  Network, GitBranch, Cpu, Compass, Activity, ArrowUpRight, ArrowDownRight, Minus,
  FolderTree, Zap, Target
} from 'lucide-react';

export default function AnalyticsView({ token, theme, toggleTheme }) {
  const [timeRange, setTimeRange] = useState('30d');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Milestone 4: Advanced Features State
  const [trendExplanation, setTrendExplanation] = useState(null);
  const [defectPatterns, setDefectPatterns] = useState(null);
  const [defectClusters, setDefectClusters] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [sprintHealth, setSprintHealth] = useState(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

  // Fetch Projects for filtering
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch (err) {
        console.error('Failed to load projects for analytics:', err);
      }
    };
    fetchProjects();
  }, [token]);

  // Fetch Sprints for Sprint Health telemetry
  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const res = await fetch('/api/sprints', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setSprints(data.sprints || []);
          if (data.sprints && data.sprints.length > 0 && !selectedSprintId) {
            setSelectedSprintId(String(data.sprints[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load sprints for analytics:', err);
      }
    };
    if (token) fetchSprints();
  }, [token]);

  // Fetch Sprint Health when sprint selection changes
  useEffect(() => {
    if (!token || !selectedSprintId) return;
    const fetchSprintHealth = async () => {
      try {
        const res = await fetch(`/api/analytics/sprint-health/${selectedSprintId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSprintHealth(data);
        }
      } catch (err) {
        console.error('Failed to load sprint health telemetry:', err);
      }
    };
    fetchSprintHealth();
  }, [selectedSprintId, token]);

  // Fetch Milestone 4 Advanced Extras: Trend Explanation, Patterns, Clusters
  const fetchMilestone4Extras = async () => {
    setLoadingExtras(true);
    try {
      const [trendRes, patternRes, clusterRes] = await Promise.all([
        fetch('/api/analytics/trend-explanation', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/ai/patterns', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/analytics/defect-clusters', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setTrendExplanation(trendData);
      }
      if (patternRes.ok) {
        const patternData = await patternRes.json();
        setDefectPatterns(patternData);
      }
      if (clusterRes.ok) {
        const clusterData = await clusterRes.json();
        setDefectClusters(clusterData);
      }
    } catch (err) {
      console.error('Failed to load advanced analytics extras', err);
    } finally {
      setLoadingExtras(false);
    }
  };

  // Fetch Analytics Telemetry
  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/analytics?time_range=${timeRange}`;
      if (projectId) {
        url += `&project_id=${projectId}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load analytics telemetry');
      }
      setAnalyticsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAnalytics();
      fetchMilestone4Extras();
    }
  }, [timeRange, projectId, token]);

  const summary = analyticsData?.summary || { total_defects: 0, open_defects: 0, in_progress_defects: 0, resolved_defects: 0, closed_defects: 0 };
  const bySeverity = analyticsData?.by_severity || { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const byCategory = analyticsData?.by_category || {};
  const byStatus = analyticsData?.by_status || {};
  const developerWorkload = analyticsData?.developer_workload || [];
  const defectTrends = analyticsData?.defect_trends || [];
  const avgResolutionTime = analyticsData?.average_resolution_time || { formatted: 'N/A', hours: 0, days: 0, resolved_count: 0 };

  // Calculate maximum values for relative chart bars
  const maxCategoryVal = Math.max(...Object.values(byCategory), 1);
  const maxSeverityVal = Math.max(...Object.values(bySeverity), 1);
  const maxStatusVal = Math.max(...Object.values(byStatus), 1);
  const maxTrendVal = Math.max(...defectTrends.map(t => Math.max(t.created, t.resolved)), 1);

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'var(--primary-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary-light)'
            }}>
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', margin: 0 }}>
                Defect Analytics & Telemetry
              </h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Real-time quality intelligence, workload distribution, and defect resolution velocity
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Time Filter & Project Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Time Range Filter Buttons */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)' }}>
            {[
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
              { id: 'all', label: 'All Time' }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setTimeRange(btn.id)}
                style={{
                  background: timeRange === btn.id ? 'var(--primary-glow)' : 'transparent',
                  color: timeRange === btn.id ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: timeRange === btn.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Project Filter */}
          <select
            className="input-field"
            style={{ width: '180px', margin: 0, padding: '8px 12px', fontSize: '0.85rem' }}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh Metrics"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          {/* Theme Toggle */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="btn-secondary"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{ padding: '8px 12px' }}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          color: '#F87171',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            {error}
          </div>
          <button onClick={fetchAnalytics} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
            Try Again
          </button>
        </div>
      )}

      {/* MILESTONE 4: Grounded Defect Trend Explanation Banner */}
      {trendExplanation && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderLeft: `5px solid ${trendExplanation.trajectory === 'improving' ? '#10B981' : trendExplanation.trajectory === 'worsening' ? '#EF4444' : '#3B82F6'}`,
          borderRadius: '14px',
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} color={trendExplanation.trajectory === 'improving' ? '#4ADE80' : trendExplanation.trajectory === 'worsening' ? '#F87171' : '#60A5FA'} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Defect Trend Explanation
              </h3>
              <span style={{
                fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px',
                background: trendExplanation.trajectory === 'improving' ? 'rgba(16, 185, 129, 0.15)' : trendExplanation.trajectory === 'worsening' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: trendExplanation.trajectory === 'improving' ? '#4ADE80' : trendExplanation.trajectory === 'worsening' ? '#F87171' : '#60A5FA',
                display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase'
              }}>
                {trendExplanation.trajectory === 'improving' ? <ArrowDownRight size={14} /> : trendExplanation.trajectory === 'worsening' ? <ArrowUpRight size={14} /> : <Minus size={14} />}
                Trajectory: {trendExplanation.trajectory}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>New (14d): <strong style={{ color: 'var(--text-main)' }}>{trendExplanation.current_window?.created || 0}</strong> ({trendExplanation.creation_change_percentage >= 0 ? `+${trendExplanation.creation_change_percentage}%` : `${trendExplanation.creation_change_percentage}%`})</span>
              <span>Resolved (14d): <strong style={{ color: '#4ADE80' }}>{trendExplanation.current_window?.resolved || 0}</strong> ({trendExplanation.resolution_change_percentage >= 0 ? `+${trendExplanation.resolution_change_percentage}%` : `${trendExplanation.resolution_change_percentage}%`})</span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
            {trendExplanation.trend_summary}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              <strong>Primary Driver:</strong> {trendExplanation.key_driver_component || 'Multi-component activity'}
            </span>
            <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>
              ℹ️ Grounded in actual database creation vs resolution telemetry across 14-day rolling windows.
            </span>
          </div>
        </div>
      )}

      {/* MILESTONE 4: Sprint Health Score Section */}
      {sprints.length > 0 && sprintHealth && (
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Target size={20} color="var(--primary-light)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Sprint Quality & Health Telemetry
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Active Sprint:</label>
              <select
                className="input-field"
                style={{ margin: 0, width: '200px', fontSize: '0.84rem', padding: '6px 10px' }}
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
              >
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.status || 'Active'})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--btn-secondary-bg)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: sprintHealth.health_score >= 75 ? 'rgba(16, 185, 129, 0.15)' : sprintHealth.health_score >= 50 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `3px solid ${sprintHealth.health_score >= 75 ? '#10B981' : sprintHealth.health_score >= 50 ? '#F59E0B' : '#EF4444'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.25rem', fontWeight: 800,
                color: sprintHealth.health_score >= 75 ? '#4ADE80' : sprintHealth.health_score >= 50 ? '#FBBF24' : '#F87171'
              }}>
                {sprintHealth.health_score}
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Health Score</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: sprintHealth.health_score >= 75 ? '#4ADE80' : sprintHealth.health_score >= 50 ? '#FBBF24' : '#F87171' }}>
                  {sprintHealth.status?.toUpperCase()}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--btn-secondary-bg)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Resolution Velocity</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {sprintHealth.resolution_rate_percentage || 0}%
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sprintHealth.resolved_defects || 0} of {sprintHealth.total_defects || 0} defects closed</span>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--btn-secondary-bg)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Open Critical Blockers</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (sprintHealth.critical_unresolved || 0) > 0 ? '#F87171' : '#4ADE80', marginTop: '4px' }}>
                {sprintHealth.critical_unresolved || 0}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Critical / P1 defects pending</span>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--btn-secondary-bg)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Pacing Assessment</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
                {sprintHealth.pacing_assessment || 'On Track'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{sprintHealth.days_remaining ? `${sprintHealth.days_remaining} days remaining` : 'Sprint active'}</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '18px'
      }}>
        {/* Total Defects */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Defects
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-light)' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {summary.total_defects}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
            All reported system issues
          </span>
        </div>

        {/* Open Defects */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #3B82F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Open Defects
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#60A5FA' }}>
            {summary.open_defects}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
            Awaiting developer pickup
          </span>
        </div>

        {/* In Progress Defects */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              In Progress
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#FBBF24' }}>
            {summary.in_progress_defects}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
            Under active resolution
          </span>
        </div>

        {/* Resolved Defects */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resolved Defects
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ADE80' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#4ADE80' }}>
            {summary.resolved_defects}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#4ADE80', marginTop: '4px', display: 'inline-block' }}>
            Fixed and verified
          </span>
        </div>

        {/* Average Resolution Time */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Avg Resolution Time
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-light)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--primary-light)' }}>
            {avgResolutionTime.formatted}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
            Based on {avgResolutionTime.resolved_count} resolved issues
          </span>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Defect Trends Timeline Chart (SVG Area/Line) */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={19} color="var(--primary-light)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Defect Velocity Trends
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#60A5FA' }}></span>
                Created
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4ADE80' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4ADE80' }}></span>
                Resolved
              </span>
            </div>
          </div>

          {defectTrends.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No timeline data for this time period.
            </div>
          ) : (
            <div style={{ height: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Bars representation of trends */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: defectTrends.length > 15 ? '4px' : '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                {defectTrends.map((t, idx) => {
                  const createdH = Math.max((t.created / maxTrendVal) * 160, t.created > 0 ? 8 : 0);
                  const resolvedH = Math.max((t.resolved / maxTrendVal) * 160, t.resolved > 0 ? 8 : 0);
                  const isVisibleLabel = idx % (Math.ceil(defectTrends.length / 7)) === 0;

                  return (
                    <div key={t.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                        {/* Created bar */}
                        <div
                          title={`${t.date}: ${t.created} Created`}
                          style={{
                            width: '45%',
                            height: `${createdH}px`,
                            background: '#3B82F6',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.4s ease'
                          }}
                        />
                        {/* Resolved bar */}
                        <div
                          title={`${t.date}: ${t.resolved} Resolved`}
                          style={{
                            width: '45%',
                            height: `${resolvedH}px`,
                            background: '#10B981',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.4s ease'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                        {isVisibleLabel ? t.date.slice(5) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-subtle)', paddingTop: '6px' }}>
                <span>{defectTrends[0]?.date}</span>
                <span>{defectTrends[defectTrends.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>

        {/* Defects by Severity */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <ShieldAlert size={19} color="#EF4444" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Defects by Severity
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Critical', count: bySeverity.Critical || 0, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
              { label: 'High', count: bySeverity.High || 0, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
              { label: 'Medium', count: bySeverity.Medium || 0, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
              { label: 'Low', count: bySeverity.Low || 0, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' }
            ].map(item => {
              const pct = summary.total_defects > 0 ? Math.round((item.count / summary.total_defects) * 100) : 0;
              const barWidth = maxSeverityVal > 0 ? (item.count / maxSeverityVal) * 100 : 0;

              return (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: item.color }}>{item.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <strong>{item.count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--btn-secondary-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: item.color,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Second Row: Defects by Category & Defects by Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Defects by Category / Component */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Layers size={19} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Defects by Category
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(byCategory).map(([cat, count]) => {
              const barWidth = maxCategoryVal > 0 ? (count / maxCategoryVal) * 100 : 0;
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '150px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>
                    {cat}
                  </div>
                  <div style={{ flex: 1, height: '8px', background: 'var(--btn-secondary-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary-violet) 0%, var(--primary-light) 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <div style={{ width: '32px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', textAlign: 'left' }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Defects by Status */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Clock size={19} color="#38BDF8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Defects by Status
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { status: 'Open', color: '#3B82F6' },
              { status: 'In Progress', color: '#F59E0B' },
              { status: 'Retest/Verify', color: '#8B5CF6' },
              { status: 'Resolved', color: '#10B981' },
              { status: 'Closed', color: '#6B7280' }
            ].map(st => {
              const count = byStatus[st.status] || 0;
              const pct = summary.total_defects > 0 ? Math.round((count / summary.total_defects) * 100) : 0;
              const barWidth = maxStatusVal > 0 ? (count / maxStatusVal) * 100 : 0;

              return (
                <div key={st.status} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: st.color }}>● {st.status}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--btn-secondary-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: st.color,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MILESTONE 4: AI Defect Pattern Detection */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              AI Defect Pattern Detection
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Unsupervised recurring defect clusters & root trigger categorization
          </span>
        </div>

        {defectPatterns && defectPatterns.has_enough_data === false ? (
          <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Cpu size={36} opacity={0.4} style={{ margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{defectPatterns.message || 'Not enough historical data to extract statistically significant recurring defect patterns.'}</p>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'inline-block' }}>Report additional defects to activate automatic recurring pattern clustering.</span>
          </div>
        ) : defectPatterns?.patterns?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {defectPatterns.patterns.map((pat, idx) => (
              <div key={pat.id || idx} style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--btn-secondary-bg)',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      {pat.component || 'Core'}
                    </span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: '6px 0 0' }}>
                      {pat.pattern_title}
                    </h4>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', whiteSpace: 'nowrap'
                  }}>
                    {pat.recurrence_count} occurrences
                  </span>
                </div>

                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  {pat.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.72rem' }}>Avg Resolution Time</span>
                    <strong style={{ color: 'var(--text-main)' }}>{pat.avg_resolution_time || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.72rem' }}>Common Root Trigger</span>
                    <strong style={{ color: '#FBBF24' }}>{pat.common_trigger || 'Configuration / Logic'}</strong>
                  </div>
                </div>

                {pat.linked_defect_ids && pat.linked_defect_ids.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Linked Defect IDs:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {pat.linked_defect_ids.map(id => (
                        <span key={id} style={{
                          fontSize: '0.72rem', background: 'var(--btn-secondary-bg)', color: 'var(--primary-light)',
                          padding: '2px 8px', borderRadius: '6px', fontWeight: 700
                        }}>
                          DEF-{id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
            No recurring pattern anomalies detected in recent telemetry.
          </div>
        )}
      </div>

      {/* MILESTONE 4: Defect Cluster / Issue Map (Category -> Component -> Topic) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderTree size={20} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Defect Cluster & Issue Map
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Hierarchical breakdown: Category → Component → Active Topics
          </span>
        </div>

        {defectClusters && defectClusters.clusters && defectClusters.clusters.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {defectClusters.clusters.map(catCluster => (
              <div key={catCluster.category} style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--btn-secondary-bg)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--primary-light)" />
                    <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{catCluster.category}</strong>
                  </div>
                  <span style={{
                    fontSize: '0.78rem', background: 'var(--primary-glow)', color: 'var(--primary-light)',
                    padding: '2px 10px', borderRadius: '12px', fontWeight: 700
                  }}>
                    {catCluster.total_defects} Defects
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {catCluster.components?.map(comp => (
                    <div key={comp.name} style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {comp.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {comp.defect_count} issues
                        </span>
                      </div>

                      {comp.topics && comp.topics.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {comp.topics.map(t => (
                            <span key={t.topic} style={{
                              fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                              padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)'
                            }}>
                              {t.topic} ({t.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
            No defect cluster mapping available.
          </div>
        )}
      </div>

      {/* Developer Workload Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={19} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Developer Workload & Allocation
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {developerWorkload.length} Team Members
          </span>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Developer</th>
                <th>Role</th>
                <th style={{ textAlign: 'center' }}>Total Assigned</th>
                <th style={{ textAlign: 'center' }}>Open & Active</th>
                <th style={{ textAlign: 'center' }}>Resolved / Closed</th>
                <th style={{ textAlign: 'center' }}>Critical / High</th>
                <th>Workload Status</th>
              </tr>
            </thead>
            <tbody>
              {developerWorkload.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No developer workload records found.
                  </td>
                </tr>
              ) : (
                developerWorkload.map(dev => {
                  const isHighLoad = dev.open_defects >= 3;
                  const isOptimal = dev.open_defects > 0 && dev.open_defects < 3;

                  return (
                    <tr key={dev.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{dev.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{dev.email}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {dev.role}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>
                        {dev.assigned_defects}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                          background: dev.open_defects > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.1)',
                          color: dev.open_defects > 0 ? '#60A5FA' : 'var(--text-muted)'
                        }}>
                          {dev.open_defects}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                          background: dev.resolved_defects > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.1)',
                          color: dev.resolved_defects > 0 ? '#4ADE80' : 'var(--text-muted)'
                        }}>
                          {dev.resolved_defects}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {dev.critical_high_defects > 0 ? (
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.15)', color: '#F87171'
                          }}>
                            {dev.critical_high_defects}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>0</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', fontWeight: 700,
                          background: isHighLoad ? 'rgba(239, 68, 68, 0.15)' : isOptimal ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isHighLoad ? '#F87171' : isOptimal ? '#60A5FA' : '#4ADE80'
                        }}>
                          {isHighLoad ? 'High Load' : isOptimal ? 'Optimal' : 'Available'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
