const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/auth');
const {
  validateCreateIssue,
  validateUpdateIssue,
  validateComment,
  validateDependency,
  isValidTransition,
  ALLOWED_COMPONENTS,
  ALLOWED_ENVIRONMENTS
} = require('../middleware/validation');
const notificationService = require('../services/notificationService');
const prismaService = require('../services/prisma');

const router = express.Router();

/**
 * Computes deterministic Defect Health Indicator
 */
function computeDefectHealth(issue) {
  if (!issue) return { status: 'Healthy', badge: 'On Track', label: 'On Track', color: '#10B981', reason: 'Normal state', sla_hours: 720, hours_open: 0, is_breached: false };
  const isResolvedOrClosed = issue.status === 'Resolved' || issue.status === 'Closed' || issue.status === 'Verified';
  if (isResolvedOrClosed) {
    return {
      status: 'Healthy',
      badge: 'Resolved / Closed',
      label: 'Resolved / Closed',
      color: '#10B981',
      reason: 'Defect resolution has been completed and verified.',
      sla_hours: 720,
      hours_open: 0,
      is_breached: false
    };
  }

  const ageDays = (new Date() - new Date(issue.created_at)) / (1000 * 60 * 60 * 24);
  const hoursOpen = Math.max(0, Math.round(ageDays * 24));
  const isCritical = issue.severity === 'Critical' || issue.priority === 'P1';
  const isHigh = issue.severity === 'High' || issue.priority === 'P2';
  const isUnassigned = !issue.assignee_id;
  const isReopened = issue.status === 'Reopened';
  const slaHours = isCritical ? 48 : isHigh ? 120 : 240;
  const isBreached = hoursOpen > slaHours;

  if (isCritical && ageDays > 2) {
    return {
      status: 'Critical Overdue',
      badge: 'Critical Overdue',
      label: 'Critical Overdue',
      color: '#EF4444',
      reason: `Critical P1 defect open for ${Math.max(1, Math.floor(ageDays))} days without resolution.`,
      sla_hours: slaHours,
      hours_open: hoursOpen,
      is_breached: true
    };
  }

  if (isCritical && isUnassigned) {
    return {
      status: 'Attention Needed',
      badge: 'Unassigned Critical',
      label: 'Unassigned Critical',
      color: '#EF4444',
      reason: 'Critical severity defect has not yet been assigned to any developer.',
      sla_hours: slaHours,
      hours_open: hoursOpen,
      is_breached: isBreached
    };
  }

  if (isReopened) {
    return {
      status: 'Attention Needed',
      badge: 'Reopened',
      label: 'Reopened',
      color: '#F59E0B',
      reason: 'Verification failed or defect reopened; requires developer re-investigation.',
      sla_hours: slaHours,
      hours_open: hoursOpen,
      is_breached: isBreached
    };
  }

  if (isHigh && ageDays > 5) {
    return {
      status: 'At Risk',
      badge: 'Aging Defect',
      label: 'Aging Defect',
      color: '#F59E0B',
      reason: `High priority defect open for ${Math.floor(ageDays)} days.`,
      sla_hours: slaHours,
      hours_open: hoursOpen,
      is_breached: true
    };
  }

  if (isUnassigned && ageDays > 3) {
    return {
      status: 'Attention Needed',
      badge: 'Unassigned',
      label: 'Unassigned',
      color: '#F59E0B',
      reason: `Defect unassigned for ${Math.floor(ageDays)} days.`,
      sla_hours: slaHours,
      hours_open: hoursOpen,
      is_breached: isBreached
    };
  }

  return {
    status: 'Healthy',
    badge: 'On Track',
    label: 'On Track',
    color: '#3B82F6',
    reason: 'Defect is progressing within normal velocity thresholds.',
    sla_hours: slaHours,
    hours_open: hoursOpen,
    is_breached: false
  };
}

