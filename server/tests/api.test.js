const assert = require('assert');
const http = require('http');
const { app, startServer } = require('../server');

const PORT = 5055;
let serverInstance;
let authToken = '';
let createdIssueId = null;
let testUserId = null;

// Helper to make HTTP requests against the test server
async function request(path, options = {}) {
  const url = `http://localhost:${PORT}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  };

  const res = await fetch(url, fetchOptions);
  let json = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    json = await res.json();
  } else {
    json = await res.text();
  }

  return { status: res.status, headers: res.headers, data: json };
}

// Test Runner
async function runTests() {
  console.log('🧪 Starting DefectX API & Resolution Intelligence Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function it(title, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${title}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  try {
    // Start test server
    process.env.NODE_ENV = 'test';
    await startServer();
    await new Promise((resolve) => {
      serverInstance = app.listen(PORT, () => {
        console.log(`  🚀 Test server running on port ${PORT}`);
        resolve();
      });
    });

    // 1. Health Check
    await it('GET /api/health returns 200 OK', async () => {
      const res = await request('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'ok');
    });

    // 2. Authentication Flow
    await it('POST /api/auth/register creates a new developer user', async () => {
      const testEmail = `dev_${Date.now()}@defectx.io`;
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'CI Automation Engineer',
          email: testEmail,
          password: 'TestPassword123!',
          role: 'Backend Test Lead'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.token, 'Expected JWT token');
      assert.strictEqual(res.data.user.email, testEmail);
      authToken = res.data.token;
      testUserId = res.data.user.id;
    });

    await it('GET /api/auth/me returns authenticated profile with Bearer token', async () => {
      const res = await request('/api/auth/me');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.id, testUserId);
    });

    await it('GET /api/users returns team member list', async () => {
      const res = await request('/api/users');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.users));
      assert.ok(res.data.users.length > 0);
    });

    // 3. Project Management
    let testProjectId = 1;
    await it('GET /api/projects lists projects', async () => {
      const res = await request('/api/projects');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.projects));
      if (res.data.projects.length > 0) {
        testProjectId = res.data.projects[0].id;
      }
    });

    // 4. Defect Creation, Assignment & Lifecycle
    await it('POST /api/issues creates a defect', async () => {
      const res = await request('/api/issues', {
        method: 'POST',
        body: {
          title: 'Memory Leak in High-Concurrency WebSocket Listener',
          description: 'Client disconnects do not clean up socket event emitter listeners, causing heap growth over time.',
          type: 'Bug',
          priority: 'P1',
          severity: 'Critical',
          component: 'Performance & Memory',
          project_id: testProjectId
        }
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.issue.id);
      assert.strictEqual(res.data.issue.status, 'Open');
      createdIssueId = res.data.issue.id;
    });

    await it('PUT /api/issues/:id transitions status to In Progress and assigns developer', async () => {
      const res = await request(`/api/issues/${createdIssueId}`, {
        method: 'PUT',
        body: {
          status: 'In Progress',
          assignee_id: testUserId
        }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.issue.status, 'In Progress');
      assert.strictEqual(res.data.issue.assignee_id, testUserId);
    });

    // 5. Milestone 3: Resolution Workflow
    await it('POST /api/issues/:id/resolve resolves defect with root cause and resolution notes', async () => {
      const res = await request(`/api/issues/${createdIssueId}/resolve`, {
        method: 'POST',
        body: {
          root_cause: 'Missing socket.off("message") cleanup callback in disconnect handler.',
          resolution_notes: 'Added EventEmitter listener cleanup in onDisconnect hook and added memory leak regression test.'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.issue.status, 'Resolved');
      assert.ok(res.data.issue.resolved_at, 'Expected resolved_at timestamp');
      assert.strictEqual(res.data.issue.root_cause, 'Missing socket.off("message") cleanup callback in disconnect handler.');
    });

    // 6. Milestone 3: AI Intelligence Endpoints
    await it('POST /api/ai/summarize generates concise defect summary', async () => {
      const res = await request('/api/ai/summarize', {
        method: 'POST',
        body: {
          title: 'Payment Checkout API is Triggered Twice on Submit',
          description: 'Rapid double clicking dispatches duplicate POST calls without idempotency keys.',
          component: 'Billing & Payments',
          severity: 'Critical'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.summary, 'Expected summary string');
      assert.ok(res.data.category);
    });

    await it('POST /api/ai/resolution-recommendation generates actionable developer guidance', async () => {
      const res = await request('/api/ai/resolution-recommendation', {
        method: 'POST',
        body: {
          title: 'Database Connection Pool Exhaustion under Heavy Load',
          description: 'Connections are unreleased in error boundary.',
          component: 'Database',
          severity: 'Critical'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.recommendation);
      assert.ok(Array.isArray(res.data.key_steps));
      assert.ok(Array.isArray(res.data.precautions));
    });

    await it('POST /api/ai/historical-resolutions retrieves similar resolved defects with similarity scores', async () => {
      const res = await request('/api/ai/historical-resolutions', {
        method: 'POST',
        body: {
          title: 'Duplicate Payment Requests during Checkout',
          description: 'Payment gateway API triggered repeatedly without debounce.',
          component: 'Billing & Payments'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.matches));
      if (res.data.matches.length > 0) {
        const topMatch = res.data.matches[0];
        assert.ok(topMatch.defect_id);
        assert.ok(topMatch.similarity !== undefined);
        assert.ok(topMatch.previous_root_cause);
      }
    });

    await it('POST /api/ai/investigate-root-cause returns prioritized investigation checklist', async () => {
      const res = await request('/api/ai/investigate-root-cause', {
        method: 'POST',
        body: {
          title: 'Authentication Session Expiry Loop',
          description: 'JWT token timestamp unit comparison failure.',
          component: 'Authentication',
          severity: 'High'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.investigation_suggestions));
      assert.strictEqual(res.data.investigation_suggestions.length, 5);
      assert.ok(res.data.disclaimer);
    });

    await it('POST /api/ai/verify-resolution validates developer resolution notes', async () => {
      const res = await request('/api/ai/verify-resolution', {
        method: 'POST',
        body: {
          title: 'Payment Checkout API is Triggered Twice',
          description: 'Double click on checkout triggers duplicate charges.',
          resolution_notes: 'Added client-side button debouncing and backend idempotency key validation on Stripe charges.'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.status);
      assert.ok(res.data.summary);
    });

    // 7. Milestone 3: Analytics Dashboard API
    await it('GET /api/analytics returns complete telemetry and KPI metrics', async () => {
      const res = await request('/api/analytics?time_range=30d');
      assert.strictEqual(res.status, 200);
      
      // Summary cards check
      assert.ok(res.data.summary);
      assert.ok(typeof res.data.summary.total_defects === 'number');
      assert.ok(typeof res.data.summary.resolved_defects === 'number');

      // Severity breakdown check
      assert.ok(res.data.by_severity);
      assert.ok(typeof res.data.by_severity.Critical === 'number');

      // Category breakdown check
      assert.ok(res.data.by_category);

      // Status breakdown check
      assert.ok(res.data.by_status);

      // Developer workload check
      assert.ok(Array.isArray(res.data.developer_workload));

      // Trend series check
      assert.ok(Array.isArray(res.data.defect_trends));

      // Average resolution time check
      assert.ok(res.data.average_resolution_time);
      assert.ok(res.data.average_resolution_time.formatted);
    });

    // 8. Milestone 3: OpenAPI / Swagger Docs
    await it('GET /api-docs serves Swagger UI documentation', async () => {
      const res = await request('/api-docs/');
      assert.strictEqual(res.status, 200);
    });

    // 9. Milestone 4: Defect Health Indicator
    await it('GET /api/issues includes health_indicator with SLA metrics', async () => {
      const res = await request('/api/issues');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.issues));
      const targetIssue = res.data.issues.find(i => i.id === createdIssueId);
      assert.ok(targetIssue, 'Target issue should exist');
      assert.ok(targetIssue.health_indicator, 'Expected health_indicator on defect');
      assert.ok(targetIssue.health_indicator.status);
      assert.ok(targetIssue.health_indicator.label);
      assert.strictEqual(typeof targetIssue.health_indicator.sla_hours, 'number');
      assert.strictEqual(typeof targetIssue.health_indicator.is_breached, 'boolean');
    });

    // 10. Milestone 4: Defect Dependency Mapping
    let secondIssueId = null;
    let createdDependencyId = null;

    await it('POST /api/issues creates a secondary defect for dependency linking', async () => {
      const res = await request('/api/issues', {
        method: 'POST',
        body: {
          title: 'WebSocket Reconnection Backoff Strategy Fault',
          description: 'Client reconnect loops aggressively on dropped socket connection.',
          type: 'Bug',
          priority: 'P2',
          severity: 'High',
          component: 'Performance & Memory',
          project_id: testProjectId
        }
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.issue.id);
      secondIssueId = res.data.issue.id;
    });

    await it('POST /api/issues/:id/dependencies creates a dependency relation', async () => {
      const res = await request(`/api/issues/${createdIssueId}/dependencies`, {
        method: 'POST',
        body: {
          target_issue_id: secondIssueId,
          relationship_type: 'blocks',
          notes: 'WebSocket memory leak blocks reconnection test verification'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.dependency);
      assert.ok(res.data.dependency.relationship_type.toLowerCase() === 'blocks');
      createdDependencyId = res.data.dependency.id;
    });

    await it('POST /api/issues/:id/dependencies validates and rejects self-dependency with 400', async () => {
      const res = await request(`/api/issues/${createdIssueId}/dependencies`, {
        method: 'POST',
        body: {
          target_issue_id: createdIssueId,
          relationship_type: 'blocks'
        }
      });
      assert.strictEqual(res.status, 400);
    });

    await it('POST /api/issues/:id/dependencies validates and rejects invalid relationship type with 400', async () => {
      const res = await request(`/api/issues/${createdIssueId}/dependencies`, {
        method: 'POST',
        body: {
          target_issue_id: secondIssueId,
          relationship_type: 'invalid_rel_type'
        }
      });
      assert.strictEqual(res.status, 400);
    });

    await it('GET /api/issues/:id/dependencies returns bidirectional dependencies', async () => {
      const res = await request(`/api/issues/${createdIssueId}/dependencies`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.dependencies));
      assert.ok(res.data.dependencies.length > 0);
      const dep = res.data.dependencies.find(d => d.id === createdDependencyId);
      assert.ok(dep, 'Created dependency should be in list');
    });

    await it('GET /api/issues/:id/dependency-graph returns nodes and edges graph structure', async () => {
      const res = await request(`/api/issues/${createdIssueId}/dependency-graph`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.nodes));
      assert.ok(Array.isArray(res.data.edges));
      assert.ok(res.data.nodes.length >= 2);
      assert.ok(res.data.edges.length >= 1);
      const rootNode = res.data.nodes.find(n => n.id === createdIssueId);
      assert.ok(rootNode, 'Root node should be present in dependency graph');
    });

    await it('DELETE /api/issues/:id/dependencies/:depId deletes dependency', async () => {
      const res = await request(`/api/issues/${createdIssueId}/dependencies/${createdDependencyId}`, {
        method: 'DELETE'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
    });

    // 11. Milestone 4: AI Pattern Detection, Regression Risk, Semantic Search
    await it('GET /api/ai/patterns returns recurring defect patterns', async () => {
      const res = await request('/api/ai/patterns');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.patterns));
      if (res.data.patterns.length > 0) {
        const p = res.data.patterns[0];
        assert.ok(p.pattern_id);
        assert.ok(p.pattern_name);
        assert.ok(typeof p.recurrence_count === 'number');
        assert.ok(Array.isArray(p.linked_defect_ids));
      }
    });

    await it('GET /api/ai/regression-risk/:issueId computes regression risk metrics', async () => {
      const res = await request(`/api/ai/regression-risk/${createdIssueId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(['Low', 'Medium', 'High'].includes(res.data.risk_level));
      assert.ok(typeof res.data.risk_score === 'number');
      assert.ok(Array.isArray(res.data.recommended_checks));
      assert.ok(res.data.disclaimer);
    });

    await it('POST /api/ai/semantic-search performs NLP TF-IDF similarity query', async () => {
      const res = await request('/api/ai/semantic-search', {
        method: 'POST',
        body: {
          query: 'WebSocket memory leak disconnect listener'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.results));
      assert.ok(res.data.results.length > 0);
      assert.ok(res.data.results[0].relevance_score > 0);
      assert.ok(res.data.query_tokens);
    });

    // 12. Milestone 4: Analytics Endpoints
    await it('GET /api/analytics/trend-explanation returns grounded trajectory explanation', async () => {
      const res = await request('/api/analytics/trend-explanation');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.trajectory);
      assert.ok(res.data.narrative);
      assert.ok(typeof res.data.metrics.created_recent === 'number');
      assert.ok(typeof res.data.metrics.resolved_recent === 'number');
    });

    await it('GET /api/analytics/early-warning evaluates project risk telemetry', async () => {
      const res = await request('/api/analytics/early-warning');
      assert.strictEqual(res.status, 200);
      assert.ok(['OK', 'WARNING', 'CRITICAL'].includes(res.data.level));
      assert.ok(typeof res.data.active === 'boolean');
      assert.ok(Array.isArray(res.data.recommendations));
    });

    await it('GET /api/analytics/insight-of-the-day returns dynamic grounded insight', async () => {
      const res = await request('/api/analytics/insight-of-the-day');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.headline);
      assert.ok(res.data.metric);
      assert.ok(res.data.explanation);
    });

    await it('GET /api/analytics/defect-clusters returns hierarchical issue map', async () => {
      const res = await request('/api/analytics/defect-clusters');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.clusters));
      assert.ok(typeof res.data.total_defects_mapped === 'number');
    });

    await it('GET /api/analytics/sprint-health/:sprintId returns sprint health telemetry', async () => {
      const res = await request('/api/analytics/sprint-health/1');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.data.health_score === 'number');
      assert.ok(res.data.status_label);
      assert.ok(res.data.metrics);
    });

  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n=============================================');
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
