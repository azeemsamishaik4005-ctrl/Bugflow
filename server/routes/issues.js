const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Helper for state transition validation
const validateStateTransition = (oldStatus, newStatus) => {
  if (oldStatus === newStatus) return true;
  
  const validTransitions = {
    'Open': ['In Progress', 'Resolved'], // allow closing immediately
    'In Progress': ['In Review', 'Open'],
    'In Review': ['Resolved', 'In Progress'],
    'Resolved': ['Open'] // allow reopening
  };
  
  if (!validTransitions[oldStatus] || !validTransitions[oldStatus].includes(newStatus)) {
    return false;
  }
  return true;
};

// Get summary stats & list of issues
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { project_id, status, priority, severity, component, search } = req.query;

    let sql = `
      SELECT i.*, p.name as project_name, u.name as reporter_name, a.name as assignee_name,
             (SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id AND c.deleted_at IS NULL) as discussion_count
      FROM issues i 
      LEFT JOIN projects p ON i.project_id = p.id 
      LEFT JOIN users u ON i.reporter_id = u.id 
      LEFT JOIN users a ON i.assignee_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND i.project_id = ?';
      params.push(project_id);
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
    if (search) {
      sql += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY i.created_at DESC';

    const issues = await query(sql, params);

    // Calculate Summary Stats
    const totalResult = await queryOne('SELECT COUNT(*) as count FROM issues');
    const criticalResult = await queryOne("SELECT COUNT(*) as count FROM issues WHERE severity = 'Critical'");
    const resolvedResult = await queryOne("SELECT COUNT(*) as count FROM issues WHERE status = 'Resolved'");
    const inProgressResult = await queryOne("SELECT COUNT(*) as count FROM issues WHERE status = 'In Progress'");

    const stats = {
      total: totalResult ? parseInt(totalResult.count, 10) : 0,
      critical: criticalResult ? parseInt(criticalResult.count, 10) : 0,
      resolved: resolvedResult ? parseInt(resolvedResult.count, 10) : 0,
      inProgress: inProgressResult ? parseInt(inProgressResult.count, 10) : 0
    };

    // Calculate component stats
    const componentStats = {};
    const allComponents = [
      "Authentication", "Billing & Payments", "API & Backend", "Frontend UI", 
      "Database", "Mobile & Responsive", "Performance & Memory", "Security"
    ];
    allComponents.forEach(c => componentStats[c] = 0);
    
    issues.forEach(issue => {
      const comp = issue.component || 'Frontend UI';
      if (componentStats[comp] !== undefined) {
        componentStats[comp]++;
      }
    });

    res.json({ issues, stats, componentStats });
  } catch (err) {
    console.error('Fetch issues error:', err);
    res.status(500).json({ error: 'Failed to fetch issues.' });
  }
});

// Create an issue
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { project_id, sprint_id, title, description, type, priority, severity, status, component } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    const validComponents = [
      "Authentication", "Billing & Payments", "API & Backend", "Frontend UI", 
      "Database", "Mobile & Responsive", "Performance & Memory", "Security"
    ];

    const finalComponent = component && validComponents.includes(component) ? component : 'Frontend UI';

    let targetProjectId = project_id;
    if (!targetProjectId) {
      const defaultProj = await queryOne('SELECT id FROM projects LIMIT 1');
      if (defaultProj) {
        targetProjectId = defaultProj.id;
      } else {
        await query('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)', ['Main Project', 'Default Project', req.user.id]);
        const createdProj = await queryOne('SELECT id FROM projects ORDER BY id DESC LIMIT 1');
        targetProjectId = createdProj.id;
      }
    }

    const initStatus = status || 'Open';
    
    await query(
      `INSERT INTO issues (project_id, sprint_id, title, description, type, priority, severity, status, reporter_id, assignee_id, component) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetProjectId,
        sprint_id || null,
        title,
        description,
        type || 'Bug',
        priority || 'P2',
        severity || 'Medium',
        initStatus,
        req.user.id,
        req.body.assignee_id || null,
        finalComponent
      ]
    );

    const newIssue = await queryOne(
      `SELECT i.*, p.name as project_name, u.name as reporter_name, a.name as assignee_name
       FROM issues i 
       LEFT JOIN projects p ON i.project_id = p.id 
       LEFT JOIN users u ON i.reporter_id = u.id 
       LEFT JOIN users a ON i.assignee_id = a.id
       WHERE i.title = ? ORDER BY i.id DESC LIMIT 1`,
      [title]
    );

    // Log Activity History
    if (newIssue) {
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [newIssue.id, req.user.id, 'Issue Created', null, `Status: ${initStatus}`]
      );
      
      // Trigger Notification
      await notificationService.notifyIssueCreated(newIssue, req.user.id);
    }

    res.status(201).json({ message: 'Issue reported successfully', issue: newIssue });
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ error: 'Failed to report issue.' });
  }
});