/**
 * GET /api/issues
 * Returns issues list with comprehensive filtering, optional pagination, and live stats.
 * Supports: project_id, status, priority, severity, component, category, environment, assignee_id, sprint_id, search/keyword, from_date, to_date, page, limit
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      project_id,
      status,
      priority,
      severity,
      component,
      category,
      environment,
      assignee_id,
      sprint_id,
      search,
      keyword,
      from_date,
      to_date,
      page,
      limit
    } = req.query;

    const searchTerm = (search || keyword || '').trim();

    let sql = `
      SELECT i.*, p.name as project_name, u.name as reporter_name, a.name as assignee_name, s.name as sprint_name,
             (SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id AND c.deleted_at IS NULL) as discussion_count
      FROM issues i 
      LEFT JOIN projects p ON i.project_id = p.id 
      LEFT JOIN users u ON i.reporter_id = u.id 
      LEFT JOIN users a ON i.assignee_id = a.id
      LEFT JOIN sprints s ON i.sprint_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND i.project_id = ?';
      params.push(parseInt(project_id, 10));
    }
    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND i.priority = ?';
      params.push(priority);
    }
    if (severity) {
      sql += ' AND i.severity = ?';
      params.push(severity);
    }
    if (component) {
      sql += ' AND i.component = ?';
      params.push(component);
    }
    if (category) {
      sql += ' AND i.category = ?';
      params.push(category);
    }
    if (environment) {
      sql += ' AND i.environment = ?';
      params.push(environment);
    }
    if (assignee_id) {
      sql += ' AND i.assignee_id = ?';
      params.push(parseInt(assignee_id, 10));
    }
    if (sprint_id) {
      sql += ' AND i.sprint_id = ?';
      params.push(parseInt(sprint_id, 10));
    }
    if (searchTerm) {
      sql += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    if (from_date) {
      sql += ' AND i.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND i.created_at <= ?';
      params.push(to_date);
    }

    sql += ' ORDER BY i.created_at DESC';

    // Pagination logic
    const isPaginated = page !== undefined || limit !== undefined;
    let paginatedIssues = [];
    let totalCount = 0;
    let pageNum = 1;
    let limitNum = 50;

    if (isPaginated) {
      pageNum = Math.max(1, parseInt(page, 10) || 1);
      limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      // Execute unpaginated query to get matching total
      const allMatching = await query(sql, params);
      totalCount = allMatching.length;
      paginatedIssues = allMatching.slice(offset, offset + limitNum);
    } else {
      paginatedIssues = await query(sql, params);
      totalCount = paginatedIssues.length;
    }

    // High-performance single aggregation query for system telemetry
    let stats = { total: 0, critical: 0, resolved: 0, inProgress: 0, verified: 0, reopened: 0 };
    try {
      const statsRow = await queryOne(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE severity = 'Critical' OR priority = 'P1') as critical,
          COUNT(*) FILTER (WHERE status = 'Resolved' OR status = 'Closed') as resolved,
          COUNT(*) FILTER (WHERE status = 'In Progress' OR status = 'In Review' OR status = 'Retest/Verify') as in_progress,
          COUNT(*) FILTER (WHERE status = 'Verified') as verified,
          COUNT(*) FILTER (WHERE status = 'Reopened') as reopened
        FROM issues
      `);
      if (statsRow) {
        stats = {
          total: parseInt(statsRow.total || 0, 10),
          critical: parseInt(statsRow.critical || 0, 10),
          resolved: parseInt(statsRow.resolved || 0, 10),
          inProgress: parseInt(statsRow.in_progress || 0, 10),
          verified: parseInt(statsRow.verified || 0, 10),
          reopened: parseInt(statsRow.reopened || 0, 10)
        };
      }
    } catch (e) {
      // Fallback for non-Postgres / local engine
      const allRaw = await query('SELECT status, severity, priority FROM issues');
      stats = {
        total: allRaw.length,
        critical: allRaw.filter(i => i.severity === 'Critical' || i.priority === 'P1').length,
        resolved: allRaw.filter(i => i.status === 'Resolved' || i.status === 'Closed').length,
        inProgress: allRaw.filter(i => i.status === 'In Progress' || i.status === 'In Review' || i.status === 'Retest/Verify').length,
        verified: allRaw.filter(i => i.status === 'Verified').length,
        reopened: allRaw.filter(i => i.status === 'Reopened').length
      };
    }

    // Component breakdown telemetry
    const componentStats = {};
    ALLOWED_COMPONENTS.filter(c => c !== 'General').forEach(c => { componentStats[c] = 0; });
    paginatedIssues.forEach(issue => {
      const comp = issue.component || 'Frontend UI';
      if (componentStats[comp] !== undefined) {
        componentStats[comp]++;
      }
    });

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    const enrichedIssues = paginatedIssues.map(issue => ({
      ...issue,
      defect_id: `DEF-${issue.id}`,
      health_indicator: computeDefectHealth(issue)
    }));

    res.json({
      success: true,
      issues: enrichedIssues,
      total: totalCount,
      page: isPaginated ? pageNum : 1,
      limit: isPaginated ? limitNum : totalCount,
      totalPages: isPaginated ? totalPages : 1,
      stats,
      componentStats
    });
  } catch (err) {
    console.error('Fetch issues error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch issues.', message: err.message });
  }
});

/**
 * POST /api/issues
 * Create a new defect with validation, classification defaults, and audit logging.
 */
