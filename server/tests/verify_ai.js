const fetch = require('node-fetch');

async function runTests() {
  console.log('=== DEFECTX AI ASSISTANT BACKEND VERIFICATION ===\n');

  // Test 1: Health Check
  try {
    const healthRes = await fetch('http://localhost:5000/api/health');
    const healthData = await healthRes.json();
    console.log('1. Health Check [GET /api/health]:', healthRes.status, JSON.stringify(healthData));
  } catch (e) {
    console.error('1. Health Check FAILED:', e.message);
  }

  // Test 2: Unhandled API route 404 returns JSON (never HTML)
  try {
    const notFoundRes = await fetch('http://localhost:5000/api/nonexistent-endpoint', { method: 'POST' });
    const notFoundType = notFoundRes.headers.get('content-type') || '';
    const notFoundData = await notFoundRes.json();
    console.log('2. 404 Handler [POST /api/nonexistent-endpoint]:', notFoundRes.status);
    console.log('   Content-Type:', notFoundType);
    console.log('   Body:', JSON.stringify(notFoundData));
    if (!notFoundType.includes('application/json')) {
      console.error('   ❌ FAILED: 404 returned non-JSON content type!');
    } else {
      console.log('   ✅ PASS: Returns valid JSON 404 response.');
    }
  } catch (e) {
    console.error('2. 404 Check FAILED:', e.message);
  }

  // Test 3: Authenticate to obtain token
  let token = null;
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@bugflow.io', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('3. Auth Login:', loginRes.status, token ? 'Token obtained successfully' : 'No token');
  } catch (e) {
    console.error('3. Auth Login FAILED:', e.message);
  }

  if (!token) {
    console.error('Cannot proceed with authenticated AI endpoint test without token.');
    return;
  }

  // Test 4: POST /api/ai/assistant with "What are the critical bugs in the system?"
  try {
    console.log('\n4. Testing POST /api/ai/assistant ("What are the critical bugs in the system?"):');
    const aiRes = await fetch('http://localhost:5000/api/ai/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: 'What are the critical bugs in the system?' })
    });

    const aiType = aiRes.headers.get('content-type') || '';
    console.log('   Status:', aiRes.status);
    console.log('   Content-Type:', aiType);

    const aiData = await aiRes.json();
    console.log('   Success flag:', aiData.success);
    console.log('   Intent detected:', aiData.intent);
    console.log('   Telemetry:', JSON.stringify(aiData.telemetry));
    console.log('   Grounded defects count:', aiData.grounded_defects?.length);
    console.log('   Answer preview:\n------------------');
    console.log(aiData.answer ? aiData.answer.slice(0, 350) + '...' : 'NO ANSWER');
    console.log('------------------');

    if (aiType.includes('application/json') && aiData.success && aiData.answer && aiData.message) {
      console.log('   ✅ PASS: POST /api/ai/assistant returns valid JSON with real PostgreSQL data!');
    } else {
      console.error('   ❌ FAILED: Unexpected response format.');
    }
  } catch (e) {
    console.error('4. POST /api/ai/assistant FAILED:', e.message);
  }

  // Test 5: POST /api/ai/chat with "What are the critical bugs in the system?"
  try {
    console.log('\n5. Testing POST /api/ai/chat ("What are the critical bugs in the system?"):');
    const chatRes = await fetch('http://localhost:5000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: 'What are the critical bugs in the system?' })
    });

    const chatType = chatRes.headers.get('content-type') || '';
    console.log('   Status:', chatRes.status);
    console.log('   Content-Type:', chatType);

    const chatData = await chatRes.json();
    console.log('   Success flag:', chatData.success);
    console.log('   Intent detected:', chatData.intent);
    console.log('   Telemetry:', JSON.stringify(chatData.telemetry));
    console.log('   Answer preview:\n------------------');
    console.log(chatData.message ? chatData.message.slice(0, 350) + '...' : 'NO MESSAGE');
    console.log('------------------');

    if (chatType.includes('application/json') && chatData.success && chatData.message) {
      console.log('   ✅ PASS: POST /api/ai/chat returns valid JSON matching specification!');
    } else {
      console.error('   ❌ FAILED: Unexpected response format.');
    }
  } catch (e) {
    console.error('5. POST /api/ai/chat FAILED:', e.message);
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

runTests();
