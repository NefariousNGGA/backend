const express = require('express');
const pool = require('../db');

const router = express.Router();

// React to a post
router.post('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Identity required' });
  }

  const { post_id, emoji } = req.body;
  if (!post_id || !emoji) {
    return res.status(400).json({ error: 'Post ID and emoji required' });
  }

  // Allow only specific emojis (keep it atmospheric)
  const allowed = ['🕯️', '🌫️', '🕊️', '💀', '👁️', '💭', '🌧️'];
  if (!allowed.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid reaction' });
  }

  try {
    // Upsert: insert or update
    await pool.query(
      `INSERT INTO reactions (post_id, user_id, emoji) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (post_id, user_id) 
       DO UPDATE SET emoji = $3, created_at = NOW()`,
      [post_id, req.user.id, emoji]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reaction failed' });
  }
});

// Get reactions for a post (with counts and user emojis)
router.get('/post/:post_id', async (req, res) => {
  const { post_id } = req.params;
  try {
    // Count per emoji
    const { rows: counts } = await pool.query(`
      SELECT emoji, COUNT(*) as count
      FROM reactions
      WHERE post_id = $1
      GROUP BY emoji
    `, [post_id]);

    // Current user's reaction (if any)
    let myReaction = null;
    if (req.user) {
      const { rows } = await pool.query(
        'SELECT emoji FROM reactions WHERE post_id = $1 AND user_id = $2',
        [post_id, req.user.id]
      );
      if (rows.length > 0) myReaction = rows[0].emoji;
    }

    res.json({ counts, my_reaction: myReaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

module.exports = router;