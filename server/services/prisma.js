/**
 * DefectX Prisma & PostgreSQL Service
 * Provides access to PostgreSQL database via Prisma ORM with seamless pg fallback.
 */
const { query, queryOne } = require('../db');

let prisma = null;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient({
    log: ['error', 'warn']
  });
} catch (err) {
  console.warn('Prisma Client not yet initialized, using direct PostgreSQL driver pool.');
}

// 1. Get all issues with relational data (Project, Assignee, Reporter)
async function getAllIssues() {
  if (prisma) {
    try {
      const issues = await prisma.issue.findMany({
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, role: true } },
          reporter: { select: { id: true, name: true, email: true } },
          sprint: { select: { id: true, name: true, status: true } }
        },
        orderBy: { id: 'desc' }
      });

      return issues.map(i => ({
        ...i,
        project_name: i.project ? i.project.name : null,
        assignee_name: i.assignee ? i.assignee.name : null,
        reporter_name: i.reporter ? i.reporter.name : null,
        sprint_name: i.sprint ? i.sprint.name : null
      }));
    } catch (err) {
      console.warn('Prisma getAllIssues failed, falling back to direct PostgreSQL query:', err.message);
    }
  }

  return await query(`
    SELECT i.*, p.name as project_name, u.name as assignee_name, r.name as reporter_name, s.name as sprint_name
    FROM issues i
    LEFT JOIN projects p ON i.project_id = p.id
    LEFT JOIN users u ON i.assignee_id = u.id
    LEFT JOIN users r ON i.reporter_id = r.id
    LEFT JOIN sprints s ON i.sprint_id = s.id
    ORDER BY i.id DESC
  `);
}

// 2. Get specific issue by ID with comments and history
async function getIssueById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  if (prisma) {
    try {
      const issue = await prisma.issue.findUnique({
        where: { id: numId },
        include: {
          project: true,
          assignee: { select: { id: true, name: true, email: true, role: true } },
          reporter: { select: { id: true, name: true, email: true } },
          sprint: true,
          comments: {
            where: { deleted_at: null },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { created_at: 'asc' }
          },
          testCases: true
        }
      });

      if (issue) {
        return {
          ...issue,
          project_name: issue.project ? issue.project.name : null,
          assignee_name: issue.assignee ? issue.assignee.name : null,
          reporter_name: issue.reporter ? issue.reporter.name : null,
          sprint_name: issue.sprint ? issue.sprint.name : null
        };
      }
    } catch (err) {
      console.warn('Prisma getIssueById failed, using direct query:', err.message);
    }
  }

  const issue = await queryOne(`
    SELECT i.*, p.name as project_name, u.name as assignee_name, r.name as reporter_name, s.name as sprint_name
    FROM issues i
    LEFT JOIN projects p ON i.project_id = p.id
    LEFT JOIN users u ON i.assignee_id = u.id
    LEFT JOIN users r ON i.reporter_id = r.id
    LEFT JOIN sprints s ON i.sprint_id = s.id
    WHERE i.id = ?
  `, [numId]);

  if (!issue) return null;

  const comments = await query(`
    SELECT c.*, u.name as user_name
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.issue_id = ? AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
  `, [numId]);

  issue.comments = comments;
  return issue;
}

// 3. Get live system telemetry
async function getTelemetry() {
  const issues = await getAllIssues();
  return {
    total: issues.length,
    critical: issues.filter(i => i.priority === 'P1' || i.severity === 'Critical').length,
    open: issues.filter(i => i.status === 'Open').length,
    in_progress: issues.filter(i => i.status === 'In Progress' || i.status === 'Retest/Verify').length,
    resolved: issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length
  };
}

// 4. Get all projects
async function getAllProjects() {
  if (prisma) {
    try {
      return await prisma.project.findMany({
        orderBy: { id: 'asc' }
      });
    } catch (err) {
      console.warn('Prisma getAllProjects error, using direct query:', err.message);
    }
  }
  return await query('SELECT * FROM projects ORDER BY id ASC');
}

// 5. Get all sprints
async function getAllSprints() {
  if (prisma) {
    try {
      return await prisma.sprint.findMany({
        orderBy: { id: 'desc' }
      });
    } catch (err) {
      console.warn('Prisma getAllSprints error, using direct query:', err.message);
    }
  }
  return await query('SELECT * FROM sprints ORDER BY id DESC');
}

// 6. Get all users for workload
async function getAllUsers() {
  if (prisma) {
    try {
      return await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true }
      });
    } catch (err) {
      console.warn('Prisma getAllUsers error, using direct query:', err.message);
    }
  }
  return await query('SELECT id, name, email, role FROM users ORDER BY name ASC');
}

// 7. Get comments for context
async function getAllComments(limit = 200) {
  if (prisma) {
    try {
      return await prisma.comment.findMany({
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: { id: true, issue_id: true, content: true, user_id: true, created_at: true }
      });
    } catch (err) {
      console.warn('Prisma getAllComments error, using direct query:', err.message);
    }
  }
  return await query('SELECT issue_id, content, user_id FROM comments WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?', [limit]);
}