router.post('/', authMiddleware, validateCreateIssue, async (req, res) => {
  try {
    const {
      project_id,
      sprint_id,
      title,
      description,
      type,
      priority,
      severity,
      status,
      component,
      category,
      environment,
      assignee_id
    } = req.body;

    const finalComponent = component || 'Frontend UI';
    const finalCategory = category || 'General';
    const finalEnvironment = environment || 'Production';

    let targetProjectId = project_id;
    if (!targetProjectId) {
      const defaultProj = await queryOne('SELECT id FROM projects LIMIT 1');
      if (defaultProj) {
        targetProjectId = defaultProj.id;
      } else {
        await query('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)', [
          'DefectX Core Platform',
          'Primary software defect tracking project',
          req.user.id
        ]);
        const createdProj = await queryOne('SELECT id FROM projects ORDER BY id DESC LIMIT 1');
        targetProjectId = createdProj.id;
      }
    }

    // Determine initial status (if assigned directly, transition to 'Assigned')
    let initStatus = status || 'Open';
    if (assignee_id && initStatus === 'Open') {
      initStatus = 'Assigned';
    }

    await query(
      `INSERT INTO issues (project_id, sprint_id, title, description, type, priority, severity, status, reporter_id, assignee_id, component, category, environment) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetProjectId,
        sprint_id || null,
        title.trim(),
        description.trim(),
        type || 'Bug',
        priority || 'P2',
        severity || 'Medium',
        initStatus,
        req.user.id,
        assignee_id || null,
        finalComponent,
        finalCategory,
        finalEnvironment
      ]
    );

    const newIssue = await queryOne(
      `SELECT i.*, p.name as project_name, u.name as reporter_name, a.name as assignee_name, s.name as sprint_name
       FROM issues i 
       LEFT JOIN projects p ON i.project_id = p.id 
       LEFT JOIN users u ON i.reporter_id = u.id 
       LEFT JOIN users a ON i.assignee_id = a.id
       LEFT JOIN sprints s ON i.sprint_id = s.id
       WHERE i.title = ? ORDER BY i.id DESC LIMIT 1`,
      [title.trim()]
    );

    if (newIssue) {
      // Record immutable creation activity
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [newIssue.id, req.user.id, 'Defect Created', null, `Status: ${initStatus} | Severity: ${newIssue.severity} | Priority: ${newIssue.priority} | Env: ${finalEnvironment}`]
      );

      // Trigger real-time notifications
      await notificationService.notifyIssueCreated(newIssue, req.user.id);
      if (assignee_id) {
        await notificationService.notifyIssueAssignee(assignee_id, newIssue, req.user.id);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Defect reported successfully',
      issue: newIssue
    });
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to report defect.', message: err.message });
  }
});

/**
 * GET /api/issues/:id
 * Retrieve a single defect with relational context, activity history, comments, and attachments.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    if (isNaN(issueId)) {
      return res.status(400).json({ success: false, error: 'Invalid issue ID format.' });
    }

    const issue = await queryOne(
      `SELECT i.*, p.name as project_name, u.name as reporter_name, s.name as sprint_name, a.name as assignee_name
       FROM issues i 
       LEFT JOIN projects p ON i.project_id = p.id 
       LEFT JOIN users u ON i.reporter_id = u.id
       LEFT JOIN sprints s ON i.sprint_id = s.id
       LEFT JOIN users a ON i.assignee_id = a.id
       WHERE i.id = ?`,
      [issueId]
    );

    if (!issue) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    // Fetch comments, history, attachments
    const comments = await query(
      `SELECT c.*, u.name as user_name 
       FROM comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.issue_id = ? AND c.deleted_at IS NULL 
       ORDER BY c.created_at ASC`,
      [issueId]
    );
    const history = await query(
      `SELECT h.*, u.name as user_name 
       FROM activity_history h 
       LEFT JOIN users u ON h.user_id = u.id 
       WHERE h.issue_id = ? 
       ORDER BY h.created_at DESC`,
      [issueId]
    );
    const attachments = await query(
      `SELECT a.*, u.name as uploader_name 
       FROM attachments a 
       LEFT JOIN users u ON a.uploader_id = u.id 
       WHERE a.issue_id = ? 
       ORDER BY a.created_at DESC`,
      [issueId]
    );

    const dependencies = await prismaService.getIssueDependencies(issueId);

    const enrichedIssue = {
      ...issue,
      defect_id: `DEF-${issue.id}`,
      health_indicator: computeDefectHealth(issue)
    };

    res.json({
      success: true,
      issue: enrichedIssue,
      comments: comments || [],
      history: history || [],
      attachments: attachments || [],
      dependencies: dependencies || []
    });
  } catch (err) {
    console.error('Get issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch issue details.', message: err.message });
  }
});

/**
 * GET /api/issues/:id/dependencies
 * Retrieve all incoming and outgoing dependency relationships for a defect.
 */
router.get('/:id/dependencies', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    if (isNaN(issueId)) {
      return res.status(400).json({ success: false, error: 'Invalid defect ID.' });
    }

    const dependencies = await prismaService.getIssueDependencies(issueId);
    res.json({
      success: true,
      defect_id: `DEF-${issueId}`,
      dependencies: dependencies || []
    });
  } catch (err) {
    console.error('Get dependencies error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dependencies.', message: err.message });
  }
});

/**
 * POST /api/issues/:id/dependencies
 * Create a new dependency relationship between two defects.
 * Types: 'Depends On' | 'Blocks' | 'Related To' | 'Caused By'
 */
router.post('/:id/dependencies', authMiddleware, validateDependency, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const rawRelated = req.body.related_issue_id || req.body.target_issue_id;
    const relationship_type = req.body.relationship_type;
    const relatedId = parseInt(rawRelated, 10);

    const targetIssue = await queryOne('SELECT id, title, status FROM issues WHERE id = ?', [issueId]);
    if (!targetIssue) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    const relatedIssue = await queryOne('SELECT id, title, status, severity, component FROM issues WHERE id = ?', [relatedId]);
    if (!relatedIssue) {
      return res.status(404).json({ success: false, error: `Target defect #${relatedId} not found.` });
    }

    const created = await prismaService.createIssueDependency(
      issueId,
      relatedId,
      relationship_type,
      req.user.id
    );

    // Record in activity history
    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [
        issueId,
        req.user.id,
        'Dependency Added',
        null,
        `${relationship_type} DEF-${relatedId} (${relatedIssue.title})`
      ]
    );

    // Also record on the related issue
    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [
        relatedId,
        req.user.id,
        'Dependency Linked',
        null,
        `Linked with DEF-${issueId} (${relationship_type})`
      ]
    );

    // Trigger notification if assigned
    await notificationService.notifyCommentAdded(
      targetIssue,
      `New dependency linked: ${relationship_type} DEF-${relatedId}`,
      req.user.id,
      req.user.name || 'System'
    );

    res.status(201).json({
      success: true,
      message: 'Defect dependency relationship created successfully.',
      dependency: created
    });
  } catch (err) {
    console.error('Create dependency error:', err);
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
});

