const { query } = require('../db');

/**
 * Core function to insert a notification into the database.
 * Prevents identical notifications (same user, type, issue/project) within the last hour to reduce spam.
 */
async function createNotification({ userId, type, title, message, issueId = null, projectId = null, actorId = null }) {
  if (!userId) return null; // Can't notify nobody
  if (userId === actorId) return null; // Don't notify the person performing the action

  try {
    // Basic deduplication: Check if there's an identical notification (type, issueId, userId) in the last hour
    const recentNotifs = await query(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND type = ? AND issue_id ${issueId ? '= ?' : 'IS NULL'}
       ORDER BY created_at DESC LIMIT 1`,
      issueId ? [userId, type, issueId] : [userId, type]
    );

    if (recentNotifs.length > 0) {
      const lastNotif = recentNotifs[0];
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (new Date(lastNotif.created_at) > oneHourAgo && lastNotif.actor_id === actorId && lastNotif.message === message) {
        // Skip duplicate
        return null;
      }
    }

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, issue_id, project_id, actor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [userId, type, title, message, issueId, projectId, actorId]
    );

    return result && result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// ---------------------------------------------------------
// Specific Notification Triggers
// ---------------------------------------------------------

async function notifyIssueCreated(issue, actorId) {
  // Notify project owner/admins (for simplicity, we fetch project owner)
  try {
    const projects = await query(`SELECT owner_id FROM projects WHERE id = ?`, [issue.project_id]);
    if (projects.length > 0) {
      const ownerId = projects[0].owner_id;
      
      // If the issue was assigned during creation, also notify the assignee
      if (issue.assignee_id && issue.assignee_id !== ownerId) {
        await notifyIssueAssignee(issue.assignee_id, issue, actorId);
      }
      
      await createNotification({
        userId: ownerId,
        type: 'ISSUE_CREATED',
        title: 'New Issue Created',
        message: `A new defect has been reported: "${issue.title}"`,
        issueId: issue.id,
        projectId: issue.project_id,
        actorId
      });
    }
  } catch (err) {
    console.error('Error in notifyIssueCreated', err);
  }
}

async function notifyIssueAssignee(assigneeId, issue, actorId) {
  if (!assigneeId) return;
  await createNotification({
    userId: assigneeId,
    type: 'ISSUE_ASSIGNED',
    title: 'New Issue Assigned',
    message: `You have been assigned the issue: "${issue.title}"`,
    issueId: issue.id,
    projectId: issue.project_id,
    actorId
  });
}

async function notifyIssueStatusChanged(issue, oldStatus, newStatus, actorId) {
  const usersToNotify = new Set();
  if (issue.reporter_id) usersToNotify.add(issue.reporter_id);
  if (issue.assignee_id) usersToNotify.add(issue.assignee_id);

  for (const userId of usersToNotify) {
    await createNotification({
      userId,
      type: newStatus === 'Resolved' ? 'ISSUE_RESOLVED' : (newStatus === 'Open' && oldStatus === 'Resolved') ? 'ISSUE_REOPENED' : 'STATUS_CHANGED',
      title: newStatus === 'Resolved' ? 'Issue Resolved' : (newStatus === 'Open' && oldStatus === 'Resolved') ? 'Issue Reopened' : 'Issue Status Updated',
      message: newStatus === 'Resolved' 
        ? `The issue "${issue.title}" has been marked as Resolved.` 
        : (newStatus === 'Open' && oldStatus === 'Resolved') 
        ? `The issue "${issue.title}" has been reopened and requires attention.`
        : `Status changed: ${oldStatus} → ${newStatus} for "${issue.title}"`,
      issueId: issue.id,
      projectId: issue.project_id,
      actorId
    });
  }
}

async function notifyIssuePriorityChanged(issue, oldPriority, newPriority, actorId) {
  const usersToNotify = new Set();
  if (issue.reporter_id) usersToNotify.add(issue.reporter_id);
  if (issue.assignee_id) usersToNotify.add(issue.assignee_id);

  for (const userId of usersToNotify) {
    await createNotification({
      userId,
      type: 'PRIORITY_CHANGED',
      title: 'Issue Priority Changed',
      message: `Priority changed: ${oldPriority} → ${newPriority} for "${issue.title}"`,
      issueId: issue.id,
      projectId: issue.project_id,
      actorId
    });
  }
}

async function notifyIssueSeverityChanged(issue, oldSeverity, newSeverity, actorId) {
  const usersToNotify = new Set();
  if (issue.reporter_id) usersToNotify.add(issue.reporter_id);
  if (issue.assignee_id) usersToNotify.add(issue.assignee_id);

  for (const userId of usersToNotify) {
    await createNotification({
      userId,
      type: 'SEVERITY_CHANGED',
      title: 'Issue Severity Changed',
      message: `Severity changed: ${oldSeverity} → ${newSeverity} for "${issue.title}"`,
      issueId: issue.id,
      projectId: issue.project_id,
      actorId
    });
  }
}

async function notifyCommentAdded(issue, commentText, actorId, actorName) {
  const usersToNotify = new Set();
  if (issue.reporter_id) usersToNotify.add(issue.reporter_id);
  if (issue.assignee_id) usersToNotify.add(issue.assignee_id);

  // Mention parsing (@Username)
  const allUsers = await query(`SELECT id, name FROM users`);
  const mentions = [];
  
  allUsers.forEach(u => {
    if (commentText.includes(`@${u.name}`) && u.id !== actorId) {
      mentions.push(u.id);
      usersToNotify.delete(u.id); // Remove from general notify if they are getting a mention
    }
  });

  // Notify Mentions
  for (const userId of mentions) {
    await createNotification({
      userId,
      type: 'ISSUE_MENTION',
      title: 'You were mentioned',
      message: `${actorName} mentioned you in: "${issue.title}"`,
      issueId: issue.id,
      projectId: issue.project_id,
      actorId
    });
  }

  // Notify others (assignee/reporter)
  for (const userId of usersToNotify) {
    await createNotification({
      userId,
      type: 'COMMENT_ADDED',
      title: 'New Comment',
      message: `${actorName} commented on: "${issue.title}"\n"${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
      issueId: issue.id,
      projectId: issue.project_id,
      actorId
    });
  }
}

