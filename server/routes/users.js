const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users
 * Returns list of team members / users for assignments and workload metrics.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await query('SELECT id, name, email, role, created_at FROM users ORDER BY name ASC');
    res.json({ users: users || [] });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch team members.' });
  }
});

/**
 * GET /api/users/:id
 * Returns single user profile.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await queryOne('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user details.' });
  }
});

module.exports = router;