/**
 * DELETE /api/issues/:id/dependencies/:depId
 * Remove a dependency relationship.
 */
router.delete('/:id/dependencies/:depId', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const depId = parseInt(req.params.depId, 10);

    if (isNaN(issueId) || isNaN(depId)) {
      return res.status(400).json({ success: false, error: 'Invalid defect or dependency ID.' });
    }

    const success = await prismaService.deleteIssueDependency(depId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Dependency relationship not found.' });
    }

    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [issueId, req.user.id, 'Dependency Removed', `Relationship #${depId}`, 'Deleted']
    );

    res.json({
      success: true,
      message: 'Defect dependency relationship removed successfully.'
    });
  } catch (err) {
    console.error('Delete dependency error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete dependency.', message: err.message });
  }
});

/**
 * GET /api/issues/:id/dependency-graph
 * Construct multi-hop dependency visual graph (nodes & edges) for interactive UI visualization.
 */
router.get('/:id/dependency-graph', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    if (isNaN(issueId)) {
      return res.status(400).json({ success: false, error: 'Invalid defect ID.' });
    }

    const graph = await prismaService.getDependencyGraph(issueId);
    res.json({
      success: true,
      root_id: issueId,
      defect_id: `DEF-${issueId}`,
      graph,
      nodes: graph?.nodes || [],
      edges: graph?.edges || []
    });
  } catch (err) {
    console.error('Get dependency graph error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate dependency graph.', message: err.message });
  }
});

/**
 * PUT /api/issues/:id
 * Update defect fields, transition lifecycle status, and record audit trail.
 */
