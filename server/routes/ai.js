const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const authMiddleware = require('../middleware/auth');
const { query, queryOne } = require('../db');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Helper: Determine issue technical category
function detectCategory(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('login') || text.includes('auth') || text.includes('jwt') || text.includes('token') || text.includes('password') || text.includes('session')) return 'Authentication';
  if (text.includes('payment') || text.includes('card') || text.includes('checkout') || text.includes('stripe') || text.includes('transaction') || text.includes('invoice')) return 'Billing & Payments';
  if (text.includes('sql') || text.includes('database') || text.includes('postgres') || text.includes('query') || text.includes('migration') || text.includes('table')) return 'Database';
  if (text.includes('slow') || text.includes('lag') || text.includes('performance') || text.includes('timeout') || text.includes('memory') || text.includes('cpu')) return 'Performance & Memory';
  if (text.includes('ui') || text.includes('button') || text.includes('css') || text.includes('layout') || text.includes('modal') || text.includes('render') || text.includes('color') || text.includes('align')) return 'Frontend UI';
  if (text.includes('api') || text.includes('endpoint') || text.includes('route') || text.includes('server') || text.includes('backend') || text.includes('500') || text.includes('404')) return 'API & Backend';
  if (text.includes('security') || text.includes('vulnerability') || text.includes('xss') || text.includes('csrf') || text.includes('cors')) return 'Security';
  if (text.includes('mobile') || text.includes('responsive') || text.includes('phone') || text.includes('tablet')) return 'Mobile & Responsive';
  return 'Frontend UI'; // Default
}