async function notifyAiResolution(issue) {
  const usersToNotify = new Set();
  if (issue.reporter_id) usersToNotify.add(issue.reporter_id);
  if (issue.assignee_id) usersToNotify.add(issue.assignee_id);

  for (const userId of usersToNotify) {
    await createNotification({
      userId,
      type: 'AI_RESOLUTION',
      title: 'AI Resolution Assistance Ready',
      message: `AI analysis is available for: "${issue.title}"\nView probable root cause and recommended resolution.`,
      issueId: issue.id,
      projectId: issue.project_id,
      actorId: null
    });
  }
}

async function notifySprintEvent(sprint, eventType, actorId) {
  try {
    const projects = await query(`SELECT owner_id FROM projects WHERE id = ?`, [sprint.project_id]);
    if (projects.length > 0) {
      const ownerId = projects[0].owner_id;
      
      let title = '';
      let message = '';
      
      if (eventType === 'STARTED') {
        title = 'Sprint Started';
        message = `Sprint "${sprint.name}" has started.`;
      } else if (eventType === 'COMPLETED') {
        title = 'Sprint Completed';
        message = `Sprint "${sprint.name}" has been completed.`;
      } else {
        title = 'Sprint Updated';
        message = `Sprint "${sprint.name}" was updated.`;
      }

      await createNotification({
        userId: ownerId,
        type: 'SPRINT_EVENT',
        title,
        message,
        projectId: sprint.project_id,
        actorId
      });
    }
  } catch (err) {
    console.error('Error in notifySprintEvent', err);
  }
}

module.exports = {
  createNotification,
  notifyIssueCreated,
  notifyIssueAssignee,
  notifyIssueStatusChanged,
  notifyIssuePriorityChanged,
  notifyIssueSeverityChanged,
  notifyCommentAdded,
  notifyAiResolution,
  notifySprintEvent
};