// 8. Get Defect Dependencies
async function getIssueDependencies(issueId) {
  const numId = parseInt(issueId, 10);
  if (isNaN(numId)) return [];

  return await query(`
    SELECT d.*, 
           i1.title as issue_title, i1.status as issue_status,
           i2.title as related_title, i2.status as related_status, i2.severity as related_severity, i2.priority as related_priority, i2.component as related_component,
           u.name as creator_name
    FROM defect_dependencies d
    LEFT JOIN issues i1 ON d.issue_id = i1.id
    LEFT JOIN issues i2 ON d.related_issue_id = i2.id
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.issue_id = ? OR d.related_issue_id = ?
    ORDER BY d.id DESC
  `, [numId, numId]);
}

// 9. Create Defect Dependency
async function createIssueDependency(issueId, relatedIssueId, relationshipType, userId) {
  const iId = parseInt(issueId, 10);
  const rId = parseInt(relatedIssueId, 10);
  if (isNaN(iId) || isNaN(rId) || iId === rId) {
    throw new Error('Invalid issue IDs for dependency relation.');
  }

  // Check if exists
  const existing = await query(`
    SELECT * FROM defect_dependencies 
    WHERE (issue_id = ? AND related_issue_id = ?) OR (issue_id = ? AND related_issue_id = ?)
  `, [iId, rId, rId, iId]);

  if (existing && existing.length > 0) {
    throw new Error('A relationship between these two defects already exists.');
  }

  await query(
    'INSERT INTO defect_dependencies (issue_id, related_issue_id, relationship_type, created_by) VALUES (?, ?, ?, ?)',
    [iId, rId, relationshipType, userId || null]
  );

  const created = await queryOne(`
    SELECT d.*, 
           i1.title as issue_title, i1.status as issue_status,
           i2.title as related_title, i2.status as related_status, i2.severity as related_severity, i2.priority as related_priority, i2.component as related_component,
           u.name as creator_name
    FROM defect_dependencies d
    LEFT JOIN issues i1 ON d.issue_id = i1.id
    LEFT JOIN issues i2 ON d.related_issue_id = i2.id
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.issue_id = ? AND d.related_issue_id = ?
    ORDER BY d.id DESC LIMIT 1
  `, [iId, rId]);

  return created;
}

// 10. Delete Defect Dependency
async function deleteIssueDependency(depId) {
  const dId = parseInt(depId, 10);
  if (isNaN(dId)) return false;
  const res = await query('DELETE FROM defect_dependencies WHERE id = ?', [dId]);
  return res && res.changes !== 0;
}

// 11. Construct Visual Dependency Graph
async function getDependencyGraph(issueId) {
  const rootId = parseInt(issueId, 10);
  if (isNaN(rootId)) return { nodes: [], edges: [] };

  // Fetch all dependencies connected to the root issue or its direct neighbors
  const directDeps = await getIssueDependencies(rootId);
  const nodeIds = new Set([rootId]);
  
  directDeps.forEach(d => {
    nodeIds.add(d.issue_id);
    nodeIds.add(d.related_issue_id);
  });

  // Expand one level deeper to capture multi-hop dependencies
  const allDeps = [];
  const visitedDepIds = new Set();

  for (const nId of Array.from(nodeIds)) {
    const neighborDeps = await getIssueDependencies(nId);
    neighborDeps.forEach(nd => {
      if (!visitedDepIds.has(nd.id)) {
        visitedDepIds.add(nd.id);
        allDeps.push(nd);
        nodeIds.add(nd.issue_id);
        nodeIds.add(nd.related_issue_id);
      }
    });
  }

  // Fetch defect info for all collected node IDs
  const allIssues = await getAllIssues();
  const nodes = Array.from(nodeIds).map(id => {
    const iss = allIssues.find(i => i.id === id);
    if (!iss) return { id, label: `DEF-${id}`, status: 'Unknown', severity: 'Medium', isRoot: id === rootId };
    return {
      id: iss.id,
      label: `DEF-${iss.id}`,
      title: iss.title,
      status: iss.status,
      severity: iss.severity,
      priority: iss.priority,
      component: iss.component,
      isRoot: iss.id === rootId
    };
  });

  const edges = allDeps.map(d => ({
    id: `edge-${d.id}`,
    depId: d.id,
    from: d.issue_id,
    to: d.related_issue_id,
    type: d.relationship_type,
    label: d.relationship_type
  }));

  return { nodes, edges };
}

// 12. Component Historical Defect Lookup (for Regression Risk Detection)
async function getHistoricalDefectsByComponent(component) {
  return await query(`
    SELECT id, title, description, status, priority, severity, component, category, root_cause, resolution_notes, resolved_at, created_at, updated_at
    FROM issues
    WHERE component = ?
    ORDER BY created_at DESC
  `, [component]);
}

module.exports = {
  prisma,
  getAllIssues,
  getIssueById,
  getTelemetry,
  getAllProjects,
  getAllSprints,
  getAllUsers,
  getAllComments,
  getIssueDependencies,
  createIssueDependency,
  deleteIssueDependency,
  getDependencyGraph,
  getHistoricalDefectsByComponent
};
