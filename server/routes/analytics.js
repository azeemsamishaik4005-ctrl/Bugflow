const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const ALL_COMPONENTS = [
  "Authentication",
  "Billing & Payments",
  "API & Backend",
  "Frontend UI",
  "Database",
  "Mobile & Responsive",
  "Performance & Memory",
  "Security"
];

/**
 * GET /api/analytics
 * Returns comprehensive real-time defect telemetry and metrics.
 * Supports query filters: time_range (7d | 30d | 90d | all), project_id
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { time_range = '30d', project_id } = req.query;

    // Fetch all issues (optionally filtered by project)
    let issuesSql = 'SELECT * FROM issues WHERE 1=1';
    const params = [];
    if (project_id) {
      issuesSql += ' AND project_id = ?';
      params.push(parseInt(project_id, 10));
    }
    issuesSql += ' ORDER BY created_at DESC';

    const allIssues = await query(issuesSql, params);
    const users = await query('SELECT id, name, email, role FROM users ORDER BY name ASC');

    // Filter issues by time range for trend analysis
    const now = new Date();
    let cutoffDate = null;
    if (time_range === '7d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (time_range === '30d') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (time_range === '90d') {
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const filteredIssues = cutoffDate 
      ? allIssues.filter(i => new Date(i.created_at) >= cutoffDate || (i.resolved_at && new Date(i.resolved_at) >= cutoffDate))
      : allIssues;

    // 1. Summary Cards
    const totalDefects = allIssues.length;
    const openDefects = allIssues.filter(i => i.status === 'Open').length;
    const inProgressDefects = allIssues.filter(i => i.status === 'In Progress' || i.status === 'In Review' || i.status === 'Retest/Verify').length;
    const resolvedDefects = allIssues.filter(i => i.status === 'Resolved').length;
    const closedDefects = allIssues.filter(i => i.status === 'Closed').length;

    // 2. Defects by Severity
    const severityCounts = {
      'Critical': 0,
      'High': 0,
      'Medium': 0,
      'Low': 0
    };
    allIssues.forEach(i => {
      const sev = i.severity || (i.priority === 'P1' ? 'Critical' : i.priority === 'P2' ? 'High' : 'Medium');
      if (severityCounts[sev] !== undefined) {
        severityCounts[sev]++;
      } else if (sev.toLowerCase() === 'minor') {
        severityCounts['Low']++;
      } else if (sev.toLowerCase() === 'major') {
        severityCounts['High']++;
      } else {
        severityCounts['Medium']++;
      }
    });

    // 3. Defects by Category / Component
    const categoryCounts = {};
    ALL_COMPONENTS.forEach(c => { categoryCounts[c] = 0; });
    allIssues.forEach(i => {
      const comp = i.component || 'Frontend UI';
      if (categoryCounts[comp] !== undefined) {
        categoryCounts[comp]++;
      } else {
        categoryCounts[comp] = (categoryCounts[comp] || 0) + 1;
      }
    });

    // 4. Defects by Status
    const statusCounts = {
      'Open': 0,
      'In Progress': 0,
      'Retest/Verify': 0,
      'Resolved': 0,
      'Closed': 0
    };
    allIssues.forEach(i => {
      const st = i.status || 'Open';
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++;
      } else {
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      }
    });

    // 5. Developer Workload
    const developerWorkload = (users || []).map(u => {
      const userIssues = allIssues.filter(i => i.assignee_id === u.id);
      const openCount = userIssues.filter(i => i.status === 'Open' || i.status === 'In Progress' || i.status === 'Retest/Verify' || i.status === 'In Review').length;
      const resolvedCount = userIssues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
      const criticalHighCount = userIssues.filter(i => 
        (i.severity === 'Critical' || i.severity === 'High' || i.priority === 'P1') &&
        (i.status !== 'Resolved' && i.status !== 'Closed')
      ).length;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || 'Developer',
        assigned_defects: userIssues.length,
        open_defects: openCount,
        resolved_defects: resolvedCount,
        critical_high_defects: criticalHighCount
      };
    });

    // 6. Defect Trends (Created vs Resolved over time)
    // Generate buckets based on time_range
    const trendMap = {};
    const daysCount = time_range === '7d' ? 7 : time_range === '30d' ? 30 : time_range === '90d' ? 90 : 30;
    
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().split('T')[0];
      trendMap[dateKey] = { date: dateKey, created: 0, resolved: 0 };
    }

    const toDateKey = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (e) {}
      return String(val).split('T')[0];
    };

    allIssues.forEach(i => {
      if (i.created_at) {
        const createdDate = toDateKey(i.created_at);
        if (createdDate && trendMap[createdDate]) {
          trendMap[createdDate].created++;
        }
      }
      if ((i.status === 'Resolved' || i.status === 'Closed')) {
        const resDate = toDateKey(i.resolved_at || i.updated_at || i.created_at);
        if (resDate && trendMap[resDate]) {
          trendMap[resDate].resolved++;
        }
      }
    });

    const defectTrends = Object.values(trendMap);


    // 7. Average Resolution Time
    let totalResolutionHours = 0;
    let resolvedWithDurationCount = 0;

    allIssues.forEach(i => {
      if ((i.status === 'Resolved' || i.status === 'Closed') && (i.resolved_at || i.updated_at)) {
        const createdTime = new Date(i.created_at).getTime();
        const resolvedTime = new Date(i.resolved_at || i.updated_at).getTime();
        if (resolvedTime >= createdTime) {
          const diffHours = (resolvedTime - createdTime) / (1000 * 60 * 60);
          totalResolutionHours += diffHours;
          resolvedWithDurationCount++;
        }
      }
    });

    const avgResolutionHours = resolvedWithDurationCount > 0 
      ? Math.round((totalResolutionHours / resolvedWithDurationCount) * 10) / 10 
      : 0;

    const avgResolutionDays = avgResolutionHours > 0 
      ? Math.round((avgResolutionHours / 24) * 10) / 10 
      : 0;

    let formattedResolutionTime = 'N/A';
    if (resolvedWithDurationCount > 0) {
      if (avgResolutionHours < 24) {
        formattedResolutionTime = `${avgResolutionHours} hrs`;
      } else {
        formattedResolutionTime = `${avgResolutionDays} days`;
      }
    }

    res.json({
      time_range,
      summary: {
        total_defects: totalDefects,
        open_defects: openDefects,
        in_progress_defects: inProgressDefects,
        resolved_defects: resolvedDefects,
        closed_defects: closedDefects
      },
      by_severity: severityCounts,
      by_category: categoryCounts,
      by_status: statusCounts,
      developer_workload: developerWorkload,
      defect_trends: defectTrends,
      average_resolution_time: {
        hours: avgResolutionHours,
        days: avgResolutionDays,
        formatted: formattedResolutionTime,
        resolved_count: resolvedWithDurationCount
      }
    });
  } catch (err) {
    console.error('Analytics API error:', err);
    res.status(500).json({ error: 'Failed to calculate analytics metrics.' });
  }
});

/**
 * GET /api/analytics/trend-explanation
 * Feature 25: Defect Trend Explanation
 * Produces grounded natural language summary of defect velocity and trends based on actual database data.
 */
