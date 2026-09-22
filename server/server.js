const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDb, query, queryOne } = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const issueRoutes = require('./routes/issues');
const sprintRoutes = require('./routes/sprints');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const notificationsRoutes = require('./routes/notifications');
const discussionsRoutes = require('./routes/discussions');
const swaggerDocs = require('./docs/swagger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger / OpenAPI Documentation
app.use('/api-docs', swaggerDocs.router);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/discussions', discussionsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DefectX API', timestamp: new Date() });
});

// Catch-all 404 for unhandled API endpoints - NEVER return HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler for API routes - ALWAYS return JSON
app.use('/api', (err, req, res, next) => {
  console.error('API Error:', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: err.message || 'Internal Server Error'
  });
});

// Serve frontend static files
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Seed initial demo data
async function seedInitialData() {
  try {
    const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
    if (!userCount || parseInt(userCount.count, 10) === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      
      await query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['Admin User', 'admin@defectx.io', hash, 'admin']
      );

      const adminUser = await queryOne('SELECT id FROM users WHERE email = ?', ['admin@defectx.io']);
      
      await query(
        'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
        ['Core Platform App', 'Main DefectX Web Application Service', adminUser ? adminUser.id : 1]
      );

      const mainProj = await queryOne('SELECT id FROM projects LIMIT 1');
      const ownerId = adminUser ? adminUser.id : 1;
      const projId = mainProj ? mainProj.id : 1;

      await query(
        `INSERT INTO issues (project_id, sprint_id, title, description, type, priority, severity, status, reporter_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projId,
          null,
          'Authentication Token Expiration Loop on Refresh',
          'Users experience session logout on page refresh due to JWT payload timestamp mismatch.',
          'Bug',
          'P1',
          'Critical',
          'In Progress',
          ownerId
        ]
      );

      await query(
        `INSERT INTO issues (project_id, sprint_id, title, description, type, priority, severity, status, reporter_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projId,
          null,
          'Dashboard KPI Card Glassmorphism Alignment',
          'Card margins overlap on 1080p monitors under dark mode theme settings.',
          'Bug',
          'P3',
          'Low',
          'Resolved',
          ownerId
        ]
      );

      await query(
        `INSERT INTO issues (project_id, sprint_id, title, description, type, priority, severity, status, reporter_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projId,
          null,
          'Add AI-Powered Automated Bug Classification',
          'Integrate Claude API to detect missing steps to reproduce and format bug reports.',
          'Feature',
          'P2',
          'High',
          'Open',
          ownerId
        ]
      );

      console.log('🌱 Initial demo seed data created successfully.');
    }
  } catch (err) {
    console.error('Error seeding demo data:', err);
  }
}

// Start Server
async function startServer() {
  await initDb();
  await seedInitialData();

  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`🚀 DefectX Full-Stack Platform running at http://localhost:${PORT}`);
    });
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

