const assert = require('assert');
const { app, startServer } = require('../server');

const PORT = 5058;
let serverInstance;
let authToken = '';

async function request(path, options = {}) {
  const url = `http://localhost:${PORT}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken && headers['Authorization'] === undefined) {
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

async function runAssistantTests() {
  console.log('🧪 Starting DefectX AI Assistant Pipeline Test Suite...\n');
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
    process.env.NODE_ENV = 'test';
    await startServer();
    await new Promise((resolve) => {
      serverInstance = app.listen(PORT, () => {
        console.log(`  🚀 Test server running on port ${PORT}`);
        resolve();
      });
    });

    // Login or register to get JWT token
    const testEmail = `assistant_tester_${Date.now()}@defectx.io`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'AI Test Lead',
        email: testEmail,
        password: 'Password123!',
        role: 'QA Engineer'
      }
    });
    assert.strictEqual(regRes.status, 201);
    authToken = regRes.data.token;

    // 1. Authentication check
    await it('POST /api/ai/assistant rejects unauthenticated requests with 401', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Authorization': '' },
        body: { message: 'Hello' }
      });
      assert.strictEqual(res.status, 401);
    });

    // 2. Validation check
    await it('POST /api/ai/assistant validates empty message with 400', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        body: { message: '   ' }
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error);
    });

    // 3. Intent Detection & Grounded Critical Bugs
    await it('POST /api/ai/assistant identifies CRITICAL_BUGS intent and provides grounded answer', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        body: { message: 'What are the critical P1 bugs in the system right now?' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.intent, 'CRITICAL_BUGS');
      assert.ok(res.data.answer);
      assert.ok(res.data.telemetry);
      assert.strictEqual(typeof res.data.telemetry.total, 'number');
      assert.ok(Array.isArray(res.data.suggestions));
    });

    // 4. Intent Detection & System Metrics
    await it('POST /api/ai/assistant identifies SYSTEM_METRICS intent and provides quality telemetry', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        body: { message: 'Give me the overall system telemetry and total bug counts' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.intent, 'SYSTEM_METRICS');
      assert.ok(res.data.answer.includes('Telemetry Overview') || res.data.answer.includes('DefectX'));
      assert.ok(res.data.telemetry.total >= 0);
    });

    // 5. Semantic Retrieval for component search
    await it('POST /api/ai/assistant performs semantic retrieval on authentication defects', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        body: { message: 'Are there any authentication token expiration issues?' }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.answer);
      assert.ok(Array.isArray(res.data.grounded_defects));
    });

    // 6. Historical Context Retrieval
    await it('POST /api/ai/assistant retrieves historical resolution for past defects', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        body: { message: 'What was the previous root cause and historical fix for alignment defects?' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.intent, 'HISTORICAL_RESOLUTION');
      assert.ok(res.data.answer);
      assert.ok(Array.isArray(res.data.historical_context));
    });

    // 7. Specific Issue Lookup
    await it('POST /api/ai/assistant returns structured details when asked about #1', async () => {
      const res = await request('/api/ai/assistant', {
        method: 'POST',
        body: { message: 'Can you show me details for bug #1?' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.intent, 'SPECIFIC_ISSUE');
      assert.ok(res.data.answer.includes('#1') || res.data.answer.includes('Defect #1'));
    });

    // 8. Alias /api/ai/chat works identically
    await it('POST /api/ai/chat alias functions as expected', async () => {
      const res = await request('/api/ai/chat', {
        method: 'POST',
        body: { message: 'Hello! What can you help me with?' }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.answer);
    });

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    console.log(`\n🏁 Test Suite Complete: ${passed} Passed, ${failed} Failed\n`);
    if (failed > 0) process.exit(1);
  }
}

runAssistantTests();