router.get('/trend-explanation', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = 'SELECT * FROM issues WHERE 1=1';
    const params = [];
    if (project_id) {
      sql += ' AND project_id = ?';
      params.push(parseInt(project_id, 10));
    }
    const allIssues = await query(sql, params);

    if (!allIssues || allIssues.length === 0) {
      return res.json({
        success: true,
        has_enough_data: false,
        explanation: "No defect data available yet to analyze system trends.",
        summary_title: "Defect Trend Baseline"
      });
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const recentIssues = allIssues.filter(i => new Date(i.created_at) >= fourteenDaysAgo);
    const prevIssues = allIssues.filter(i => {
      const d = new Date(i.created_at);
      return d >= twentyEightDaysAgo && d < fourteenDaysAgo;
    });

    const recentCritical = recentIssues.filter(i => i.severity === 'Critical' || i.priority === 'P1').length;
    const prevCritical = prevIssues.filter(i => i.severity === 'Critical' || i.priority === 'P1').length;

    const compCounts = {};
    recentIssues.forEach(i => {
      const c = i.component || 'Frontend UI';
      compCounts[c] = (compCounts[c] || 0) + 1;
    });
    const topRecentComp = Object.entries(compCounts).sort((a, b) => b[1] - a[1])[0];
    const resolvedRecent = recentIssues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;

    let explanation = '';
    let trendDirection = 'stable';

    if (recentCritical > prevCritical) {
      const diff = recentCritical - prevCritical;
      trendDirection = 'increased';
      explanation = `Critical defects increased over the recent evaluation window (+${diff} P1/Critical issues), primarily concentrated in the ${topRecentComp ? topRecentComp[0] : 'core'} component. Active engineering attention is recommended on resolving open blockers.`;
    } else if (recentCritical < prevCritical) {
      trendDirection = 'decreased';
      explanation = `Critical defects decreased compared to the previous period, reflecting positive defect resolution velocity. ${resolvedRecent} issues were resolved in recent cycles.`;
    } else {
      explanation = `Defect creation velocity remains stable with ${recentIssues.length} issues reported in the last 14 days. ${topRecentComp ? `The most active component is ${topRecentComp[0]} with ${topRecentComp[1]} reports.` : ''} Overall resolution progression is on track.`;
    }

    res.json({
      success: true,
      has_enough_data: true,
      summary_title: "Defect Velocity & Trend Analysis",
      trend_direction: trendDirection,
      trajectory: trendDirection,
      recent_critical: recentCritical,
      previous_critical: prevCritical,
      recent_total: recentIssues.length,
      recent_resolved: resolvedRecent,
      top_component: topRecentComp ? topRecentComp[0] : null,
      explanation,
      narrative: explanation,
      metrics: {
        created_recent: recentIssues.length,
        resolved_recent: resolvedRecent,
        critical_recent: recentCritical
      }
    });
  } catch (err) {
    console.error('Trend explanation error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate trend explanation.', message: err.message });
  }
});

