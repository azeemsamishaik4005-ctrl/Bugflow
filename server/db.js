const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'file:./defectx.db';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

let pgPool = null;
const jsonDbPath = path.resolve(__dirname, 'defectx_data.json');
const legacyJsonDbPath = path.resolve(__dirname, 'bugflow_data.json');

let localDb = {
  users: [],
  projects: [],
  issues: [],
  sprints: [],
  comments: [],
  attachments: [],
  activity_history: [],
  test_cases: [],
  notifications: [],
  defect_dependencies: [],
  autoId: { users: 1, projects: 1, issues: 1, sprints: 1, comments: 1, attachments: 1, activity_history: 1, test_cases: 1, notifications: 1, defect_dependencies: 1 }
};

if (isPostgres) {
  pgPool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
  // Load local JSON DB if exists (with fallback to legacy filename)
  const activeJsonPath = fs.existsSync(jsonDbPath) ? jsonDbPath : (fs.existsSync(legacyJsonDbPath) ? legacyJsonDbPath : null);
  if (activeJsonPath) {
    try {
      const content = fs.readFileSync(activeJsonPath, 'utf8');
      localDb = { ...localDb, ...JSON.parse(content) };
      // Ensure new collections exist for backwards compatibility
      if (!localDb.sprints) localDb.sprints = [];
      if (!localDb.comments) localDb.comments = [];
      if (!localDb.attachments) localDb.attachments = [];
      if (!localDb.activity_history) localDb.activity_history = [];
      if (!localDb.test_cases) localDb.test_cases = [];
      if (!localDb.notifications) localDb.notifications = [];
      if (!localDb.defect_dependencies) localDb.defect_dependencies = [];
    } catch (e) {
      console.warn('Error reading local JSON db, initializing fresh:', e.message);
    }
  }
}

function saveLocalDb() {
  if (!isPostgres) {
    fs.writeFileSync(jsonDbPath, JSON.stringify(localDb, null, 2), 'utf8');
  }
}

