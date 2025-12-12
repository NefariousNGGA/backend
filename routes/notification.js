const express = require('express');
const pool = require('../db');

const router = express.Router();

// Get unread notifications for current user
router.get('/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { rows } = await pool.query(`
      SELECT 
        n.id, n.type, n.created_at, n.is_read,
        su.username AS source_username,
        su.display_name AS source_display_name,
        p.id AS post_id,
        p.title AS post_title
      FROM notifications n
      JOIN users su ON n.source_user_id = su.id
      LEFT JOIN posts p ON n.post_id = p.id
      WHERE n.user_id = $1 AND n.created_at > NOW() - INTERVAL '30 days'
      ORDER BY n.created_at DESC
      LIMIT 10
    `, [req.user.id]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.post('/:id/read', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;