/**
 * GET /api/analytics/early-warning
 * Feature 26: Critical Defect Early Warning
 * Triggers analytical alert when abnormal spikes in critical defects or unresolved backlog occur.
 */
router.get('/early-warning', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = 'SELECT * FROM issues WHERE 1=1';
    const params = [];
    if (project_id) {
      sql += ' AND project_id = ?';
      params.push(parseInt(project_id, 10));
    }
    const allIssues = await query(sql, params);

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const currentCritical = allIssues.filter(i => (i.severity === 'Critical' || i.priority === 'P1') && i.status !== 'Resolved' && i.status !== 'Closed');
    const recentCreatedCritical = allIssues.filter(i => (i.severity === 'Critical' || i.priority === 'P1') && new Date(i.created_at) >= fourteenDaysAgo).length;
    const prevCreatedCritical = allIssues.filter(i => {
      const d = new Date(i.created_at);
      return (i.severity === 'Critical' || i.priority === 'P1') && d >= twentyEightDaysAgo && d < fourteenDaysAgo;
    }).length;

    const percentChange = prevCreatedCritical > 0
      ? Math.round(((recentCreatedCritical - prevCreatedCritical) / prevCreatedCritical) * 100)
      : (recentCreatedCritical > 0 ? 100 : 0);

    const isWarning = currentCritical.length >= 3 || (recentCreatedCritical > prevCreatedCritical && recentCreatedCritical >= 2);
    const isCriticalAlert = currentCritical.length >= 5 || percentChange >= 100;

    const compMap = {};
    currentCritical.forEach(i => {
      const c = i.component || 'Frontend UI';
      compMap[c] = (compMap[c] || 0) + 1;
    });

    const affectedComponents = Object.entries(compMap).map(([component, count]) => ({
      component,
      critical_count: count
    }));

    let message = 'Defect intake and critical defect rates are within normal operational thresholds.';
    if (isCriticalAlert) {
      message = `High Priority Alert: Critical defects have spiked by ${percentChange}% compared with the previous period. Active backlog contains ${currentCritical.length} unresolved P1 blockers.`;
    } else if (isWarning) {
      message = `Advisory: An increase in critical defects has been detected (${currentCritical.length} active blockers). Prioritize verification and patch deployment.`;
    }

    const isLevel = isCriticalAlert ? 'CRITICAL' : isWarning ? 'WARNING' : 'OK';
    const levelDisplay = isCriticalAlert ? 'Critical' : isWarning ? 'Warning' : 'Normal';
    const recText = isWarning || isCriticalAlert 
      ? "Reallocate available engineering bandwidth to address open P1 blockers in the highlighted components before sprint closure."
      : "Standard triage workflow is sufficient. Maintain current development velocity.";

    res.json({
      success: true,
      alert_active: isWarning || isCriticalAlert,
      active: isWarning || isCriticalAlert,
      level: isLevel,
      level_name: levelDisplay,
      current_unresolved_critical: currentCritical.length,
      recent_created_critical: recentCreatedCritical,
      previous_period_critical: prevCreatedCritical,
      change_percentage: percentChange,
      affected_components: affectedComponents,
      message,
      recommendation: recText,
      recommendations: [recText]
    });
  } catch (err) {
    console.error('Early warning error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute early warning status.', message: err.message });
  }
});

/**
 * GET /api/analytics/insight-of-the-day
 * Feature 28: Intelligent Insight of the Day
 * Highlights one meaningful, mathematically sound insight derived from live database metrics.
 */