router.put('/:id', authMiddleware, validateUpdateIssue, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const {
      title,
      description,
      type,
      priority,
      severity,
      status,
      project_id,
      sprint_id,
      assignee_id,
      component,
      category,
      environment,
      root_cause,
      resolution_notes,
      resolved_at
    } = req.body;

    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    // Status transition validation
    if (status && status !== existing.status) {
      if (!isValidTransition(existing.status, status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status transition from '${existing.status}' to '${status}'.`,
          message: `Invalid status transition from '${existing.status}' to '${status}'.`
        });
      }
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedDesc = description !== undefined ? description.trim() : existing.description;
    const updatedType = type !== undefined ? type : existing.type;
    const updatedPriority = priority !== undefined ? priority : existing.priority;
    const updatedSeverity = severity !== undefined ? severity : existing.severity;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedProjectId = project_id !== undefined ? parseInt(project_id, 10) : existing.project_id;
    const updatedSprintId = sprint_id !== undefined ? (sprint_id ? parseInt(sprint_id, 10) : null) : existing.sprint_id;
    const updatedAssigneeId = assignee_id !== undefined ? (assignee_id ? parseInt(assignee_id, 10) : null) : existing.assignee_id;
    const updatedComponent = component !== undefined ? component : existing.component;
    const updatedCategory = category !== undefined ? category : existing.category;
    const updatedEnvironment = environment !== undefined ? environment : existing.environment;
    const updatedRootCause = root_cause !== undefined ? root_cause : existing.root_cause;
    const updatedResolutionNotes = resolution_notes !== undefined ? resolution_notes : existing.resolution_notes;

    let finalResolvedAt = resolved_at !== undefined ? resolved_at : existing.resolved_at;
    if ((updatedStatus === 'Resolved' || updatedStatus === 'Verified' || updatedStatus === 'Closed') && !finalResolvedAt) {
      finalResolvedAt = new Date().toISOString();
    } else if (updatedStatus === 'Open' || updatedStatus === 'Assigned' || updatedStatus === 'In Progress' || updatedStatus === 'Reopened') {
      finalResolvedAt = null;
    }

    const updatedAt = new Date().toISOString();

    await query(
      `UPDATE issues 
       SET title = ?, description = ?, type = ?, priority = ?, severity = ?, status = ?, 
           project_id = ?, sprint_id = ?, assignee_id = ?, component = ?, category = ?, environment = ?, 
           root_cause = ?, resolution_notes = ?, resolved_at = ?, updated_at = ? 
       WHERE id = ?`,
      [
        updatedTitle,
        updatedDesc,
        updatedType,
        updatedPriority,
        updatedSeverity,
        updatedStatus,
        updatedProjectId,
        updatedSprintId,
        updatedAssigneeId,
        updatedComponent,
        updatedCategory || 'General',
        updatedEnvironment || 'Production',
        updatedRootCause || null,
        updatedResolutionNotes || null,
        finalResolvedAt,
        updatedAt,
        issueId
      ]
    );

    // Audit Logging
    if (status && status !== existing.status) {
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Status Changed', existing.status, status]
      );
      await notificationService.notifyIssueStatusChanged(
        { ...existing, id: issueId, title: updatedTitle },
        existing.status,
        status,
        req.user.id
      );
    }

    if (updatedAssigneeId !== existing.assignee_id) {
      const assigneeUser = updatedAssigneeId ? await queryOne('SELECT name FROM users WHERE id = ?', [updatedAssigneeId]) : null;
      const assigneeName = assigneeUser ? assigneeUser.name : 'Unassigned';
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Assignee Changed', existing.assignee_id ? `User #${existing.assignee_id}` : 'Unassigned', assigneeName]
      );
      if (updatedAssigneeId) {
        await notificationService.notifyIssueAssignee(updatedAssigneeId, { ...existing, id: issueId, title: updatedTitle }, req.user.id);
      }
    }

    if (updatedSeverity !== existing.severity) {
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Severity Changed', existing.severity, updatedSeverity]
      );
    }

    const updatedIssue = await queryOne(
      `SELECT i.*, p.name as project_name, u.name as reporter_name, a.name as assignee_name, s.name as sprint_name
       FROM issues i 
       LEFT JOIN projects p ON i.project_id = p.id 
       LEFT JOIN users u ON i.reporter_id = u.id 
       LEFT JOIN users a ON i.assignee_id = a.id
       LEFT JOIN sprints s ON i.sprint_id = s.id
       WHERE i.id = ?`,
      [issueId]
    );

    res.json({
      success: true,
      message: 'Defect updated successfully',
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Update issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to update defect.', message: err.message });
  }
});

/**
 * POST /api/issues/:id/resolve
 * Dedicated developer resolution endpoint requiring root cause and resolution explanation.
 */
