const express = require('express');
const { query, queryOne } = require('../db');
const authMiddleware = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Edit a discussion message
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const commentId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    const existing = await queryOne('SELECT * FROM comments WHERE id = ?', [commentId]);
    if (!existing) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to edit this message.' });
    }

    await query(
      'UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, commentId]
    );

    res.json({ message: 'Message updated successfully.' });
  } catch (err) {
    console.error('Update discussion error:', err);
    res.status(500).json({ error: 'Failed to update message.' });
  }
});

// Soft-delete a discussion message
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const commentId = req.params.id;

    const existing = await queryOne('SELECT * FROM comments WHERE id = ?', [commentId]);
    if (!existing) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this message.' });
    }

    await query(
      'UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [commentId]
    );

    res.json({ message: 'Message deleted successfully.' });
  } catch (err) {
    console.error('Delete discussion error:', err);
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

module.exports = router;