const query = async (sql, params = []) => {
  if (isPostgres) {
    let paramCount = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  }

  // Local JSON DB Engine implementation
  const cleanSql = sql.trim();
  const upperSql = cleanSql.toUpperCase();

  // 1. SELECT COUNT queries
  if (upperSql.includes('SELECT COUNT(*)')) {
    let collectionName = 'issues';
    if (upperSql.includes('FROM USERS')) collectionName = 'users';
    if (upperSql.includes('FROM PROJECTS')) collectionName = 'projects';

    let items = localDb[collectionName] || [];
    if (upperSql.includes("WHERE SEVERITY = 'CRITICAL'") || upperSql.includes("WHERE PRIORITY = 'P1'")) {
      items = items.filter(i => i.severity === 'Critical' || i.priority === 'P1');
    } else if (upperSql.includes("WHERE STATUS = 'RESOLVED'")) {
      items = items.filter(i => i.status === 'Resolved');
    } else if (upperSql.includes("WHERE STATUS = 'IN PROGRESS'")) {
      items = items.filter(i => i.status === 'In Progress');
    }
    return [{ count: items.length }];
  }

  // 2. SELECT USERS
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM USERS')) {
    let users = [...localDb.users];
    if (upperSql.includes('WHERE EMAIL = ?') && params.length > 0) {
      users = users.filter(u => u.email === params[0]);
    } else if (upperSql.includes('WHERE ID = ?') && params.length > 0) {
      users = users.filter(u => u.id === parseInt(params[0], 10));
    }
    return users;
  }

  // 3. SELECT PROJECTS
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM PROJECTS')) {
    let projects = localDb.projects.map(p => {
      const owner = localDb.users.find(u => u.id === p.owner_id);
      const issueCount = localDb.issues.filter(i => i.project_id === p.id).length;
      return {
        ...p,
        owner_name: owner ? owner.name : 'Admin',
        issue_count: issueCount
      };
    });

    if (upperSql.includes('WHERE NAME = ?') && params.length > 0) {
      projects = projects.filter(p => p.name === params[0]);
    } else if (upperSql.includes('WHERE ID = ?') && params.length > 0) {
      projects = projects.filter(p => p.id === parseInt(params[0], 10));
    }

    if (upperSql.includes('ORDER BY')) {
      projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return projects;
  }

    if (upperSql.startsWith('SELECT') && upperSql.includes('FROM ISSUES')) {
      let issues = localDb.issues.map(i => {
        const proj = localDb.projects.find(p => p.id === i.project_id);
        const reporter = localDb.users.find(u => u.id === i.reporter_id);
        const assignee = localDb.users.find(u => u.id === i.assignee_id);
        const sprint = localDb.sprints.find(s => s.id === i.sprint_id);
        return {
          ...i,
          component: i.component || 'Frontend UI',
          category: i.category || 'General',
          environment: i.environment || 'Production',
          root_cause: i.root_cause || null,
          resolution_notes: i.resolution_notes || null,
          resolved_at: i.resolved_at || null,
          project_name: proj ? proj.name : 'Core Project',
          reporter_name: reporter ? reporter.name : 'Admin',
          assignee_name: assignee ? assignee.name : null,
          sprint_name: sprint ? sprint.name : null
        };
      });

      let paramIdx = 0;
      if (upperSql.includes('WHERE I.ID = ?') || upperSql.includes('WHERE ID = ?')) {
        const targetId = parseInt(params[paramIdx++], 10);
        issues = issues.filter(i => i.id === targetId);
      } else if (upperSql.includes('WHERE I.TITLE = ?') || upperSql.includes('WHERE TITLE = ?')) {
        const targetTitle = params[paramIdx++];
        issues = issues.filter(i => i.title === targetTitle);
      } else {
        if (upperSql.includes("STATUS IN ('RESOLVED', 'CLOSED')") || upperSql.includes("I.STATUS IN ('RESOLVED', 'CLOSED')")) {
          issues = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed');
        }
        if ((upperSql.includes('I.ID != ?') || upperSql.includes('ID != ?')) && params[paramIdx] !== undefined) {
          const excludeId = parseInt(params[paramIdx++], 10);
          issues = issues.filter(i => i.id !== excludeId);
        }
        if (upperSql.includes('I.PROJECT_ID = ?') && params[paramIdx] !== undefined) {
          const pid = parseInt(params[paramIdx++], 10);
          issues = issues.filter(i => i.project_id === pid);
        }
        if (upperSql.includes('I.STATUS = ?') && params[paramIdx] !== undefined) {
          const st = params[paramIdx++];
          issues = issues.filter(i => i.status === st);
        }
        if (upperSql.includes('I.PRIORITY = ?') && params[paramIdx] !== undefined) {
          const pr = params[paramIdx++];
          issues = issues.filter(i => i.priority === pr);
        }
        if (upperSql.includes('I.SEVERITY = ?') && params[paramIdx] !== undefined) {
          const sv = params[paramIdx++];
          issues = issues.filter(i => i.severity === sv);
        }
        if (upperSql.includes('LIKE') && params[paramIdx] !== undefined) {
          const term = (params[paramIdx++] || '').replace(/%/g, '').toLowerCase();
          if (params[paramIdx] !== undefined) paramIdx++; // skip duplicate search param
          issues = issues.filter(i => 
            (i.title && i.title.toLowerCase().includes(term)) || 
            (i.description && i.description.toLowerCase().includes(term))
          );
        }
      }

      issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (upperSql.includes('LIMIT 1')) return issues.slice(0, 1);
      return issues;
    }

  // 4a. SELECT COMMENTS
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM COMMENTS')) {
    let comments = localDb.comments.map(c => {
      const user = localDb.users.find(u => u.id === c.user_id);
      return { ...c, user_name: user ? user.name : 'Unknown' };
    });
    if (upperSql.includes('WHERE ISSUE_ID = ?') && params.length > 0) {
      comments = comments.filter(c => c.issue_id === parseInt(params[0], 10));
    }
    // Handle soft deletes if the query requests it
    if (upperSql.includes('DELETED_AT IS NULL')) {
      comments = comments.filter(c => c.deleted_at === null);
    }
    comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return comments;
  }

  // 4b. SELECT ATTACHMENTS
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM ATTACHMENTS')) {
    let att = [...localDb.attachments];
    if (upperSql.includes('WHERE ISSUE_ID = ?') && params.length > 0) {
      att = att.filter(a => a.issue_id === parseInt(params[0], 10));
    }
    att.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return att;
  }

  // 4c. SELECT ACTIVITY_HISTORY
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM ACTIVITY_HISTORY')) {
    let hist = localDb.activity_history.map(h => {
      const user = localDb.users.find(u => u.id === h.user_id);
      return { ...h, user_name: user ? user.name : 'System' };
    });
    if (upperSql.includes('WHERE ISSUE_ID = ?') && params.length > 0) {
      hist = hist.filter(h => h.issue_id === parseInt(params[0], 10));
    }
    hist.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return hist;
  }

  // 4d. SELECT SPRINTS
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM SPRINTS')) {
    let sprints = [...localDb.sprints];
    if (upperSql.includes('WHERE PROJECT_ID = ?') && params.length > 0) {
      sprints = sprints.filter(s => s.project_id === parseInt(params[0], 10));
    }
    sprints.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sprints;
  }

  // 4e. SELECT TEST_CASES
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM TEST_CASES')) {
    let testCases = [...localDb.test_cases];
    if (upperSql.includes('WHERE ISSUE_ID = ?') && params.length > 0) {
      testCases = testCases.filter(t => t.issue_id === parseInt(params[0], 10));
    }
    testCases.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return testCases;
  }

  // 6. SELECT NOTIFICATIONS
  if (upperSql.startsWith('SELECT') && upperSql.includes('FROM NOTIFICATIONS')) {
    let notifications = [...localDb.notifications];
    
    // Join with actor details if needed
    if (upperSql.includes('JOIN USERS A ON')) {
      notifications = notifications.map(n => {
        const actor = localDb.users.find(u => u.id === n.actor_id);
        return {
          ...n,
          actor_name: actor ? actor.name : null
        };
      });
    }

    if (upperSql.includes('WHERE USER_ID = ?') || upperSql.includes('WHERE N.USER_ID = ?')) {
      const userId = parseInt(params[0], 10);
      notifications = notifications.filter(n => n.user_id === userId);
      
      if (upperSql.includes('AND IS_READ = FALSE')) {
        notifications = notifications.filter(n => n.is_read === false);
      }
    }

    if (upperSql.includes('WHERE ID = ?')) {
      const targetId = parseInt(params[0], 10);
      notifications = notifications.filter(n => n.id === targetId);
    }

    // Unread count fast path
    if (upperSql.includes('COUNT(*) AS COUNT') && upperSql.includes('WHERE USER_ID = ? AND IS_READ = FALSE')) {
      const userId = parseInt(params[0], 10);
      const count = localDb.notifications.filter(n => n.user_id === userId && n.is_read === false).length;
      return [{ count }];
    }

    if (upperSql.includes('ORDER BY CREATED_AT DESC')) {
      notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (upperSql.includes('LIMIT ?')) {
      const limit = parseInt(params[params.length - 1], 10);
      notifications = notifications.slice(0, limit);
    }
    
    return notifications;
  }

  // 5. INSERT USERS
  if (upperSql.startsWith('INSERT INTO USERS')) {
    const newUser = {
      id: localDb.autoId.users++,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      role: params[3] || 'user',
      created_at: new Date().toISOString()
    };
    localDb.users.push(newUser);
    saveLocalDb();
    return { id: newUser.id };
  }

  // 6. INSERT PROJECTS
  if (upperSql.startsWith('INSERT INTO PROJECTS')) {
    const newProj = {
      id: localDb.autoId.projects++,
      name: params[0],
      description: params[1] || '',
      owner_id: params[2],
      created_at: new Date().toISOString()
    };
    localDb.projects.push(newProj);
    saveLocalDb();
    return { id: newProj.id };
  }

  // 7. INSERT ISSUES
  if (upperSql.startsWith('INSERT INTO ISSUES')) {
    const newIssue = {
      id: localDb.autoId.issues++,
      project_id: parseInt(params[0], 10),
      sprint_id: params[1] ? parseInt(params[1], 10) : null,
      title: params[2],
      description: params[3],
      type: params[4] || 'Bug',
      priority: params[5] || 'P2',
      severity: params[6] || 'Medium',
      status: params[7] || 'Open',
      reporter_id: params[8] ? parseInt(params[8], 10) : null,
      assignee_id: params[9] ? parseInt(params[9], 10) : null,
      component: params[10] || 'Frontend UI',
      category: params[11] || 'General',
      environment: params[12] || 'Production',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    localDb.issues.push(newIssue);
    saveLocalDb();
    return { id: newIssue.id };
  }

  // 7a. INSERT COMMENTS
  if (upperSql.startsWith('INSERT INTO COMMENTS')) {
    const parentId = params[3] ? parseInt(params[3], 10) : null;
    const item = { 
      id: localDb.autoId.comments++, 
      issue_id: parseInt(params[0], 10), 
      user_id: parseInt(params[1], 10), 
      content: params[2], 
      parent_message_id: parentId,
      created_at: new Date().toISOString(),
      updated_at: null,
      deleted_at: null
    };
    localDb.comments.push(item); 
    saveLocalDb(); 
    return { id: item.id };
  }

  // UPDATE COMMENTS
  if (upperSql.startsWith('UPDATE COMMENTS')) {
    const targetId = parseInt(params[params.length - 1], 10);
    const index = localDb.comments.findIndex(c => c.id === targetId);
    if (index !== -1) {
      if (upperSql.includes('DELETED_AT')) {
        localDb.comments[index].deleted_at = new Date().toISOString();
      } else {
        localDb.comments[index].content = params[0];
        localDb.comments[index].updated_at = new Date().toISOString();
      }
      saveLocalDb();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 7b. INSERT ATTACHMENTS
  if (upperSql.startsWith('INSERT INTO ATTACHMENTS')) {
    const item = { id: localDb.autoId.attachments++, issue_id: parseInt(params[0], 10), uploader_id: parseInt(params[1], 10), file_name: params[2], file_url: params[3], created_at: new Date().toISOString() };
    localDb.attachments.push(item); saveLocalDb(); return { id: item.id };
  }

  // 7c. INSERT ACTIVITY_HISTORY
  if (upperSql.startsWith('INSERT INTO ACTIVITY_HISTORY')) {
    const item = { id: localDb.autoId.activity_history++, issue_id: parseInt(params[0], 10), user_id: parseInt(params[1], 10), action: params[2], old_state: params[3] || null, new_state: params[4] || null, created_at: new Date().toISOString() };
    localDb.activity_history.push(item); saveLocalDb(); return { id: item.id };
  }
  
  // 7d. INSERT SPRINTS
  if (upperSql.startsWith('INSERT INTO SPRINTS')) {
    const item = { id: localDb.autoId.sprints++, project_id: parseInt(params[0], 10), name: params[1], start_date: params[2], end_date: params[3], status: params[4] || 'Active', created_at: new Date().toISOString() };
    localDb.sprints.push(item); saveLocalDb(); return { id: item.id };
  }

  // 7e. INSERT TEST_CASES
  if (upperSql.startsWith('INSERT INTO TEST_CASES')) {
    const item = { id: localDb.autoId.test_cases++, issue_id: parseInt(params[0], 10), scenario: params[1], preconditions: params[2], steps: params[3], expected_result: params[4], priority: params[5], type: params[6], created_at: new Date().toISOString() };
    localDb.test_cases.push(item); saveLocalDb(); return { id: item.id };
  }

  // 14. INSERT NOTIFICATIONS
  if (upperSql.startsWith('INSERT INTO NOTIFICATIONS')) {
    const newNotif = {
      id: localDb.autoId.notifications++,
      user_id: parseInt(params[0], 10),
      type: params[1],
      title: params[2],
      message: params[3],
      issue_id: params[4] ? parseInt(params[4], 10) : null,
      project_id: params[5] ? parseInt(params[5], 10) : null,
      actor_id: params[6] ? parseInt(params[6], 10) : null,
      is_read: false,
      created_at: new Date().toISOString()
    };
    localDb.notifications.push(newNotif);
    saveLocalDb();
    return { id: newNotif.id };
  }

  // 15. UPDATE NOTIFICATIONS
  if (upperSql.startsWith('UPDATE NOTIFICATIONS')) {
    if (upperSql.includes('SET IS_READ = TRUE WHERE ID = ?')) {
      const targetId = parseInt(params[0], 10);
      const index = localDb.notifications.findIndex(n => n.id === targetId);
      if (index !== -1) {
        localDb.notifications[index].is_read = true;
        saveLocalDb();
        return { changes: 1 };
      }
    } else if (upperSql.includes('SET IS_READ = TRUE WHERE USER_ID = ? AND IS_READ = FALSE')) {
      const userId = parseInt(params[0], 10);
      let changes = 0;
      localDb.notifications.forEach(n => {
        if (n.user_id === userId && n.is_read === false) {
          n.is_read = true;
          changes++;
        }
      });
      if (changes > 0) saveLocalDb();
      return { changes };
    }
    return { changes: 0 };
  }

  // 16. DELETE NOTIFICATIONS
  if (upperSql.startsWith('DELETE FROM NOTIFICATIONS')) {
    const targetId = parseInt(params[0], 10);
    const initialLen = localDb.notifications.length;
    localDb.notifications = localDb.notifications.filter(n => n.id !== targetId);
    if (localDb.notifications.length < initialLen) {
      saveLocalDb();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 8. UPDATE ISSUES
  if (upperSql.startsWith('UPDATE ISSUES')) {
    const targetId = parseInt(params[params.length - 1], 10);
    const index = localDb.issues.findIndex(i => i.id === targetId);
    if (index !== -1) {
      if (params.length === 2 && upperSql.includes('STATUS = ?')) {
        // Direct status update
        const newStatus = params[0];
        localDb.issues[index].status = newStatus;
        if (newStatus === 'Resolved' || newStatus === 'Closed') {
          localDb.issues[index].resolved_at = localDb.issues[index].resolved_at || new Date().toISOString();
        }
        localDb.issues[index].updated_at = new Date().toISOString();
      } else if (upperSql.includes("STATUS = 'RESOLVED'") || (upperSql.includes('ROOT_CAUSE = ?') && params.length === 5)) {
        localDb.issues[index].status = 'Resolved';
        localDb.issues[index].root_cause = params[0];
        localDb.issues[index].resolution_notes = params[1];
        localDb.issues[index].resolved_at = params[2] || new Date().toISOString();
        localDb.issues[index].updated_at = params[3] || new Date().toISOString();
      } else if (upperSql.includes('ROOT_CAUSE') || upperSql.includes('RESOLUTION_NOTES')) {
        // Dynamic / resolution update
        // We can inspect parameters or update keys
        localDb.issues[index] = {
          ...localDb.issues[index],
          title: params[0] !== undefined ? params[0] : localDb.issues[index].title,
          description: params[1] !== undefined ? params[1] : localDb.issues[index].description,
          type: params[2] !== undefined ? params[2] : localDb.issues[index].type,
          priority: params[3] !== undefined ? params[3] : localDb.issues[index].priority,
          severity: params[4] !== undefined ? params[4] : localDb.issues[index].severity,
          status: params[5] !== undefined ? params[5] : localDb.issues[index].status,
          project_id: params[6] !== undefined ? parseInt(params[6], 10) : localDb.issues[index].project_id,
          sprint_id: params[7] !== undefined ? (params[7] ? parseInt(params[7], 10) : null) : localDb.issues[index].sprint_id,
          assignee_id: params[8] !== undefined ? (params[8] ? parseInt(params[8], 10) : null) : localDb.issues[index].assignee_id,
          component: params[9] !== undefined ? params[9] : localDb.issues[index].component,
          root_cause: params[10] !== undefined ? params[10] : localDb.issues[index].root_cause,
          resolution_notes: params[11] !== undefined ? params[11] : localDb.issues[index].resolution_notes,
          resolved_at: params[12] !== undefined ? params[12] : localDb.issues[index].resolved_at,
          updated_at: params[13] || new Date().toISOString()
        };
      } else {
        localDb.issues[index] = {
          ...localDb.issues[index],
          title: params[0],
          description: params[1],
          type: params[2],
          priority: params[3],
          severity: params[4],
          status: params[5],
          project_id: parseInt(params[6], 10),
          sprint_id: params[7] ? parseInt(params[7], 10) : null,
          assignee_id: params[8] ? parseInt(params[8], 10) : null,
          component: params[9] !== undefined ? params[9] : localDb.issues[index].component,
          updated_at: params[10] || new Date().toISOString()
        };
      }
      saveLocalDb();
      return { id: targetId, changes: 1 };
    }
    return { changes: 0 };
  }

  // 9. DELETE ISSUES
  if (upperSql.startsWith('DELETE FROM ISSUES')) {
    const targetId = parseInt(params[0], 10);
    const initialLen = localDb.issues.length;
    localDb.issues = localDb.issues.filter(i => i.id !== targetId);
    saveLocalDb();
    return { changes: initialLen - localDb.issues.length };
  }

  // 10. DELETE PROJECTS
  if (upperSql.startsWith('DELETE FROM PROJECTS')) {
    const targetId = parseInt(params[0], 10);
    const initialLen = localDb.projects.length;
    localDb.projects = localDb.projects.filter(p => p.id !== targetId);
    saveLocalDb();
    return { changes: initialLen - localDb.projects.length };
  }

  // 11. DEFECT DEPENDENCIES
  if (upperSql.includes('FROM DEFECT_DEPENDENCIES')) {
    let deps = [...(localDb.defect_dependencies || [])];
    if (upperSql.includes('ISSUE_ID = ? AND RELATED_ISSUE_ID = ?') && params.length >= 2) {
      const p1 = parseInt(params[0], 10);
      const p2 = parseInt(params[1], 10);
      deps = deps.filter(d => (d.issue_id === p1 && d.related_issue_id === p2) || (d.issue_id === p2 && d.related_issue_id === p1));
    } else if (upperSql.includes('WHERE ISSUE_ID = ?') || upperSql.includes('WHERE D.ISSUE_ID = ?') || upperSql.includes('D.ISSUE_ID = ? OR D.RELATED_ISSUE_ID = ?')) {
      const targetId = parseInt(params[0], 10);
      deps = deps.filter(d => d.issue_id === targetId || d.related_issue_id === targetId);
    } else if (upperSql.includes('WHERE ID = ?') || upperSql.includes('WHERE D.ID = ?')) {
      const depId = parseInt(params[0], 10);
      deps = deps.filter(d => d.id === depId);
    }
    return deps.map(d => {
      const issue = localDb.issues.find(i => i.id === d.issue_id);
      const related = localDb.issues.find(i => i.id === d.related_issue_id);
      const creator = localDb.users.find(u => u.id === d.created_by);
      return {
        ...d,
        issue_title: issue ? issue.title : '',
        issue_status: issue ? issue.status : 'Open',
        related_title: related ? related.title : '',
        related_status: related ? related.status : 'Open',
        related_severity: related ? related.severity : 'Medium',
        related_priority: related ? related.priority : 'P2',
        related_component: related ? related.component : 'Frontend UI',
        creator_name: creator ? creator.name : 'Team Member'
      };
    });
  }

  if (upperSql.startsWith('INSERT INTO DEFECT_DEPENDENCIES')) {
    const newDep = {
      id: localDb.autoId.defect_dependencies++,
      issue_id: parseInt(params[0], 10),
      related_issue_id: parseInt(params[1], 10),
      relationship_type: params[2],
      created_by: params[3] ? parseInt(params[3], 10) : null,
      created_at: new Date().toISOString()
    };
    if (!localDb.defect_dependencies) localDb.defect_dependencies = [];
    localDb.defect_dependencies.push(newDep);
    saveLocalDb();
    return [newDep];
  }

  if (upperSql.startsWith('DELETE FROM DEFECT_DEPENDENCIES')) {
    const targetId = parseInt(params[0], 10);
    const initialLen = (localDb.defect_dependencies || []).length;
    localDb.defect_dependencies = (localDb.defect_dependencies || []).filter(d => d.id !== targetId);
    saveLocalDb();
    return { changes: initialLen - localDb.defect_dependencies.length };
  }

  return [];
};

const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
};

const initDb = async () => {
  if (isPostgres) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          owner_id INT REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS sprints (
          id SERIAL PRIMARY KEY,
          project_id INT REFERENCES projects(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(20) DEFAULT 'Planned',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          project_id INT REFERENCES projects(id) ON DELETE CASCADE,
          actor_id INT REFERENCES users(id) ON DELETE SET NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS issues (
          id SERIAL PRIMARY KEY,
          project_id INT REFERENCES projects(id) ON DELETE CASCADE,
          sprint_id INT REFERENCES sprints(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'Bug',
          priority VARCHAR(10) DEFAULT 'P2',
          severity VARCHAR(50) DEFAULT 'Medium',
          status VARCHAR(50) DEFAULT 'Open',
          reporter_id INT REFERENCES users(id) ON DELETE SET NULL,
          assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
          component VARCHAR(100) DEFAULT 'Frontend UI',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS test_cases (
          id SERIAL PRIMARY KEY,
          issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          scenario VARCHAR(255) NOT NULL,
          preconditions TEXT,
          steps TEXT NOT NULL,
          expected_result TEXT NOT NULL,
          priority VARCHAR(50),
          type VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Modify existing issues table to add assignee_id, component, category, environment, root_cause, resolution_notes, resolved_at
      try {
        await query('ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id INT REFERENCES users(id) ON DELETE SET NULL;');
        await query("ALTER TABLE issues ADD COLUMN IF NOT EXISTS component VARCHAR(100) DEFAULT 'Frontend UI';");
        await query("ALTER TABLE issues ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'General';");
        await query("ALTER TABLE issues ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'Production';");
        await query('ALTER TABLE issues ADD COLUMN IF NOT EXISTS root_cause TEXT;');
        await query('ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_notes TEXT;');
        await query('ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;');

        // PostgreSQL Performance Indexes for Milestone 4
        await query('CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_component ON issues(component);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_environment ON issues(environment);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_assignee_id ON issues(assignee_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_reporter_id ON issues(reporter_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_sprint_id ON issues(sprint_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);');
        await query('CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments(issue_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_activity_history_issue_id ON activity_history(issue_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);');
      } catch (err) {
        console.warn('Could not alter issues table or create indexes:', err.message);
      }


      await query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          parent_message_id INT REFERENCES comments(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL,
          deleted_at TIMESTAMP NULL
        );
      `);

      // Modify existing comments table to add new columns if they don't exist
      try {
        await query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_message_id INT REFERENCES comments(id) ON DELETE CASCADE;');
        await query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL;');
        await query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;');
        
        // Add composite index for discussions
        await query('CREATE INDEX IF NOT EXISTS idx_comments_issue_created ON comments(issue_id, created_at);');
      } catch (err) {
        console.warn('Could not alter comments table (maybe not needed):', err.message);
      }

      await query(`
        CREATE TABLE IF NOT EXISTS attachments (
          id SERIAL PRIMARY KEY,
          issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          uploader_id INT REFERENCES users(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS activity_history (
          id SERIAL PRIMARY KEY,
          issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          action VARCHAR(255) NOT NULL,
          old_state TEXT,
          new_state TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS defect_dependencies (
          id SERIAL PRIMARY KEY,
          issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          related_issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
          relationship_type VARCHAR(50) NOT NULL,
          created_by INT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_defect_dependencies UNIQUE(issue_id, related_issue_id, relationship_type)
        );
      `);

      try {
        await query('CREATE INDEX IF NOT EXISTS idx_defect_dependencies_issue ON defect_dependencies(issue_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_defect_dependencies_related ON defect_dependencies(related_issue_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_proj_status ON issues(project_id, status);');
        await query('CREATE INDEX IF NOT EXISTS idx_issues_status_sev ON issues(status, severity);');
      } catch (e) {
        console.warn('Could not create dependency indexes:', e.message);
      }

      console.log('✅ PostgreSQL schema initialized successfully.');
    } catch (err) {
      console.error('❌ Error initializing PostgreSQL schema:', err);
    }
  } else {
    console.log('✅ Local database initialized successfully.');
  }
};

module.exports = {
  query,
  queryOne,
  initDb,
  getLocalDb: () => localDb,
  saveLocalDb
};