router.post('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const { root_cause, resolution_notes } = req.body;

    if (!resolution_notes || resolution_notes.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Comprehensive resolution notes are required to resolve a defect (min 5 characters).',
        message: 'Comprehensive resolution notes are required to resolve a defect (min 5 characters).'
      });
    }

    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    const resolvedAt = new Date().toISOString();
    const finalRootCause = root_cause ? root_cause.trim() : (existing.root_cause || 'Identified and corrected underlying component failure');

    await query(
      `UPDATE issues 
       SET status = 'Resolved', root_cause = ?, resolution_notes = ?, resolved_at = ?, updated_at = ? 
       WHERE id = ?`,
      [finalRootCause, resolution_notes.trim(), resolvedAt, resolvedAt, issueId]
    );

    // Record in activity history
    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [issueId, req.user.id, 'Defect Resolved', existing.status, `Resolved: ${resolution_notes.trim().slice(0, 100)}`]
    );

    // Save formal resolution notes in discussions
    await query(
      'INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)',
      [
        issueId,
        req.user.id,
        `### ✅ Resolution Submitted by Developer\n**Root Cause:** ${finalRootCause}\n\n**Resolution:** ${resolution_notes.trim()}\n\n*Awaiting QA / Tester verification.*`
      ]
    );

    const updatedIssue = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    await notificationService.notifyIssueStatusChanged(updatedIssue, existing.status, 'Resolved', req.user.id);

    res.json({
      success: true,
      message: 'Defect marked as Resolved. QA verification pending.',
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Resolve issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to resolve defect.', message: err.message });
  }
});

/**
 * POST /api/issues/:id/verify
 * Dedicated tester verification endpoint.
 * Accepts: { status: 'Verified' | 'Closed' | 'Reopened', notes, test_result: 'Passed' | 'Failed' }
 */
router.post('/:id/verify', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const { status = 'Verified', notes = '', test_result = 'Passed' } = req.body;

    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    if (!['Verified', 'Closed', 'Reopened'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Verification target status must be 'Verified', 'Closed', or 'Reopened'."
      });
    }

    // If reopening due to failed verification, require explanation
    if (status === 'Reopened' && (!notes || notes.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        error: 'Reason and reproduction notes are required when reopening a defect.',
        message: 'Reason and reproduction notes are required when reopening a defect.'
      });
    }

    const now = new Date().toISOString();

    if (status === 'Reopened') {
      await query(
        `UPDATE issues SET status = 'Reopened', updated_at = ? WHERE id = ?`,
        [now, issueId]
      );

      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Verification Failed (Reopened)', existing.status, `Reopened: ${notes.trim().slice(0, 100)}`]
      );

      await query(
        'INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)',
        [
          issueId,
          req.user.id,
          `### ❌ QA Verification Failed — Defect Reopened\n**Test Outcome:** Failed\n\n**Findings:** ${notes.trim()}\n\n*Assigned developer please re-investigate root cause and apply patch.*`
        ]
      );
    } else {
      await query(
        `UPDATE issues SET status = ?, updated_at = ? WHERE id = ?`,
        [status, now, issueId]
      );

      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, `Defect ${status}`, existing.status, `Verified by QA: ${notes.trim() || 'All test cases passed.'}`]
      );

      await query(
        'INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)',
        [
          issueId,
          req.user.id,
          `### 🎯 QA Verification Passed\n**Status:** \`${status}\`\n**Test Outcome:** ${test_result}\n\n**Verification Notes:** ${notes.trim() || 'Verified successfully against regression test criteria.'}`
        ]
      );
    }

    const updatedIssue = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    await notificationService.notifyIssueStatusChanged(updatedIssue, existing.status, status, req.user.id);

    res.json({
      success: true,
      message: `Defect status transitioned to '${status}' successfully.`,
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Verify issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to complete verification.', message: err.message });
  }
});

/**
 * POST /api/issues/:id/reopen
 * Reopen a resolved or closed defect with explicit justification.
 */
router.post('/:id/reopen', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const { reason = '' } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A detailed reason is required to reopen a defect (min 5 characters).',
        message: 'A detailed reason is required to reopen a defect (min 5 characters).'
      });
    }

    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    const now = new Date().toISOString();
    await query(
      `UPDATE issues SET status = 'Reopened', updated_at = ? WHERE id = ?`,
      [now, issueId]
    );

    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [issueId, req.user.id, 'Defect Reopened', existing.status, `Reopened: ${reason.trim().slice(0, 100)}`]
    );

    await query(
      'INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)',
      [
        issueId,
        req.user.id,
        `### 🔄 Defect Reopened\n**Reason:** ${reason.trim()}\n\n*Reopened from state \`${existing.status}\`.*`
      ]
    );

    const updatedIssue = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    await notificationService.notifyIssueStatusChanged(updatedIssue, existing.status, 'Reopened', req.user.id);

    res.json({
      success: true,
      message: 'Defect reopened successfully.',
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Reopen issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to reopen defect.', message: err.message });
  }
});

