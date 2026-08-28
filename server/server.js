const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDb, query, queryOne } = require('./db');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const issueRoutes = require('./routes/issues');
const sprintRoutes = require('./routes/sprints');
const aiRoutes = require('./routes/ai');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationsRoutes);

// Global Error Handler for API routes
app.use('/api', (err, req, res, next) => {
  console.error('API Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BugFlow API', timestamp: new Date() });
});

// Serve frontend static files
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  }
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
        ['Admin User', 'admin@bugflow.io', hash, 'admin']
      );

      const adminUser = await queryOne('SELECT id FROM users WHERE email = ?', ['admin@bugflow.io']);
      
      await query(
        'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
        ['Core Platform App', 'Main BugFlow Web Application Service', adminUser ? adminUser.id : 1]
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

  app.listen(PORT, () => {
    console.log(`🚀 BugFlow Full-Stack Platform running at http://localhost:${PORT}`);
  });
}

startServer();
