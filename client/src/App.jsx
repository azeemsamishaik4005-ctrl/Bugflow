import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import AnalyticsView from './components/AnalyticsView.jsx';
import ProjectsView from './components/ProjectsView.jsx';
import SprintPlanning from './components/SprintPlanning.jsx';
import ReportIssueModal from './components/ReportIssueModal.jsx';
import NotificationsView from './components/NotificationsView.jsx';
import IssuesView from './components/IssuesView.jsx';
import AIAssistantChatbot from './components/AIAssistantChatbot.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';


export default function App() {
  const [token, setToken] = useState(localStorage.getItem('defectx_token') || localStorage.getItem('bugflow_token') || null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, resolved: 0, inProgress: 0 });
  const [componentStats, setComponentStats] = useState({});
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('defectx_theme') || localStorage.getItem('bugflow_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);

  // Load User Profile & Data on Mount / Token Change
  useEffect(() => {
    if (token) {
      fetchUserData();
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to verify token:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [issuesRes, projectsRes, sprintsRes] = await Promise.all([
        fetch('/api/issues', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/sprints', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        setIssues(issuesData.issues || []);
        setStats(issuesData.stats || { total: 0, critical: 0, resolved: 0, inProgress: 0 });
        setComponentStats(issuesData.componentStats || {});
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects || []);
      }

      if (sprintsRes.ok) {
        const sprintsData = await sprintsRes.json();
        setSprints(sprintsData.sprints || []);
      }
    } catch (err) {
      console.error('Failed to fetch app telemetry data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
    localStorage.setItem('defectx_theme', theme);
    localStorage.setItem('bugflow_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('defectx_token');
    localStorage.removeItem('defectx_user');
    localStorage.removeItem('bugflow_token');
    localStorage.removeItem('bugflow_user');
    setToken(null);
    setUser(null);
  };

  const handleOpenReportModal = () => {
    setEditingIssue(null);
    setIsModalOpen(true);
  };

  const handleEditIssue = (issue) => {
    setEditingIssue(issue);
    setIsModalOpen(true);
  };

  const handleDeleteIssue = async (issueId) => {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to delete issue:', err);
    }
  };

  const handleIssueSaved = () => {
    fetchDashboardData();
  };

  if (!token) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
        color: 'var(--primary-light)',
        fontSize: '1.2rem',
        fontWeight: 700
      }}>
        Loading Telemetry...
      </div>
    );
  }

  return (
    <NotificationProvider user={user} token={token}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onRequestReportIssue={handleOpenReportModal}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, marginLeft: '260px', minHeight: '100vh', paddingBottom: '60px' }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            issues={issues}
            stats={stats}
            componentStats={componentStats}
            projects={projects}
            token={token}
            onRefresh={fetchDashboardData}
            onRequestReportIssue={handleOpenReportModal}
            onEditIssue={handleEditIssue}
            onDeleteIssue={handleDeleteIssue}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            token={token}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )}


        {activeTab === 'issues' && (
          <IssuesView
            issues={issues}
            projects={projects}
            token={token}
            onRequestReportIssue={handleOpenReportModal}
            onEditIssue={handleEditIssue}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            token={token}
            onRefresh={fetchDashboardData}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )}

        {activeTab === 'sprints' && (
          <SprintPlanning
            sprints={sprints}
            projects={projects}
            issues={issues}
            token={token}
            onRefresh={fetchDashboardData}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsView
            onEditIssue={handleEditIssue}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )}
      </main>

      {/* Global Issue Creation / Edit Modal */}
      <ReportIssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onIssueSaved={handleIssueSaved}
        projects={projects}
        sprints={sprints}
        token={token}
        initialData={editingIssue}
        onSelectIssue={(issue) => setEditingIssue(issue)}
      />

      {/* Floating DefectX AI Assistant Chatbot (Overlay across all tabs) */}
      <AIAssistantChatbot
        token={token}
        user={user}
        activeIssue={editingIssue}
      />
    </div>
    </NotificationProvider>
  );
}