/**
 * DELETE /api/issues/:id
 * Delete a defect. Restricted to Admin and Project Manager roles.
 */
router.delete('/:id', authMiddleware, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    await query('DELETE FROM issues WHERE id = ?', [issueId]);
    res.json({ success: true, message: `Defect #${issueId} deleted successfully.` });
  } catch (err) {
    console.error('Delete issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete defect.', message: err.message });
  }
});

/**
 * POST /api/issues/:id/comments
 * Add a discussion comment with validation and notifications.
 */
router.post('/:id/comments', authMiddleware, validateComment, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const { content } = req.body;

    const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!issue) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    await query('INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)', [
      issueId,
      req.user.id,
      content.trim()
    ]);

    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [issueId, req.user.id, 'Comment Added', null, content.trim().slice(0, 60)]
    );

    const user = await queryOne('SELECT name FROM users WHERE id = ?', [req.user.id]);
    await notificationService.notifyCommentAdded(issue, content.trim(), req.user.id, user ? user.name : 'Team Member');

    res.status(201).json({ success: true, message: 'Comment added successfully.' });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ success: false, error: 'Failed to add comment.', message: err.message });
  }
});

/**
 * POST /api/issues/:id/attachments
 * Upload or register a defect attachment.
 */
router.post('/:id/attachments', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const { file_name, file_url } = req.body;

    if (!file_name || !file_url) {
      return res.status(400).json({ success: false, error: 'File name and file URL are required.' });
    }

    await query(
      'INSERT INTO attachments (issue_id, uploader_id, file_name, file_url) VALUES (?, ?, ?, ?)',
      [issueId, req.user.id, file_name, file_url]
    );

    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [issueId, req.user.id, 'Attachment Uploaded', null, file_name]
    );

    res.status(201).json({ success: true, message: 'Attachment registered successfully.' });
  } catch (err) {
    console.error('Attachment error:', err);
    res.status(500).json({ success: false, error: 'Failed to add attachment.', message: err.message });
  }
});

/**
 * GET /api/issues/:id/similar
 * Returns similar defects in the repository for a given defect ID.
 */
router.get('/:id/similar', authMiddleware, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!issue) {
      return res.status(404).json({ success: false, error: `Defect #${issueId} not found.` });
    }

    const otherIssues = await query(
      'SELECT id, title, description, status, priority, severity, component, root_cause, resolution_notes FROM issues WHERE id != ? LIMIT 100',
      [issueId]
    );

    const stopWords = new Set(['the','is','in','at','of','on','and','a','to','it','for','with','as','by','this','that','an','are','was','were','be','been','being','have','has','had','not','when','from','or','which']);
    const getTokens = (str) => (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

    const qTokens = getTokens(`${issue.title} ${issue.description || ''}`);

    const matches = otherIssues.map(other => {
      const oTokens = getTokens(`${other.title} ${other.description || ''}`);
      if (oTokens.length === 0 || qTokens.length === 0) return null;

      const tf1 = {}, tf2 = {};
      qTokens.forEach(t => tf1[t] = (tf1[t] || 0) + 1);
      oTokens.forEach(t => tf2[t] = (tf2[t] || 0) + 1);

      const allTokens = Array.from(new Set([...qTokens, ...oTokens]));
      let dot = 0, m1 = 0, m2 = 0;
      allTokens.forEach(t => {
        const v1 = tf1[t] || 0;
        const v2 = tf2[t] || 0;
        dot += v1 * v2;
        m1 += v1 * v1;
        m2 += v2 * v2;
      });

      const score = (m1 > 0 && m2 > 0) ? dot / (Math.sqrt(m1) * Math.sqrt(m2)) : 0;
      const normalized = Math.min(0.99, Math.round(score * 100) / 100);

      // Same component bonus
      const componentBonus = other.component === issue.component ? 0.15 : 0;
      const finalSimilarity = Math.min(0.98, Math.round((normalized + componentBonus) * 100) / 100);

      let similarityLevel = 'Low';
      if (finalSimilarity >= 0.70) similarityLevel = 'High';
      else if (finalSimilarity >= 0.45) similarityLevel = 'Medium';

      return {
        id: other.id,
        defect_id: `DEF-${other.id}`,
        title: other.title,
        description: other.description ? other.description.slice(0, 130) + '...' : '',
        status: other.status,
        priority: other.priority,
        severity: other.severity,
        component: other.component,
        similarity: finalSimilarity,
        similarity_level: similarityLevel,
        root_cause: other.root_cause || null,
        resolution_notes: other.resolution_notes || null
      };
    })
    .filter(m => m && m.similarity >= 0.30)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

    res.json({
      success: true,
      similar_defects: matches
    });
  } catch (err) {
    console.error('Similar issues error:', err);
    res.status(500).json({ success: false, error: 'Failed to find similar defects.', message: err.message });
  }
});