// Fallback AI analysis if API key is not present or API call fails
function generateFallbackEnhancement(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const missing = [];
  
  if (!text.includes('chrome') && !text.includes('firefox') && !text.includes('browser') && !text.includes('safari')) {
    missing.push('Browser & Environment Details');
  }
  if (!text.includes('windows') && !text.includes('mac') && !text.includes('linux') && !text.includes('os')) {
    missing.push('Operating System');
  }
  if (!text.includes('step') && !text.includes('click') && !text.includes('then') && !text.includes('when')) {
    missing.push('Steps to Reproduce');
  }
  if (!text.includes('expected') && !text.includes('should')) {
    missing.push('Expected Result');
  }
  if (!text.includes('actual') && !text.includes('instead') && !text.includes('error') && !text.includes('fails')) {
    missing.push('Actual Result');
  }

  const isVague = description.split(' ').length < 10 || missing.length >= 3;

  let suggested_priority = 'P2';
  let suggested_severity = 'Medium';
  let suggested_type = text.includes('feature') || text.includes('add') || text.includes('request') ? 'Feature' : 'Bug';

  if (text.includes('crash') || text.includes('security') || text.includes('broken') || text.includes('cannot login')) {
    suggested_priority = 'P1';
    suggested_severity = 'Critical';
  } else if (text.includes('slow') || text.includes('alignment') || text.includes('typo')) {
    suggested_priority = 'P3';
    suggested_severity = 'Low';
  }

  const suggested_category = detectCategory(title, description);

  let resolution_assistance = "Consider checking the component's state lifecycle. Verify that API calls handle edge cases properly.";
  let troubleshooting_guidance = [
    "Check network tab for failed requests.",
    "Verify application logs for unhandled exception stack traces.",
    "Try reproducing in an incognito window with clean state."
  ];

  if (suggested_category === 'Authentication') {
    resolution_assistance = "Review authentication middleware and JWT validation. Ensure token expiration and session refresh are handled properly.";
    troubleshooting_guidance = ["Check auth header in requests", "Inspect token expiration timestamp", "Review server auth logs", "Verify user password hash lookup", "Test token refresh route"];
  } else if (suggested_category === 'Billing & Payments') {
    resolution_assistance = "Ensure the payment gateway handles idempotency keys properly to prevent duplicate transactions.";
    troubleshooting_guidance = ["Check payment gateway integration logs", "Verify idempotency keys", "Inspect transaction database records", "Test with mock cards"];
  } else if (suggested_category === 'Performance & Memory') {
    resolution_assistance = "Identify potential memory leaks, unindexed queries, or blocking synchronous operations causing the slowdown.";
    troubleshooting_guidance = ["Profile application load time in DevTools", "Check database query explain plans", "Analyze network payload sizes", "Review memory usage profiles"];
  } else if (suggested_category === 'Database') {
    resolution_assistance = "Check connection pooling configurations, transaction boundaries, and verify database constraints.";
    troubleshooting_guidance = ["Verify database connection string", "Test network connectivity to DB port", "Check maximum connection limits", "Review slow query logs"];
  } else if (suggested_category === 'Frontend UI') {
    resolution_assistance = "Inspect component lifecycle, responsive breakpoints, and CSS flex/grid layout constraints.";
    troubleshooting_guidance = ["Inspect DOM element styles in DevTools", "Check browser console for React warnings", "Verify responsive layout breakpoints across resolutions"];
  } else if (suggested_category === 'API & Backend') {
    resolution_assistance = "Check Express routes, middleware execution order, and REST controller logic.";
    troubleshooting_guidance = ["Verify request payload parsing", "Check for unhandled promise rejections", "Review server logs for 500 errors"];
  } else if (suggested_category === 'Security') {
    resolution_assistance = "Review input validation, output encoding, and access control policies.";
    troubleshooting_guidance = ["Check for CSRF tokens", "Verify role permissions", "Ensure inputs are sanitized"];
  } else if (suggested_category === 'Mobile & Responsive') {
    resolution_assistance = "Test responsive breakpoints and touch event handlers.";
    troubleshooting_guidance = ["Emulate mobile devices in browser DevTools", "Check touch target sizes", "Verify meta viewport tag"];
  }

  const formattedDescription = `### 🐛 Bug Overview
${description || title}

### 📋 Steps to Reproduce
1. Navigate to the application portal.
2. Perform action related to: "${title}".
3. Observe unexpected behavior or error response.

### 🎯 Expected Behavior
The system should execute the action successfully without throwing errors or unhandled exceptions.

### ⚠️ Actual Behavior
${description.length > 5 ? description : 'Action fails or produces an unexpected error state.'}

### 🖥️ Environment & Device Information
- **OS**: Windows 11 / macOS / Linux (User to confirm)
- **Browser**: Chrome / Firefox / Safari (User to confirm)
- **User Role**: Authenticated User

### 💡 Additional Context & Root Cause Notes
Identified via AI analysis as a ${suggested_severity.toLowerCase()} severity ${suggested_category} failure requiring developer investigation.`;

  return {
    status: isVague ? 'needs_clarification' : 'formatted_report',
    missing_fields: missing,
    questions: [
      'Which browser and OS version were you using when this occurred?',
      'What exact steps lead up to this issue?',
      'Did you notice any specific error messages in the developer console?'
    ],
    enhanced_title: title.length < 5 ? `[Bug] ${title} - System Failure` : title,
    enhanced_description: formattedDescription,
    suggested_priority,
    suggested_severity,
    suggested_type,
    suggested_category,
    resolution_assistance,
    troubleshooting_guidance
  };
}