// Get single issue by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const issueId = req.params.id;
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
      return res.status(404).json({ error: 'Issue not found.' });
    }

    // Fetch comments, history, attachments
    const comments = await query('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC', [issueId]);
    const history = await query('SELECT * FROM activity_history WHERE issue_id = ? ORDER BY created_at DESC', [issueId]);
    const attachments = await query('SELECT * FROM attachments WHERE issue_id = ? ORDER BY created_at DESC', [issueId]);

    res.json({ issue, comments, history, attachments });
  } catch (err) {
    console.error('Get issue error:', err);
    res.status(500).json({ error: 'Failed to fetch issue details.' });
  }
});

// Update issue
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, type, priority, severity, status, project_id, sprint_id, assignee_id, component } = req.body;
    const issueId = req.params.id;

    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    const validComponents = [
      "Authentication", "Billing & Payments", "API & Backend", "Frontend UI", 
      "Database", "Mobile & Responsive", "Performance & Memory", "Security"
    ];

    if (component && !validComponents.includes(component)) {
      return res.status(400).json({ error: 'Invalid component.' });
    }

    // Status transition check
    if (status && status !== existing.status) {
      if (!validateStateTransition(existing.status, status)) {
        return res.status(400).json({ error: `Invalid status transition from ${existing.status} to ${status}` });
      }
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedType = type !== undefined ? type : existing.type;
    const updatedPriority = priority !== undefined ? priority : existing.priority;
    const updatedSeverity = severity !== undefined ? severity : existing.severity;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedProjectId = project_id !== undefined ? project_id : existing.project_id;
    const updatedSprintId = sprint_id !== undefined ? sprint_id : existing.sprint_id;
    const updatedAssigneeId = assignee_id !== undefined ? assignee_id : existing.assignee_id;
    const updatedComponent = component !== undefined ? component : existing.component;
    const updatedAt = new Date().toISOString();

    await query(
      `UPDATE issues 
       SET title = ?, description = ?, type = ?, priority = ?, severity = ?, status = ?, project_id = ?, sprint_id = ?, assignee_id = ?, component = ?, updated_at = ? 
       WHERE id = ?`,
      [updatedTitle, updatedDesc, updatedType, updatedPriority, updatedSeverity, updatedStatus, updatedProjectId, updatedSprintId || null, updatedAssigneeId || null, updatedComponent, updatedAt, issueId]
    );

    // Log Activity History if status changed
    if (status && status !== existing.status) {
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Status Changed', existing.status, status]
      );
    } 
    
    if (updatedAssigneeId !== existing.assignee_id) {
      const assigneeUser = await queryOne('SELECT name FROM users WHERE id = ?', [updatedAssigneeId]);
      const assigneeName = assigneeUser ? assigneeUser.name : 'Unassigned';
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Assignee Changed', null, assigneeName]
      );
    } else if (updatedSeverity !== existing.severity) {
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Severity Changed', existing.severity, updatedSeverity]
      );
    } else if (updatedComponent !== existing.component) {
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Component Changed', existing.component, updatedComponent]
      );
    } else if (!status || status === existing.status) {
      // If neither status, assignee, nor severity changed, just log a general update.
      await query(
        `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
        [issueId, req.user.id, 'Issue Updated', null, null]
      );
    }

    const updatedIssue = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    
    // Trigger Notifications
    if (status && status !== existing.status) {
      await notificationService.notifyIssueStatusChanged(updatedIssue, existing.status, status, req.user.id);
    }
    if (updatedAssigneeId !== existing.assignee_id && updatedAssigneeId) {
      await notificationService.notifyIssueAssignee(updatedAssigneeId, updatedIssue, req.user.id);
    }
    if (updatedSeverity !== existing.severity) {
      await notificationService.notifyIssueSeverityChanged(updatedIssue, existing.severity, updatedSeverity, req.user.id);
    }
    if (updatedPriority !== existing.priority) {
      await notificationService.notifyIssuePriorityChanged(updatedIssue, existing.priority, updatedPriority, req.user.id);
    }

    res.json({ message: 'Issue updated successfully', issue: updatedIssue });
  } catch (err) {
    console.error('Update issue error:', err);
    res.status(500).json({ error: 'Failed to update issue.' });
  }
});

// Delete issue
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const issueId = req.params.id;
    const existing = await queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    await query('DELETE FROM issues WHERE id = ?', [issueId]);
    res.json({ message: 'Issue deleted successfully.' });
  } catch (err) {
    console.error('Delete issue error:', err);
    res.status(500).json({ error: 'Failed to delete issue.' });
  }
});

// Add comment
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Comment content is required' });
    
    await query('INSERT INTO comments (issue_id, user_id, content) VALUES (?, ?, ?)', [req.params.id, req.user.id, content]);
    
    // Activity log
    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, 'Added Comment', null, null]
    );

    // Trigger Notification
    const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
    const user = await queryOne('SELECT name FROM users WHERE id = ?', [req.user.id]);
    if (issue && user) {
      await notificationService.notifyCommentAdded(issue, content, req.user.id, user.name);
    }

    res.status(201).json({ message: 'Comment added successfully' });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// Add attachment (mock)
router.post('/:id/attachments', authMiddleware, async (req, res) => {
  try {
    const { file_name, file_url } = req.body;
    if (!file_name || !file_url) return res.status(400).json({ error: 'File info is required' });
    
    await query('INSERT INTO attachments (issue_id, uploader_id, file_name, file_url) VALUES (?, ?, ?, ?)', [req.params.id, req.user.id, file_name, file_url]);
    
    await query(
      `INSERT INTO activity_history (issue_id, user_id, action, old_state, new_state) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, 'Uploaded Attachment', null, file_name]
    );

    res.status(201).json({ message: 'Attachment added successfully' });
  } catch (err) {
    console.error('Attachment error:', err);
    res.status(500).json({ error: 'Failed to add attachment.' });
  }
});