/**
 * POST /api/issues/check-duplicates
 * Analyze pending title/description against existing defect database.
 */
router.post('/check-duplicates', authMiddleware, async (req, res) => {
  try {
    const { title, description, project_id, projectId } = req.body;
    const targetProject = project_id || projectId;

    let sql = 'SELECT id, title, description, status, priority, severity, component, root_cause, resolution_notes, created_at, project_id FROM issues';
    const params = [];
    if (targetProject) {
      sql += ' WHERE project_id = ?';
      params.push(targetProject);
    }
    sql += ' ORDER BY id DESC LIMIT 100';

    const allIssues = await query(sql, params);
    const queryText = ((title || '') + ' ' + (description || '')).toLowerCase();

    const stopWords = new Set(['the','is','in','at','of','on','and','a','to','it','for','with','as','by','this','that','an','are','was','were','be','been','being','have','has','had','not','when','from','or','which']);
    const synonyms = {
      'api': 'backend', 'endpoint': 'backend', 'server': 'backend', 'service': 'backend',
      'ui': 'frontend', 'button': 'frontend', 'display': 'frontend', 'view': 'frontend', 'screen': 'frontend', 'click': 'frontend',
      'crash': 'error', 'fails': 'error', 'broken': 'error', 'exception': 'error', 'issue': 'error', 'bug': 'error', 'failure': 'error',
      'fast': 'performance', 'slow': 'performance', 'delay': 'performance', 'loading': 'performance', 'spinning': 'performance',
      'payment': 'billing', 'charge': 'billing', 'transaction': 'billing', 'checkout': 'billing', 'card': 'billing',
      'login': 'auth', 'signin': 'auth', 'password': 'auth', 'jwt': 'auth', 'token': 'auth',
      'twice': 'duplicate', 'double': 'duplicate', 'multiple': 'duplicate'
    };

    const getTokens = (str) => {
      return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
        .map(w => synonyms[w] || w);
    };

    const qTokens = getTokens(queryText);
    if (qTokens.length === 0) {
      return res.json({ hasDuplicates: false, matches: [], duplicates: [] });
    }

    const matches = allIssues.map(issue => {
      const iTokens = getTokens(issue.title + ' ' + (issue.description || ''));
      if (iTokens.length === 0) return null;

      const tf1 = {}, tf2 = {};
      qTokens.forEach(t => tf1[t] = (tf1[t] || 0) + 1);
      iTokens.forEach(t => tf2[t] = (tf2[t] || 0) + 1);

      const allTokens = Array.from(new Set([...qTokens, ...iTokens]));
      let dot = 0, m1 = 0, m2 = 0;
      allTokens.forEach(t => {
        const v1 = tf1[t] || 0;
        const v2 = tf2[t] || 0;
        dot += v1 * v2;
        m1 += v1 * v1;
        m2 += v2 * v2;
      });

      const score = (m1 > 0 && m2 > 0) ? dot / (Math.sqrt(m1) * Math.sqrt(m2)) : 0;
      const normalized = Math.min(0.98, Math.round(score * 100) / 100);

      let similarityLevel = 'Low';
      if (normalized >= 0.70) similarityLevel = 'High';
      else if (normalized >= 0.45) similarityLevel = 'Medium';

      return {
        issueId: issue.id,
        id: issue.id,
        defect_id: `DEF-${issue.id}`,
        title: issue.title,
        description: issue.description ? issue.description.slice(0, 130) + (issue.description.length > 130 ? '...' : '') : '',
        status: issue.status,
        priority: issue.priority,
        severity: issue.severity,
        component: issue.component,
        created_at: issue.created_at,
        similarityScore: normalized,
        similarity: normalized,
        similarity_level: similarityLevel,
        root_cause: issue.root_cause || null,
        resolution_notes: issue.resolution_notes || null,
        related_information: issue.resolution_notes ? `Previous fix: ${issue.resolution_notes.slice(0, 100)}` : `Existing repository defect (${issue.status})`
      };
    }).filter(i => i && i.similarity >= 0.35)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    res.json({
      success: true,
      hasDuplicates: matches.length > 0,
      matches,
      duplicates: matches
    });
  } catch (err) {
    console.error('Check duplicates error:', err);
    res.status(500).json({ success: false, error: 'Failed to check duplicates.', message: err.message });
  }
});

module.exports = router;