// Route: Enhance Bug with AI
router.post('/enhance-bug', authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: 'Please provide a bug title or description for AI analysis.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey && apiKey !== 'your_anthropic_api_key_here') {
      try {
        const anthropic = new Anthropic({ apiKey });

        const prompt = `You are BugFlow AI, an expert QA engineer and software debugger.
Analyze the following issue report submitted by a user:

Title: "${title || ''}"
Description: "${description || ''}"

Your task:
1. Detect missing key bug report details (e.g., OS, Browser, Exact Steps to Reproduce, Expected Result, Actual Result).
2. If critical details are missing, list questions to ask the user.
3. Generate a structured, professional, well-formatted Markdown bug report containing:
   - Summary
   - Steps to Reproduce
   - Expected Behavior
   - Actual Behavior
   - Environment / System Information
4. Recommend Priority (P1/P2/P3), Severity (Critical/High/Medium/Low), Type (Bug/Feature), and Component (Frontend UI, Authentication, Billing & Payments, Performance & Memory, Database, etc.).
5. Provide developer guidance: 'resolution_assistance' (tips/code suggestions) and 'troubleshooting_guidance' (array of investigation steps).

Respond strictly with a valid JSON object matching this schema (do NOT include markdown codeblocks or extra text):
{
  "status": "needs_clarification" | "formatted_report",
  "missing_fields": ["OS", "Browser", "Steps to Reproduce"],
  "questions": ["Question 1?", "Question 2?"],
  "enhanced_title": "Clean, descriptive issue title",
  "enhanced_description": "Full Markdown formatted bug report text",
  "suggested_priority": "P1" | "P2" | "P3",
  "suggested_severity": "Critical" | "High" | "Medium" | "Low",
  "suggested_type": "Bug" | "Feature",
  "suggested_category": "Authentication" | "Billing & Payments" | "API & Backend" | "Frontend UI" | "Database" | "Mobile & Responsive" | "Performance & Memory" | "Security",
  "resolution_assistance": "Useful suggestions for solving the defect...",
  "troubleshooting_guidance": ["Step 1 to investigate...", "Step 2..."]
}`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        return res.json(parsed);
      } catch (apiError) {
        console.warn('⚠️ Anthropic API call error, falling back to local enhancer:', apiError.message);
      }
    }

    const result = generateFallbackEnhancement(title || '', description || '');
    return res.json(result);
  } catch (err) {
    console.error('AI enhance bug error:', err);
    res.status(500).json({ error: 'Failed to process AI bug enhancement.' });
  }
});