// Check duplicates endpoint on issues route
router.post('/check-duplicates', authMiddleware, async (req, res) => {
  try {
    const { title, description, project_id, projectId } = req.body;
    const targetProject = project_id || projectId;
    
    let sql = 'SELECT id, title, description, status, priority, severity, created_at, project_id FROM issues';
    const params = [];
    if (targetProject) {
      sql += ' WHERE project_id = ?';
      params.push(targetProject);
    }
    sql += ' ORDER BY id DESC LIMIT 50';

    const allIssues = await query(sql, params);
    const queryText = (title + ' ' + (description || '')).toLowerCase();

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
      if (iTokens.length === 0) return { ...issue, similarityScore: 0, similarity: 0 };

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

      return {
        issueId: issue.id,
        id: issue.id,
        title: issue.title,
        description: issue.description ? issue.description.slice(0, 120) + (issue.description.length > 120 ? '...' : '') : '',
        status: issue.status,
        priority: issue.priority,
        severity: issue.severity,
        created_at: issue.created_at,
        similarityScore: normalized,
        similarity: normalized,
        related_information: `Existing match in repository (${issue.status})`
      };
    }).filter(i => i.similarity >= 0.35)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    res.json({
      hasDuplicates: matches.length > 0,
      matches,
      duplicates: matches
    });
  } catch (err) {
    console.error('Check duplicates error:', err);
    res.status(500).json({ error: 'Failed to check duplicates.' });
  }
});

module.exports = router;
