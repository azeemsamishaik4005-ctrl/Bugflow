import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle, ArrowRight, Loader2, RefreshCw, Eye, UserCheck, ShieldCheck, FileText, CheckCircle2, AlertCircle, MessageSquare, Send, Trash2, Edit3, CornerDownRight } from 'lucide-react';
import { DEFECT_COMPONENTS } from '../constants';

export default function ReportIssueModal({ isOpen, onClose, onIssueSaved, projects = [], token, initialData = null, sprints = [], onSelectIssue = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Bug');
  const [priority, setPriority] = useState('P2');
  const [severity, setSeverity] = useState('Medium');
  const [status, setStatus] = useState('Open');
  const [component, setComponent] = useState('Frontend UI');
  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Issue Details state
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Discussions & Tabs
  const [activeTab, setActiveTab] = useState('overview');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const messagesEndRef = useRef(null);

  // AI Tools State
  const [testCases, setTestCases] = useState(null);
  const [devRec, setDevRec] = useState(null);
  const [verification, setVerification] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [aiToolLoading, setAiToolLoading] = useState(false);
  const [aiToolError, setAiToolError] = useState('');
  const [assigningDev, setAssigningDev] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setType(initialData.type || 'Bug');
      setPriority(initialData.priority || 'P2');
      setSeverity(initialData.severity || 'Medium');
      setStatus(initialData.status || 'Open');
      setComponent(initialData.component || 'Frontend UI');
      setProjectId(initialData.project_id || (projects.length > 0 ? projects[0].id : ''));
      setSprintId(initialData.sprint_id || '');
    } else {
      setTitle('');
      setDescription('');
      setType('Bug');
      setPriority('P2');
      setSeverity('Medium');
      setStatus('Open');
      setComponent('Frontend UI');
      setProjectId(projects.length > 0 ? projects[0].id : '');
      setSprintId('');
      setComments([]);
      setHistory([]);
      setAttachments([]);
      setActiveTab('overview');
    }
    setAiResult(null);
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setForceCreate(false);
    setTestCases(null);
    setDevRec(null);
    setVerification(null);
    setAiReport(null);
    setError('');
    setAiToolError('');

    if (initialData && isOpen) {
      loadIssueDetails(initialData.id);
    }
  }, [initialData, isOpen, projects]);

  // Polling for discussions
  useEffect(() => {
    let interval;
    if (isOpen && initialData && activeTab === 'discussions') {
      interval = setInterval(() => {
        loadIssueDetails(initialData.id, false); // silent refresh
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isOpen, initialData, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'discussions') {
      setTimeout(scrollToBottom, 100);
    }
  }, [comments, activeTab]);

  const loadIssueDetails = async (id, showLoading = true) => {
    if (showLoading) setLoadingDetails(true);
    try {
      const res = await fetch(`/api/issues/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        setHistory(data.history || []);
        setAttachments(data.attachments || []);
      }
    } catch (err) {
      console.error('Failed to load details', err);
    } finally {
      if (showLoading) setLoadingDetails(false);
    }
  };

  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/issues/${initialData.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        setNewComment('');
        loadIssueDetails(initialData.id, false);
      }
    } catch (err) {
      console.error('Failed to add comment', err);
    }
  };

  const handleUpdateComment = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      const res = await fetch(`/api/discussions/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: editCommentText })
      });
      if (res.ok) {
        setEditingCommentId(null);
        loadIssueDetails(initialData.id, false);
      }
    } catch (err) {
      console.error('Failed to update comment', err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await fetch(`/api/discussions/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadIssueDetails(initialData.id, false);
      }
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  // Debounced duplicate detection
  useEffect(() => {
    if (initialData || (!title && !description)) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/check-duplicate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, description, project_id: projectId })
        });
        const data = await res.json();
        if (data.duplicates && data.duplicates.length > 0) {
          setDuplicates(data.duplicates);
        } else {
          setDuplicates([]);
          setShowDuplicateWarning(false);
        }
      } catch (err) {
        console.error('Duplicate check failed', err);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [title, description, projectId, token, initialData]);

  if (!isOpen) return null;

  const handleAiEnhance = async () => {
    if (!title && !description) {
      setError('Please type a brief title or description before running AI Enhancement.');
      return;
    }
    setError('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai/enhance-bug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI enhancement failed');

      setAiResult(data);
      if (data.enhanced_title) setTitle(data.enhanced_title);
      if (data.enhanced_description) setDescription(data.enhanced_description);
      if (data.suggested_priority) setPriority(data.suggested_priority);
      if (data.suggested_severity) setSeverity(data.suggested_severity);
      if (data.suggested_type) setType(data.suggested_type);
      if (data.suggested_category) setComponent(data.suggested_category);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateTestCases = async () => {
    setAiToolLoading(true); 
    setAiToolError('');
    try {
      const res = await fetch('/api/ai/generate-test-cases', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, description, type, priority, severity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate test cases');
      setTestCases(data.test_cases || []);
    } catch(err) { 
      setAiToolError(err.message); 
    } finally { 
      setAiToolLoading(false); 
    }
  };

  const handleRecommendDev = async () => {
    setAiToolLoading(true); 
    setAiToolError('');
    try {
      const res = await fetch('/api/ai/recommend-developer', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, description, priority, severity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to recommend developer');
      setDevRec(data);
    } catch(err) { 
      setAiToolError(err.message); 
    } finally { 
      setAiToolLoading(false); 
    }
  };

  const handleAssignRecommendedDeveloper = async () => {
    if (!devRec || !devRec.recommended_developer || !initialData) return;
    setAssigningDev(true);
    try {
      const res = await fetch(`/api/issues/${initialData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assignee_id: devRec.recommended_developer.id })
      });
      if (res.ok) {
        loadIssueDetails(initialData.id);
        if (onIssueSaved) {
          onIssueSaved({ ...initialData, assignee_id: devRec.recommended_developer.id, assignee_name: devRec.recommended_developer.name });
        }
        setDevRec(null);
      }
    } catch (err) {
      console.error('Assign error:', err);
    } finally {
      setAssigningDev(false);
    }
  };

  const handleVerifyResolution = async () => {
    if (!newComment.trim()) { 
      setAiToolError('Please type your proposed resolution notes or fix description in the comment box below, then click Verify Resolution.'); 
      return; 
    }
    setAiToolLoading(true); 
    setAiToolError('');
    try {
      const commentsText = comments.map(c => `${c.user_name || 'User'}: ${c.content}`).join('\n');
      const res = await fetch('/api/ai/verify-resolution', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, description, resolution_notes: newComment, commentsText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify resolution');
      setVerification(data);
    } catch(err) { 
      setAiToolError(err.message); 
    } finally { 
      setAiToolLoading(false); 
    }
  };

  const handleGenerateReport = async () => {
    setAiToolLoading(true); 
    setAiToolError('');
    try {
      const commentsText = comments.map(c => `${c.user_name || 'User'}: ${c.content}`).join('\n');
      const res = await fetch('/api/ai/generate-report', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, description, type, priority, severity, status, component, commentsText, issue_id: initialData ? initialData.id : null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');
      setAiReport(data.report);
    } catch(err) { 
      setAiToolError(err.message); 
    } finally { 
      setAiToolLoading(false); 
    }
  };

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    // Duplicate Check Interception during issue creation
    if (!initialData && duplicates.length > 0 && !force && !forceCreate) {
      setShowDuplicateWarning(true);
      return;
    }

    setSaving(true);
    setError('');

    const endpoint = initialData ? `/api/issues/${initialData.id}` : '/api/issues';
    const method = initialData ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          type,
          priority,
          severity,
          status,
          component,
          project_id: projectId || (projects.length > 0 ? projects[0].id : null),
          sprint_id: sprintId || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save issue');

      onIssueSaved(data.issue);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {initialData ? `Issue #${initialData.id}: ${initialData.title}` : 'Report New Issue'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {initialData ? 'Inspect parameters, run AI tools, and collaborate on resolution' : 'Fill in details or use AI to craft a detailed bug report'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '18px',
            color: '#F87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Duplicate Issue Warning Modal / Card */}
        {(!initialData && (showDuplicateWarning || duplicates.length > 0)) && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px',
            color: '#FDE68A'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1rem', color: '#FBBF24', marginBottom: '8px' }}>
              <AlertTriangle size={20} color="#FBBF24" />
              ⚠️ Possible Duplicate Issue Found
            </div>
            <p style={{ fontSize: '0.85rem', color: '#F3F4F6', marginBottom: '14px' }}>
              We found existing issues in the repository that appear similar to the defect you are creating. Please review them before creating a duplicate.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {duplicates.map(d => (
                <div key={d.id} style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.78rem', background: '#374151', color: 'var(--text-main)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        BUG-{d.id}
                      </span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{d.title}</strong>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        background: d.similarity >= 0.8 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: d.similarity >= 0.8 ? '#F87171' : '#FBBF24'
                      }}>
                        {Math.round(d.similarity * 100)}% Match
                      </span>
                    </div>

                    {d.description && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 6px' }}>
                        {d.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>Status: <strong style={{ color: 'var(--text-main)' }}>{d.status}</strong></span>
                      {d.priority && <span>Priority: <strong style={{ color: 'var(--text-main)' }}>{d.priority}</strong></span>}
                      {d.severity && <span>Severity: <strong style={{ color: 'var(--text-main)' }}>{d.severity}</strong></span>}
                    </div>

                    {d.related_information && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--primary-light)', marginTop: '6px', fontStyle: 'italic' }}>
                        💡 {d.related_information}
                      </div>
                    )}
                  </div>

                  {onSelectIssue && (
                    <button
                      type="button"
                      onClick={() => onSelectIssue(d)}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                    >
                      <Eye size={13} /> View Existing
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <button
                type="button"
                onClick={() => setShowDuplicateWarning(false)}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Cancel & Edit
              </button>
              <button
                type="button"
                onClick={(e) => { setForceCreate(true); handleSubmit(e, true); }}
                className="btn-primary"
                style={{ background: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.85rem' }}
              >
                Create Anyway <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* AI Callout Banner if AI returned results */}
        {aiResult && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(236, 72, 153, 0.2)', paddingBottom: '8px' }}>
              <Sparkles size={20} color="#EC4899" />
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>AI Resolution Assistance</strong>
            </div>
            
            {aiResult.suggested_category && (
              <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <strong>Suggested Category:</strong> <span style={{ background: 'var(--primary-glow)', padding: '2px 8px', borderRadius: '4px', color: 'var(--primary-light)', fontWeight: 600 }}>{aiResult.suggested_category}</span>
              </div>
            )}

            {aiResult.resolution_assistance && (
              <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <strong>Resolution Advice:</strong>
                <p style={{ marginTop: '4px', opacity: 0.9 }}>{aiResult.resolution_assistance}</p>
              </div>
            )}

            {aiResult.troubleshooting_guidance && aiResult.troubleshooting_guidance.length > 0 && (
              <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <strong>Troubleshooting Steps:</strong>
                <ul style={{ paddingLeft: '18px', marginTop: '4px', opacity: 0.9 }}>
                  {aiResult.troubleshooting_guidance.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiResult.missing_fields && aiResult.missing_fields.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '0.82rem', color: '#FCD34D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} />
                  Detected Missing Details:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {aiResult.missing_fields.map((field, idx) => (
                    <span key={idx} style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#FBBF24',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: '0.8rem', color: 'var(--primary-light)', marginTop: '10px' }}>
              ✓ Auto-formatted structured bug report preview below. Confirm or customize fields before final save.
            </p>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Issue Title *</label>
              <button
                type="button"
                onClick={handleAiEnhance}
                disabled={aiLoading}
                className="btn-ai"
              >
                {aiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {aiLoading ? 'Analyzing...' : '✨ Enhance with AI'}
              </button>
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Payment API is triggered twice on checkout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Type</label>
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Bug">Bug</option>
                <option value="Feature">Feature</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select className="input-field" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="P1">P1 (Urgent)</option>
                <option value="P2">P2 (High)</option>
                <option value="P3">P3 (Normal)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Severity</label>
              <select className="input-field" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Status</label>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Retest/Verify">Retest/Verify</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Project</label>
              <select className="input-field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Component</label>
              <select className="input-field" value={component} onChange={(e) => setComponent(e.target.value)}>
                {DEFECT_COMPONENTS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Sprint</label>
              <select className="input-field" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
                <option value="">(No Sprint / Backlog)</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Detailed Description *</label>
            <textarea
              className="input-field"
              rows={6}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.88rem', lineHeight: '1.5' }}
              placeholder="Describe the issue, steps to reproduce, expected vs actual behavior..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : (initialData ? 'Update Issue' : 'Confirm & Save Issue')}
              {!saving && <ArrowRight size={18} />}
            </button>
          </div>
        </form>

        {/* Tabs for Existing Issues */}
        {initialData && (
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-hover)', marginBottom: '24px' }}>
              <button
                type="button"
                className="tab-btn"
                style={{ 
                  background: activeTab === 'overview' ? 'var(--primary-glow)' : 'transparent',
                  color: activeTab === 'overview' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none', borderBottom: activeTab === 'overview' ? '2px solid var(--primary-light)' : '2px solid transparent',
                  padding: '10px 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}
                onClick={() => setActiveTab('overview')}
              >
                <FileText size={16} /> Overview
              </button>
              <button
                type="button"
                className="tab-btn"
                style={{ 
                  background: activeTab === 'activity' ? 'var(--primary-glow)' : 'transparent',
                  color: activeTab === 'activity' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none', borderBottom: activeTab === 'activity' ? '2px solid var(--primary-light)' : '2px solid transparent',
                  padding: '10px 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}
                onClick={() => setActiveTab('activity')}
              >
                <RefreshCw size={16} /> Activity History
              </button>
              <button
                type="button"
                className="tab-btn"
                style={{ 
                  background: activeTab === 'discussions' ? 'var(--primary-glow)' : 'transparent',
                  color: activeTab === 'discussions' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none', borderBottom: activeTab === 'discussions' ? '2px solid var(--primary-light)' : '2px solid transparent',
                  padding: '10px 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}
                onClick={() => setActiveTab('discussions')}
              >
                <MessageSquare size={16} /> Discussions ({comments.length})
              </button>
            </div>

            {/* Tab: Overview (AI Tools) */}
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} color="var(--primary-light)" /> AI Toolkit
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Intelligent Defect Assistance</span>
                </div>
                
                {/* AI Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <button 
                    type="button" 
                    onClick={handleGenerateTestCases} 
                    disabled={aiToolLoading} 
                    className="btn-secondary" 
                    style={{ fontSize: '0.85rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: testCases ? 'var(--primary-glow)' : undefined }}
                  >
                    <CheckCircle size={15} color="var(--primary-light)" /> Generate Test Cases
                  </button>
                  <button 
                    type="button" 
                    onClick={handleRecommendDev} 
                    disabled={aiToolLoading} 
                    className="btn-secondary" 
                    style={{ fontSize: '0.85rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: devRec ? 'var(--primary-glow)' : undefined }}
                  >
                    <UserCheck size={15} color="var(--primary-light)" /> Recommend Developer
                  </button>
                  <button 
                    type="button" 
                    onClick={handleVerifyResolution} 
                    disabled={aiToolLoading} 
                    className="btn-secondary" 
                    style={{ fontSize: '0.85rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: verification ? 'var(--primary-glow)' : undefined }}
                  >
                    <ShieldCheck size={15} color="var(--primary-light)" /> Verify Resolution
                  </button>
                  <button 
                    type="button" 
                    onClick={handleGenerateReport} 
                    disabled={aiToolLoading} 
                    className="btn-secondary" 
                    style={{ fontSize: '0.85rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: aiReport ? 'var(--primary-glow)' : undefined }}
                  >
                    <FileText size={15} color="var(--primary-light)" /> View AI Report
                  </button>
                </div>

                {/* AI Loading State */}
                {aiToolLoading && (
                  <div style={{
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '10px',
                    padding: '16px',
                    color: 'var(--primary-light)',
                    fontSize: '0.88rem',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing issue parameters and executing AI models...
                  </div>
                )}

                {/* AI Tool Error State */}
                {aiToolError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '14px',
                    color: '#F87171',
                    fontSize: '0.85rem',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>{aiToolError}</div>
                    <button
                      type="button"
                      onClick={() => setAiToolError('')}
                      style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* 1. Test Cases Display */}
                {testCases && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} color="#4ADE80" /> Generated QA Test Cases ({testCases.length})
                      </h4>
                      <button
                        type="button"
                        onClick={handleGenerateTestCases}
                        disabled={aiToolLoading}
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RefreshCw size={13} /> Regenerate
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {testCases.map((tc, idx) => (
                        <div key={tc.id || idx} style={{ background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.75rem', background: '#374151', color: 'var(--text-main)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {tc.id || `TC-0${idx+1}`}
                              </span>
                              <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{tc.scenario}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 600,
                                background: tc.type === 'Positive' ? 'rgba(74, 222, 128, 0.15)' : tc.type === 'Negative' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: tc.type === 'Positive' ? '#4ADE80' : tc.type === 'Negative' ? '#F87171' : '#FBBF24'
                              }}>
                                {tc.type || 'Positive'}
                              </span>
                              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: '#1F2937', color: 'var(--text-muted)' }}>
                                Priority: {tc.priority || 'Medium'}
                              </span>
                            </div>
                          </div>

                          {tc.preconditions && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                              <strong style={{ color: 'var(--text-main)' }}>Preconditions:</strong> {tc.preconditions}
                            </div>
                          )}

                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', whiteSpace: 'pre-line' }}>
                            <strong style={{ color: 'var(--text-main)' }}>Execution Steps:</strong><br />
                            {tc.steps}
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#A7F3D0', background: 'rgba(16, 185, 129, 0.08)', padding: '8px 10px', borderRadius: '6px', marginTop: '6px' }}>
                            <strong>Expected Result:</strong> {tc.expected_result}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Developer Recommendation Display */}
                {devRec && devRec.recommended_developer && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserCheck size={18} color="var(--primary-light)" /> Recommended Developer
                      </h4>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--primary-light)',
                        background: 'var(--primary-glow)',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        {devRec.match_score || 92}% Match Score
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--btn-secondary-bg)', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {devRec.recommended_developer.name}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Role: <strong style={{ color: 'var(--text-main)' }}>{devRec.recommended_developer.role || 'Software Engineer'}</strong>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Current Workload: <strong style={{ color: '#FBBF24' }}>{devRec.current_workload ?? 0} active issues</strong>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: '1.5', marginBottom: '12px' }}>
                        {devRec.reason}
                      </p>

                      {devRec.relevant_skills && devRec.relevant_skills.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          {devRec.relevant_skills.map((s, i) => (
                            <span key={i} style={{ fontSize: '0.75rem', background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '2px 8px', borderRadius: '6px' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {devRec.similar_issue_experience && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Experience: {devRec.similar_issue_experience}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setDevRec(null)}
                        className="btn-secondary"
                        style={{ fontSize: '0.85rem' }}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={handleAssignRecommendedDeveloper}
                        disabled={assigningDev}
                        className="btn-primary"
                        style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {assigningDev ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                        {assigningDev ? 'Assigning...' : 'Assign Developer'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Resolution Verification Display */}
                {verification && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={18} color="var(--primary-light)" /> Resolution Verification Result
                      </h4>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        padding: '3px 12px',
                        borderRadius: '12px',
                        background: verification.status === 'Verified' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: verification.status === 'Verified' ? '#4ADE80' : '#F87171'
                      }}>
                        {verification.status} ({verification.confidence || 90}% Confidence)
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--btn-secondary-bg)', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>Summary:</strong>
                        <p style={{ color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>{verification.summary}</p>
                      </div>

                      {verification.what_was_fixed && (
                        <div>
                          <strong style={{ color: '#A7F3D0' }}>What was fixed:</strong>
                          <p style={{ color: 'var(--text-main)', marginTop: '2px' }}>{verification.what_was_fixed}</p>
                        </div>
                      )}

                      {verification.remaining_concerns && (
                        <div>
                          <strong style={{ color: '#FCD34D' }}>Remaining Concerns:</strong>
                          <p style={{ color: 'var(--text-main)', marginTop: '2px' }}>{verification.remaining_concerns}</p>
                        </div>
                      )}

                      {verification.suggested_tests && verification.suggested_tests.length > 0 && (
                        <div>
                          <strong style={{ color: 'var(--text-main)' }}>Recommended Verification Tests:</strong>
                          <ul style={{ paddingLeft: '18px', marginTop: '4px', color: 'var(--text-muted)' }}>
                            {verification.suggested_tests.map((st, i) => (
                              <li key={i} style={{ marginBottom: '2px' }}>{st}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {verification.recommended_next_action && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--primary-light)', background: 'rgba(168, 85, 247, 0.1)', padding: '8px 10px', borderRadius: '6px' }}>
                          <strong>Next Action:</strong> {verification.recommended_next_action}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Comprehensive AI Defect Report Display (Resolution Assistance) */}
                {aiReport && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color="var(--primary-light)" /> AI Resolution Assistance
                      </h4>
                      <button
                        type="button"
                        onClick={handleGenerateReport}
                        disabled={aiToolLoading}
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RefreshCw size={13} /> Refresh Assistance
                      </button>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>1. Probable Root Cause:</strong>
                        <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{aiReport["Probable Root Cause"] || aiReport.root_cause_analysis}</p>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>2. Recommended Resolution:</strong>
                        <p style={{ color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'pre-line' }}>{aiReport["Recommended Resolution"] || aiReport.recommended_resolution}</p>
                      </div>

                      <div>
                        <strong style={{ color: '#A7F3D0' }}>3. Suggested Fix:</strong>
                        <p style={{ color: 'var(--text-main)', marginTop: '2px', whiteSpace: 'pre-line' }}>{aiReport["Suggested Fix"] || "N/A"}</p>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>4. Testing Recommendation:</strong>
                        <p style={{ color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'pre-line' }}>{aiReport["Testing Recommendation"] || "N/A"}</p>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>5. Related Component:</strong>
                        <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{aiReport["Related Component"] || component}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Activity History */}
            {activeTab === 'activity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                    No activity history yet.
                  </div>
                ) : (
                  history.map(h => (
                    <div key={`h-${h.id}`} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <CheckCircle size={14} color="var(--primary-light)" style={{ marginTop: '2px' }} />
                      <div>
                        <strong>{h.user_name || 'User'}</strong> {h.action.toLowerCase()} 
                        {h.old_state && h.new_state ? ` from '${h.old_state}' to '${h.new_state}'` : ''} 
                        {h.new_state && !h.old_state ? ` (${h.new_state})` : ''} 
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '4px' }}>
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Discussions */}
            {activeTab === 'discussions' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '8px', marginBottom: '16px' }}>
                  {comments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      <MessageSquare size={32} opacity={0.5} style={{ margin: '0 auto 12px' }} />
                      No discussions yet. Start the conversation!
                    </div>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} style={{ background: 'var(--btn-secondary-hover)', border: '1px solid var(--btn-secondary-bg)', padding: '16px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '12px' }}>
                              {(c.user_name || 'U').charAt(0)}
                            </div>
                            <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{c.user_name || 'User'}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                              {new Date(c.created_at).toLocaleString()}
                              {c.updated_at && <span style={{ marginLeft: '4px', fontStyle: 'italic' }}>(edited)</span>}
                            </span>
                          </div>
                          
                          {/* Message Actions */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Edit"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </div>

                        {editingCommentId === c.id ? (
                          <div style={{ marginTop: '8px' }}>
                            <textarea 
                              className="input-field" 
                              rows={2} 
                              value={editCommentText} 
                              onChange={(e) => setEditCommentText(e.target.value)}
                              autoFocus
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                              <button type="button" onClick={() => setEditingCommentId(null)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Cancel</button>
                              <button type="button" onClick={() => handleUpdateComment(c.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginLeft: '36px' }}>
                            {c.content}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Compose Message Area */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '12px', background: 'var(--btn-secondary-hover)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-hover)' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Type a message to discuss this issue..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <button type="submit" className="btn-primary" disabled={!newComment.trim()} style={{ width: '48px', height: '48px', padding: '0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Send size={18} />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