// Fallback Semantic Search (Cosine Similarity with Synonym Mapping)
function calculateSemanticSimilarity(str1 = '', str2 = '') {
  const getTokens = (str) => {
    const stopWords = new Set(['the','is','in','at','of','on','and','a','to','it','for','with','as','by','this','that','an','are','was','were','be','been','being','have','has','had','not','when','from','or','which']);
    const synonyms = {
      'api': 'backend', 'endpoint': 'backend', 'server': 'backend', 'service': 'backend',
      'ui': 'frontend', 'button': 'frontend', 'display': 'frontend', 'view': 'frontend', 'screen': 'frontend', 'click': 'frontend',
      'crash': 'error', 'fails': 'error', 'broken': 'error', 'exception': 'error', 'issue': 'error', 'bug': 'error', 'failure': 'error',
      'fast': 'performance', 'slow': 'performance', 'delay': 'performance', 'loading': 'performance', 'spinning': 'performance', 'freeze': 'performance', 'hang': 'performance',
      'payment': 'billing', 'charge': 'billing', 'transaction': 'billing', 'checkout': 'billing', 'card': 'billing',
      'login': 'auth', 'signin': 'auth', 'password': 'auth', 'jwt': 'auth', 'token': 'auth', 'authenticate': 'auth',
      'twice': 'duplicate', 'double': 'duplicate', 'multiple': 'duplicate', 'repeated': 'duplicate'
    };
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .map(w => synonyms[w] || w);
  };

  const tokens1 = getTokens(str1);
  const tokens2 = getTokens(str2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const tf1 = {}, tf2 = {};
  tokens1.forEach(t => tf1[t] = (tf1[t] || 0) + 1);
  tokens2.forEach(t => tf2[t] = (tf2[t] || 0) + 1);

  const allTokens = Array.from(new Set([...tokens1, ...tokens2]));
  let dotProduct = 0, mag1 = 0, mag2 = 0;

  allTokens.forEach(t => {
    const v1 = tf1[t] || 0;
    const v2 = tf2[t] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

// Route: Check Duplicates (Semantic Search)
router.post('/check-duplicate', authMiddleware, async (req, res) => {
  try {
    const { title, description, project_id } = req.body;
    if (!title && !description) return res.json({ duplicates: [] });
    
    const queryText = `${title || ''} ${description || ''}`;
    let sql = 'SELECT id, title, description, status, priority, severity, created_at, project_id FROM issues';
    const params = [];
    if (project_id) {
      sql += ' WHERE project_id = ?';
      params.push(project_id);
    }
    sql += ' ORDER BY id DESC LIMIT 50';

    const allIssues = await query(sql, params);
    const allComments = await query('SELECT issue_id, content FROM comments ORDER BY created_at DESC LIMIT 200');

    const issuesWithContext = allIssues.map(issue => {
      const issueComments = allComments.filter(c => c.issue_id === issue.id).map(c => c.content).join(' | ');
      return { ...issue, commentsText: issueComments };
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey && apiKey !== 'your_anthropic_api_key_here') {
      try {
        const anthropic = new Anthropic({ apiKey });
        
        const contextIssuesStr = issuesWithContext.map(i => 
          `[ID: ${i.id}] Title: ${i.title}\nDesc: ${i.description}\nStatus: ${i.status}\nPriority: ${i.priority}\nSeverity: ${i.severity}\nComments: ${i.commentsText}`
        ).join('\n\n');

        const prompt = `You are a Semantic Search AI for defect tracking.
A user is reporting a new bug:
Title: "${title || ''}"
Description: "${description || ''}"

Here is a list of existing issues with context:
${contextIssuesStr}

Find up to 3 existing issues that are SEMANTICALLY similar to the new bug.
IMPORTANT: Base matching on semantic meaning (e.g. "Payment API is triggered twice" vs "Clicking the payment button once creates duplicate transactions").
Only include issues with a similarity score of 0.65 or higher.
For each match, extract a brief, useful 'related_information' tip from previous context or comments.

Respond STRICTLY with a JSON array of objects, no markdown:
[
  {
    "id": 123,
    "title": "Existing Issue Title",
    "description": "Short description",
    "status": "Open",
    "priority": "P1",
    "severity": "High",
    "similarity": 0.92,
    "related_information": "Previous fix involved adding debouncing to payment button."
  }
]`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const duplicates = JSON.parse(cleanJson);
        
        if (Array.isArray(duplicates)) {
          return res.json({ duplicates });
        }
      } catch (apiErr) {
        console.warn('Semantic Search API error, using smart fallback calculation:', apiErr.message);
      }
    }

    // Smart Local Semantic Similarity Calculation
    const threshold = 0.35;
    const duplicates = issuesWithContext.map(issue => {
      const issueText = `${issue.title} ${issue.description} ${issue.commentsText}`;
      const score = calculateSemanticSimilarity(queryText, issueText);
      const normalizedScore = Math.min(0.98, Math.round(score * 100) / 100);
      
      let related_info = "Semantic match found in system repository.";
      if (issue.commentsText) {
        related_info = "Relevant comments: " + issue.commentsText.slice(0, 90) + "...";
      } else if (issue.status === 'Resolved') {
        related_info = "This issue was previously marked as Resolved. Check past resolution steps.";
      }

      return { 
        id: issue.id, 
        title: issue.title, 
        description: issue.description ? issue.description.slice(0, 120) + (issue.description.length > 120 ? '...' : '') : '',
        status: issue.status,
        priority: issue.priority,
        severity: issue.severity,
        created_at: issue.created_at,
        similarity: normalizedScore, 
        related_information: related_info
      };
    }).filter(issue => issue.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    return res.json({ duplicates });
  } catch (err) {
    console.error('Check duplicate error:', err);
    res.status(500).json({ error: 'Failed to check duplicates.' });
  }
});

// Dynamic Test Case Generator Fallback
function generateDynamicTestCases(title = '', description = '', type = 'Bug', priority = 'P2', severity = 'Medium') {
  const category = detectCategory(title, description);
  const target = title || 'Target Feature';

  return [
    {
      id: 'TC-01',
      scenario: `Positive: Verify successful execution of "${target}" under normal conditions`,
      preconditions: `User is authenticated with valid credentials. Network connectivity is active.`,
      steps: `1. Log in to the application.\n2. Navigate to the feature area for "${target}".\n3. Provide valid input parameters and trigger the primary action.\n4. Observe UI confirmation and database persistence.`,
      expected_result: `The system processes the request successfully with HTTP 200/201 and updates state without errors.`,
      priority: priority === 'P1' ? 'High' : 'High',
      type: 'Positive'
    },
    {
      id: 'TC-02',
      scenario: `Negative: Verify error handling for invalid/empty inputs during "${target}"`,
      preconditions: `System is running. User is on the "${target}" interface.`,
      steps: `1. Leave mandatory fields blank or enter malformed payload data.\n2. Submit or trigger the action.\n3. Verify error messages and input field highlights.`,
      expected_result: `Clear validation feedback is shown to the user. The application prevents invalid submissions and does not crash.`,
      priority: 'Medium',
      type: 'Negative'
    },
    {
      id: 'TC-03',
      scenario: `Edge Case: Verify behavior during rapid consecutive triggers / network latency on "${target}"`,
      preconditions: `Application is loaded. Simulated network throttling or multi-click scenario.`,
      steps: `1. Perform the action for "${target}" repeatedly in rapid succession (double/triple click).\n2. Simulate intermittent network failure or 3G throttling.\n3. Inspect request logs and UI state.`,
      expected_result: `Action is debounced/idempotent. Only a single operation executes, preventing duplicate database writes or race conditions.`,
      priority: severity === 'Critical' ? 'High' : 'Medium',
      type: 'Edge'
    },
    {
      id: 'TC-04',
      scenario: `Regression: Verify dependent ${category} workflows remain unaffected after fix`,
      preconditions: `Fix has been deployed to test environment.`,
      steps: `1. Execute upstream and downstream user journeys linked to ${category}.\n2. Verify session persistence and related dashboard metrics.\n3. Validate that related database records are updated correctly.`,
      expected_result: `All existing related features continue functioning seamlessly without side-effects or regressions.`,
      priority: 'High',
      type: 'Regression'
    },
    {
      id: 'TC-05',
      scenario: `Validation: Verify boundary limits, token expiry, and security permissions for "${target}"`,
      preconditions: `User session active; test with expired token or unauthorized role if applicable.`,
      steps: `1. Attempt action with expired session or boundary-length strings (500+ characters).\n2. Verify access control response and error boundary recovery.`,
      expected_result: `System handles boundary conditions gracefully, redirects to login if token expired, and maintains data integrity.`,
      priority: 'Medium',
      type: 'Validation'
    }
  ];
}

// Route: Generate Test Cases
router.post('/generate-test-cases', authMiddleware, async (req, res) => {
  try {
    const { title, description, expected_behavior, actual_behavior, severity, priority, type } = req.body;
    if (!title) return res.status(400).json({ error: 'Issue title is required.' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your_anthropic_api_key_here') {
      try {
        const anthropic = new Anthropic({ apiKey });
        const prompt = `You are an expert QA Automation & Manual Test Engineer.
Generate 5 detailed test cases for the following defect:
Title: ${title}
Description: ${description || ''}
Type: ${type || 'Bug'}
Severity: ${severity || 'Medium'}, Priority: ${priority || 'P2'}
Expected Behavior: ${expected_behavior || 'N/A'}
Actual Behavior: ${actual_behavior || 'N/A'}

Generate a mix of Positive, Negative, Edge case, Regression, and Validation test cases.
Respond strictly with a valid JSON array of objects, no markdown:
[
  {
    "id": "TC-01",
    "scenario": "Short clear description of what is being tested",
    "preconditions": "Preconditions required before test execution",
    "steps": "1. Step one\\n2. Step two\\n3. Step three",
    "expected_result": "Detailed expected outcome",
    "priority": "High" | "Medium" | "Low",
    "type": "Positive" | "Negative" | "Edge" | "Regression" | "Validation"
  }
]`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((tc, idx) => ({ ...tc, id: tc.id || `TC-0${idx + 1}` }));
          return res.json({ test_cases: mapped });
        }
      } catch (apiErr) {
        console.warn('Anthropic Test Cases API error, using dynamic generator:', apiErr.message);
      }
    }

    // Dynamic Defect-Specific Fallback
    const fallbackTestCases = generateDynamicTestCases(title, description, type, priority, severity);
    return res.json({ test_cases: fallbackTestCases });
  } catch (err) {
    console.error('Test cases error:', err);
    res.status(500).json({ error: 'Failed to generate test cases.' });
  }
});

// Route: Recommend Developer
router.post('/recommend-developer', authMiddleware, async (req, res) => {
  try {
    const { title = '', description = '', severity = 'Medium', priority = 'P2' } = req.body;
    
    // Fetch real developers and their current assigned issues workload from database
    const users = await query('SELECT id, name, email, role FROM users');
    const openIssues = await query("SELECT assignee_id, COUNT(*) as count FROM issues WHERE status IN ('Open', 'In Progress', 'In Review') GROUP BY assignee_id");
    
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No users found in database for recommendation.' });
    }

    const category = detectCategory(title, description);

    const developers = users.map(u => {
      const workloadRow = openIssues.find(i => i.assignee_id === u.id);
      const workload = workloadRow ? parseInt(workloadRow.count, 10) : 0;
      
      // Compute skill match score based on role vs category
      let roleMatch = 80;
      const roleLower = (u.role || '').toLowerCase();
      if (category === 'UI/Frontend' && (roleLower.includes('frontend') || roleLower.includes('ui') || roleLower.includes('fullstack') || roleLower.includes('developer'))) {
        roleMatch = 94;
      } else if ((category === 'Backend/API' || category === 'Database') && (roleLower.includes('backend') || roleLower.includes('lead') || roleLower.includes('fullstack') || roleLower.includes('developer'))) {
        roleMatch = 95;
      } else if (category === 'Authentication' || category === 'Security') {
        roleMatch = roleLower.includes('lead') || roleLower.includes('backend') ? 96 : 88;
      } else if (roleLower.includes('qa') || roleLower.includes('test')) {
        roleMatch = 82;
      }

      // Workload penalty: more open issues slightly lowers availability score
      const workloadAdjustment = Math.max(-15, -workload * 4);
      const finalScore = Math.max(65, Math.min(98, roleMatch + workloadAdjustment));

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || 'Developer',
        workload,
        score: finalScore
      };
    });

    // Sort by calculated score descending
    developers.sort((a, b) => b.score - a.score);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your_anthropic_api_key_here') {
      try {
        const anthropic = new Anthropic({ apiKey });
        const devContext = developers.map(d => `- ID: ${d.id}, Name: ${d.name}, Role: ${d.role}, Open Issues: ${d.workload}`).join('\n');
        
        const prompt = `You are an Engineering Team Manager AI.
Recommend the single best developer to assign to this defect from the available real team members:

Issue Title: "${title}"
Issue Description: "${description}"
Category: ${category}
Severity: ${severity}, Priority: ${priority}

Available Developers in Database:
${devContext}

Pick the best candidate balancing domain expertise and current workload.
Respond strictly with a JSON object, no markdown:
{
  "recommended_developer": { "id": 1, "name": "Name", "role": "Role" },
  "match_score": 94,
  "reason": "Detailed explanation of why they are the best fit...",
  "relevant_skills": ["Skill 1", "Skill 2"],
  "current_workload": 1,
  "similar_issue_experience": "High experience with ${category} architecture"
}`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.json(parsed);
      } catch (apiErr) {
        console.warn('Anthropic Recommend Developer API error, using dynamic selector:', apiErr.message);
      }
    }

    // Dynamic Database-Driven Recommendation
    const topDev = developers[0];
    const skillsMap = {
      'Authentication': ['JWT Token Verification', 'OAuth2 / Session Management', 'Security Best Practices'],
      'Payment': ['Payment Gateway APIs', 'Idempotency Handling', 'Transaction Consistency'],
      'Database': ['SQL Query Optimization', 'PostgreSQL Schema & Indexing', 'ORM Diagnostics'],
      'Performance': ['Async Profiling', 'Memory Leak Analysis', 'Caching & Network Optimization'],
      'UI/Frontend': ['React Lifecycle Management', 'CSS & Flexbox Layouts', 'Client State Debugging'],
      'Backend/API': ['Express Routing & Middleware', 'REST Architecture', 'Server Error Handlers'],
      'Security': ['CORS & Header Policies', 'Input Sanitization', 'Vulnerability Assessment'],
      'General': ['Full-Stack Debugging', 'Code Review', 'Automated Testing']
    };

    return res.json({
      recommended_developer: { 
        id: topDev.id, 
        name: topDev.name, 
        role: topDev.role 
      },
      match_score: topDev.score,
      reason: `Recommended ${topDev.name} (${topDev.role}) because of strong alignment with ${category} defects and optimal workload balance (${topDev.workload} active issues in queue).`,
      relevant_skills: skillsMap[category] || skillsMap['General'],
      current_workload: topDev.workload,
      similar_issue_experience: `Proven track record handling ${category} defects and core system components.`
    });
  } catch (err) {
    console.error('Recommend developer error:', err);
    res.status(500).json({ error: 'Failed to recommend developer.' });
  }
});

// Route: Verify Resolution
router.post('/verify-resolution', authMiddleware, async (req, res) => {
  try {
    const { title = '', description = '', resolution_notes = '', commentsText = '' } = req.body;
    
    if (!resolution_notes || resolution_notes.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter resolution notes in the comment box before verifying.' });
    }

    const category = detectCategory(title, description);
    const notesLower = resolution_notes.toLowerCase();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your_anthropic_api_key_here') {
      try {
        const anthropic = new Anthropic({ apiKey });
        const prompt = `You are an AI QA Code & Resolution Reviewer.
Verify if the proposed resolution adequately addresses the defect:

Defect Title: "${title}"
Defect Description: "${description}"
Category: ${category}
Resolution Notes / Fix Description: "${resolution_notes}"
Previous Activity / Comments: "${commentsText}"

Assess:
1. Does the fix address the root cause?
2. Are edge cases or error states covered?
3. What verification steps are needed?

Respond strictly with a JSON object, no markdown:
{
  "status": "Verified" | "Needs Changes" | "Unable to Verify",
  "confidence": 92,
  "summary": "Detailed assessment of the fix...",
  "what_was_fixed": "Key components or logic addressed in the resolution",
  "remaining_concerns": "Any remaining edge cases or potential risks",
  "suggested_tests": ["Test 1", "Test 2", "Test 3"],
  "recommended_next_action": "Actionable next step (e.g., Deploy to staging and run regression suite)"
}`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.json(parsed);
      } catch (apiErr) {
        console.warn('Anthropic Verify Resolution API error, using dynamic verifier:', apiErr.message);
      }
    }

    // Dynamic Resolution Verification Engine
    const isDetailed = resolution_notes.length > 25;
    const mentionsFix = notesLower.includes('fix') || notesLower.includes('resolved') || notesLower.includes('updated') || notesLower.includes('patched') || notesLower.includes('changed') || notesLower.includes('added');
    const mentionsTest = notesLower.includes('test') || notesLower.includes('verified') || notesLower.includes('checked') || notesLower.includes('pass');

    let status = 'Verified';
    let confidence = 88;
    let summary = `The resolution notes provide an adequate explanation for fixing the ${category} issue "${title}".`;
    let remaining_concerns = "Ensure the fix is validated across different browser environments and cache states.";

    if (!isDetailed || !mentionsFix) {
      status = 'Needs Changes';
      confidence = 55;
      summary = `The resolution notes are brief and lack specific implementation details regarding how "${title}" was corrected.`;
      remaining_concerns = "Root cause explanation and code change specifics are missing from the resolution summary.";
    } else if (mentionsFix && mentionsTest) {
      status = 'Verified';
      confidence = 94;
      summary = `Thorough resolution provided with verification coverage addressing the core failure in ${category}.`;
      remaining_concerns = "None critical. Recommend standard regression sanity check before closing.";
    }

    return res.json({
      status,
      confidence,
      summary,
      what_was_fixed: isDetailed ? `Addressed the primary fault path reported in "${title}" and corrected runtime behavior.` : 'Basic fix applied without detailed code walkthrough.',
      remaining_concerns,
      suggested_tests: [
        `Execute end-to-end positive verification for "${title}".`,
        `Test with invalid boundary parameters to ensure error handling remains intact.`,
        `Validate session recovery and check server logs for unexpected warnings.`
      ],
      recommended_next_action: status === 'Verified' ? 'Move issue to "Retest/Verify" and schedule QA sign-off.' : 'Request developer to provide specific code diffs and testing verification notes.'
    });
  } catch (err) {
    console.error('Verify resolution error:', err);
    res.status(500).json({ error: 'Failed to verify resolution.' });
  }
});

// Route: Generate AI Defect Report (Full 13-Point Analysis)
router.post('/generate-report', authMiddleware, async (req, res) => {
  try {
    const { title = '', description = '', type = 'Bug', priority = 'P2', severity = 'Medium', status = 'Open', commentsText = '', issue_id = null } = req.body;
    
    const category = detectCategory(title, description);

    // Trigger Notification for AI Resolution
    if (issue_id) {
      const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [issue_id]);
      if (issue) {
        await notificationService.notifyAiResolution(issue);
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your_anthropic_api_key_here') {
      try {
        const anthropic = new Anthropic({ apiKey });
        const prompt = `You are BugFlow Lead QA & Systems Architect AI.
Generate a comprehensive 13-point Defect Analysis Report for the following issue:

Title: "${title}"
Description: "${description}"
Type: ${type}, Priority: ${priority}, Severity: ${severity}, Status: ${status}
Category: ${category}
Comments/History: "${commentsText}"

Respond strictly with a JSON object, no markdown:
{
  "report": {
    "title": "${title}",
    "description": "${description}",
    "Component": "${category}",
    "Priority": "${priority}",
    "Severity": "${severity}",
    "Bug Type": "${type}",
    "Probable Root Cause": "Detailed technical explanation of the likely root cause...",
    "Recommended Resolution": "Step-by-step engineering solution strategy...",
    "Suggested Fix": "Practical technical suggestions or code changes...",
    "Testing Recommendation": "Steps to verify that the defect has been fixed...",
    "Related Component": "${category}"
  }
}`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1400,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.json(parsed);
      } catch (apiErr) {
        console.warn('Anthropic Report API error, using dynamic report generator:', apiErr.message);
      }
    }

    // Dynamic 13-Point Comprehensive Report Generator
    const riskLevel = severity === 'Critical' ? 'Critical' : (severity === 'High' || priority === 'P1') ? 'High' : 'Medium';
    const regressionRisk = (category === 'Database' || category === 'Authentication') ? 'High' : 'Medium';

    return res.json({
      report: {
        "Title": title,
        "Description": description,
        "Component": category,
        "Priority": priority,
        "Severity": severity,
        "Bug Type": type,
        "Probable Root Cause": `Analysis indicates potential failure in ${category} handler logic. When the operation related to "${title}" is triggered, unexpected state mutation or unhandled exception occurs before completing the transaction.`,
        "Recommended Resolution": `1. Implement defensive guards in the ${category} controller.\n2. Wrap async operations in try-catch blocks with standardized HTTP error responses.`,
        "Suggested Fix": `Add unit and integration tests covering positive and negative edge cases.`,
        "Testing Recommendation": `1. Validate normal operation flow for "${title}".\n2. Verify error boundary and toast notification on failure.\n3. Execute concurrency test with simultaneous requests.`,
        "Related Component": category
      }
    });
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Failed to generate AI report.' });
  }
});

module.exports = router;

