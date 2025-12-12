const express = require('express');
const pool = require('../db');

const router = express.Router();

// Get profile by username (e.g., /api/profiles/@plato)
router.get('/:username', async (req, res) => {
  const { username } = req.params;
  if (!username.startsWith('@')) {
    return res.status(400).json({ error: 'Username must start with @' });
  }

  try {
    // Get user
    const { rows: users } = await pool.query(
      'SELECT id, display_name, username, created_at FROM users WHERE username = $1',
      [username]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    // Get last seen (from latest comment or reaction)
    const { rows: activity } = await pool.query(`
      SELECT created_at FROM (
        SELECT created_at FROM comments WHERE user_id = $1
        UNION ALL
        SELECT created_at FROM reactions WHERE user_id = $1
        UNION ALL
        SELECT created_at FROM submissions WHERE user_id = $1
      ) AS all_actions
      ORDER BY created_at DESC
      LIMIT 1
    `, [user.id]);

    const lastSeen = activity.length > 0 ? activity[0].created_at : user.created_at;

    // Get recent comments
    const { rows: comments } = await pool.query(`
      SELECT c.content, c.created_at, p.id AS post_id, p.title AS post_title
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT 5
    `, [user.id]);

    res.json({
      user: {
        ...user,
        last_seen: lastSeen
      },
      recent_comments: comments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

module.exports = router;