router.get('/insight-of-the-day', authMiddleware, async (req, res) => {
  try {
    const allIssues = await query('SELECT * FROM issues ORDER BY created_at DESC');

    if (!allIssues || allIssues.length === 0) {
      return res.json({
        success: true,
        insight: "Defect tracking system online. Report your first defect to begin generating intelligent insights.",
        tag: "System Status",
        type: "status"
      });
    }

    const openIssues = allIssues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');
    const resolvedIssues = allIssues.filter(i => i.status === 'Resolved' || i.status === 'Closed');

    const compCounts = {};
    openIssues.forEach(i => {
      const c = i.component || 'Frontend UI';
      compCounts[c] = (compCounts[c] || 0) + 1;
    });

    const sortedComps = Object.entries(compCounts).sort((a, b) => b[1] - a[1]);
    const topComp = sortedComps[0];

    const candidates = [];

    if (topComp && topComp[1] >= 2) {
      candidates.push({
        insight: `${topComp[0]} is currently the most affected component with ${topComp[1]} active defect(s) awaiting resolution.`,
        tag: "Component Focus",
        type: "focus"
      });
    }

    const unassignedCritical = openIssues.filter(i => (i.severity === 'Critical' || i.priority === 'P1') && !i.assignee_id).length;
    if (unassignedCritical > 0) {
      candidates.push({
        insight: `There are ${unassignedCritical} critical (P1) defect(s) currently unassigned in the backlog. Immediate triage recommended.`,
        tag: "Triage Alert",
        type: "warning"
      });
    }

    if (resolvedIssues.length >= 2) {
      let totalH = 0;
      let count = 0;
      resolvedIssues.forEach(i => {
        if (i.created_at && (i.resolved_at || i.updated_at)) {
          const diff = (new Date(i.resolved_at || i.updated_at) - new Date(i.created_at)) / (1000 * 60 * 60 * 24);
          if (diff >= 0) { totalH += diff; count++; }
        }
      });
      if (count > 0) {
        const avgD = Math.round((totalH / count) * 10) / 10;
        candidates.push({
          insight: `Average resolution turnaround is ${avgD} day(s) across ${count} verified defects in this project.`,
          tag: "Velocity Benchmark",
          type: "metric"
        });
      }
    }

    if (candidates.length === 0) {
      candidates.push({
        insight: `Defect resolution rate is currently ${Math.round((resolvedIssues.length / Math.max(allIssues.length, 1)) * 100)}% with ${openIssues.length} active issue(s) under review.`,
        tag: "System Telemetry",
        type: "metric"
      });
    }

    const selected = candidates[0];
    res.json({
      success: true,
      insight: selected.insight,
      headline: selected.tag,
      metric: selected.type,
      explanation: selected.insight,
      tag: selected.tag,
      type: selected.type
    });
  } catch (err) {
    console.error('Insight of the day error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate insight.', message: err.message });
  }
});

/**
 * GET /api/analytics/defect-clusters
 * Feature 24: Defect Cluster / Issue Map
 * Groups defects hierarchically by Category -> Component -> Topics.
 */
router.get('/defect-clusters', authMiddleware, async (req, res) => {
  try {
    const allIssues = await query('SELECT id, title, status, priority, severity, component, category FROM issues ORDER BY id DESC');

    const tree = {};

    allIssues.forEach(issue => {
      const cat = issue.category || 'General';
      const comp = issue.component || 'Frontend UI';
      const text = issue.title.toLowerCase();

      let topic = 'State Lifecycle & Logic';
      if (text.includes('token') || text.includes('session') || text.includes('jwt') || text.includes('auth') || text.includes('login')) {
        topic = 'Session Timeout & Token Errors';
      } else if (text.includes('pay') || text.includes('stripe') || text.includes('billing') || text.includes('card')) {
        topic = 'Payment Gateway & Charges';
      } else if (text.includes('modal') || text.includes('align') || text.includes('ui') || text.includes('css') || text.includes('layout')) {
        topic = 'UI Layout & Alignment';
      } else if (text.includes('sql') || text.includes('database') || text.includes('pool') || text.includes('connection')) {
        topic = 'Database Connection & Queries';
      } else if (text.includes('upload') || text.includes('file')) {
        topic = 'File Upload & Multipart';
      }

      if (!tree[cat]) tree[cat] = { category: cat, total: 0, components: {} };
      tree[cat].total++;

      if (!tree[cat].components[comp]) tree[cat].components[comp] = { component: comp, total: 0, topics: {} };
      tree[cat].components[comp].total++;

      if (!tree[cat].components[comp].topics[topic]) {
        tree[cat].components[comp].topics[topic] = {
          name: topic,
          count: 0,
          defect_ids: []
        };
      }
      tree[cat].components[comp].topics[topic].count++;
      tree[cat].components[comp].topics[topic].defect_ids.push(`DEF-${issue.id}`);
    });

    const clusters = Object.values(tree).map(catObj => ({
      category: catObj.category,
      total: catObj.total,
      components: Object.values(catObj.components).map(compObj => ({
        component: compObj.component,
        total: compObj.total,
        topics: Object.values(compObj.topics)
      }))
    }));

    res.json({
      success: true,
      total_defects: allIssues.length,
      total_defects_mapped: allIssues.length,
      clusters
    });
  } catch (err) {
    console.error('Defect clusters error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate defect clusters.', message: err.message });
  }
});

