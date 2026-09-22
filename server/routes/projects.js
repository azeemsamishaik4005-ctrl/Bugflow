const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all projects
router.get('/', authMiddleware, async (req, res) => {
  try {
    const projects = await query(`
      SELECT p.*, u.name as owner_name, 
      (SELECT COUNT(*) FROM issues WHERE project_id = p.id) as issue_count 
      FROM projects p 
      LEFT JOIN users u ON p.owner_id = u.id 
      ORDER BY p.created_at DESC
    `);
    res.json({ projects });
  } catch (err) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// Create new project (Admin or Project Manager)
router.post('/', authMiddleware, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const result = await query(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
      [name, description || '', req.user.id]
    );
    const newProject = await queryOne('SELECT * FROM projects WHERE name = ? ORDER BY id DESC LIMIT 1', [name]);
    res.status(201).json({ message: 'Project created successfully', project: newProject });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Get project by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await queryOne(`
      SELECT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM issues WHERE project_id = p.id) as issue_count
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to fetch project details.' });
  }
});

// Delete project (Admin or Project Manager)
router.delete('/:id', authMiddleware, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

module.exports = router;

