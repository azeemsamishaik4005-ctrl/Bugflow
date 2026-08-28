const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Get all sprints for a project
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.query;
    
    let sql = 'SELECT * FROM sprints';
    const params = [];
    
    if (project_id) {
      sql += ' WHERE project_id = ?';
      params.push(project_id);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const sprints = await query(sql, params);
    res.json({ sprints });
  } catch (err) {
    console.error('Fetch sprints error:', err);
    res.status(500).json({ error: 'Failed to fetch sprints.' });
  }
});

// Create a sprint
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { project_id, name, start_date, end_date } = req.body;
    
    if (!project_id || !name) {
      return res.status(400).json({ error: 'Project ID and name are required.' });
    }
    
    await query(
      'INSERT INTO sprints (project_id, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)',
      [project_id, name, start_date || null, end_date || null, 'Active']
    );
    
    // Trigger Notification
    const newSprint = await queryOne('SELECT * FROM sprints WHERE project_id = ? AND name = ? ORDER BY id DESC LIMIT 1', [project_id, name]);
    if (newSprint) {
      await notificationService.notifySprintEvent(newSprint, 'STARTED', req.user.id);
    }

    res.status(201).json({ message: 'Sprint created successfully' });
  } catch (err) {
    console.error('Create sprint error:', err);
    res.status(500).json({ error: 'Failed to create sprint.' });
  }
});

// Update sprint
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, start_date, end_date, status } = req.body;
    const sprintId = req.params.id;

    const existing = await queryOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!existing) {
      return res.status(404).json({ error: 'Sprint not found.' });
    }

    const updatedName = name !== undefined ? name : existing.name;
    const updatedStartDate = start_date !== undefined ? start_date : existing.start_date;
    const updatedEndDate = end_date !== undefined ? end_date : existing.end_date;
    const updatedStatus = status !== undefined ? status : existing.status;

    await query(
      'UPDATE sprints SET name = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?',
      [updatedName, updatedStartDate || null, updatedEndDate || null, updatedStatus, sprintId]
    );

    // Trigger Notification
    if (status && status !== existing.status) {
      const updatedSprint = await queryOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
      if (status === 'Completed') {
        await notificationService.notifySprintEvent(updatedSprint, 'COMPLETED', req.user.id);
      } else {
        await notificationService.notifySprintEvent(updatedSprint, 'UPDATED', req.user.id);
      }
    }

    res.json({ message: 'Sprint updated successfully' });
  } catch (err) {
    console.error('Update sprint error:', err);
    res.status(500).json({ error: 'Failed to update sprint.' });
  }
});

// Delete sprint
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const sprintId = req.params.id;
    const existing = await queryOne('SELECT * FROM sprints WHERE id = ?', [sprintId]);
    if (!existing) {
      return res.status(404).json({ error: 'Sprint not found.' });
    }

    await query('DELETE FROM sprints WHERE id = ?', [sprintId]);
    res.json({ message: 'Sprint deleted successfully.' });
  } catch (err) {
    console.error('Delete sprint error:', err);
    res.status(500).json({ error: 'Failed to delete sprint.' });
  }
});

module.exports = router;