/**
 * GET /api/analytics/sprint-health/:sprintId
 * Feature 29: Sprint Health Score
 * Evaluates sprint health based on velocity, remaining defects, workload, and timeline.
 */
router.get('/sprint-health/:sprintId', authMiddleware, async (req, res) => {
  try {
    const sprintId = parseInt(req.params.sprintId, 10);
    if (isNaN(sprintId)) {
      return res.status(400).json({ success: false, error: 'Invalid sprint ID.' });
    }

    let sprint = await queryOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!sprint) {
      sprint = await queryOne('SELECT * FROM sprints ORDER BY id ASC LIMIT 1');
    }
    if (!sprint) {
      sprint = { id: sprintId, name: `Sprint ${sprintId} (Active)` };
    }

    const sprintIssues = await query('SELECT * FROM issues WHERE sprint_id = ?', [sprint.id]);
    if (!sprintIssues || sprintIssues.length === 0) {
      return res.json({
        success: true,
        has_enough_data: false,
        sprint_name: sprint.name,
        health_score: 100,
        status: "Empty Sprint",
        status_label: "Empty Sprint",
        message: "No defects currently assigned to this sprint."
      });
    }

    const total = sprintIssues.length;
    const resolved = sprintIssues.filter(i => i.status === 'Resolved' || i.status === 'Closed' || i.status === 'Verified').length;
    const critical = sprintIssues.filter(i => (i.severity === 'Critical' || i.priority === 'P1') && i.status !== 'Resolved' && i.status !== 'Closed').length;
    const high = sprintIssues.filter(i => (i.severity === 'High' || i.priority === 'P2') && i.status !== 'Resolved' && i.status !== 'Closed').length;

    const completionRate = total > 0 ? (resolved / total) : 0;
    
    let timelineScore = 80;
    if (sprint.start_date && sprint.end_date) {
      const now = new Date().getTime();
      const start = new Date(sprint.start_date).getTime();
      const end = new Date(sprint.end_date).getTime();
      if (end > start) {
        const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
        if (elapsed > 0.7 && completionRate < 0.4) {
          timelineScore = 40;
        } else if (completionRate >= elapsed) {
          timelineScore = 95;
        }
      }
    }

    const severityPenalty = Math.min(40, (critical * 15) + (high * 5));
    const rawScore = Math.round((completionRate * 40) + (timelineScore * 0.3) + Math.max(0, 30 - severityPenalty));
    const score = Math.max(10, Math.min(100, rawScore));

    let statusLabel = 'On Track';
    let statusColor = '#10B981';
    if (score < 50) {
      statusLabel = 'At Risk';
      statusColor = '#EF4444';
    } else if (score < 75) {
      statusLabel = 'Needs Attention';
      statusColor = '#F59E0B';
    }

    res.json({
      success: true,
      has_enough_data: true,
      sprint_id: sprint.id,
      sprint_name: sprint.name,
      health_score: score,
      status: statusLabel,
      status_label: statusLabel,
      status_color: statusColor,
      metrics: {
        total_defects: total,
        resolved_defects: resolved,
        remaining_critical: critical,
        remaining_high: high,
        completion_percentage: Math.round(completionRate * 100)
      },
      factors: [
        `Resolution Progress: ${resolved}/${total} issues resolved (${Math.round(completionRate * 100)}%)`,
        critical > 0 ? `${critical} unresolved critical P1 defect(s) affecting score` : "Zero critical P1 blockers remaining in sprint",
        `Sprint timeline pacing: ${timelineScore >= 80 ? 'On Track' : 'Behind Velocity Schedule'}`
      ]
    });
  } catch (err) {
    console.error('Sprint health error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute sprint health score.', message: err.message });
  }
});

module.exports = router;
