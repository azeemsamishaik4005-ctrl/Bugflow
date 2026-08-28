const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/notifications
 * Returns up to 50 of the user's latest notifications, newest first.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    // We join with USERS to optionally get actor_name if needed.
    // The query parser inside db.js will handle this.
    const sql = `
      SELECT n.*, a.name as actor_name 
      FROM notifications n 
      LEFT JOIN users a ON n.actor_id = a.id 
      WHERE n.user_id = ? 
      ORDER BY n.created_at DESC 
      LIMIT 50
    `;
    const notifications = await query(sql, [userId]);
    
    const unreadCountRes = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false`, 
      [userId]
    );
    const unreadCount = unreadCountRes.length > 0 ? parseInt(unreadCountRes[0].count, 10) : 0;

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Fast endpoint for polling.
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false`,
      [userId]
    );
    const count = result.length > 0 ? parseInt(result[0].count, 10) : 0;
    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marks a specific notification as read.
 */
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = parseInt(req.params.id, 10);

    // Verify ownership
    const notif = await query(`SELECT * FROM notifications WHERE id = ?`, [notifId]);
    if (notif.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (notif[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this notification' });
    }

    await query(`UPDATE notifications SET is_read = true WHERE id = ?`, [notifId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Marks all of the authenticated user's unread notifications as read.
 */
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(`UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false`, [userId]);
    // The result from our query parser will have { changes: N } or standard pg result
    const updated = result && result.changes !== undefined ? result.changes : (result && result.rowCount ? result.rowCount : 0);
    res.json({ success: true, updated });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Deletes a specific notification.
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = parseInt(req.params.id, 10);

    // Verify ownership
    const notif = await query(`SELECT * FROM notifications WHERE id = ?`, [notifId]);
    if (notif.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (notif[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this notification' });
    }

    await query(`DELETE FROM notifications WHERE id = ?`, [notifId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
