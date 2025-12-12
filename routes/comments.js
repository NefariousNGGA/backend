const express = require('express');
const pool = require('../db');

const router = express.Router();

// Helper: extract @username mentions from text
function extractMentions(text) {
  const regex = /@([a-zA-Z0-9_]+)/g;
  const matches = [...text.matchAll(regex)];
  return matches.map(m => `@${m[1]}`).filter(u => u.length <= 30);
}

// Post a comment
router.post('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Identity required' });
  }

  const { post_id, content } = req.body;
  if (!post_id || !content?.trim()) {
    return res.status(400).json({ error: 'Post ID and content required' });
  }

  try {
    // Insert comment
    const { rows } = await pool.query(
      `INSERT INTO comments (post_id, user_id, content) 
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [post_id, req.user.id, content]
    );

    const commentId = rows[0].id;

    // Extract mentions and notify mentioned users
    const mentions = extractMentions(content);
    if (mentions.length > 0) {
      const { rows: mentionedUsers } = await pool.query(
        'SELECT id FROM users WHERE username = ANY($1)',
        [mentions]
      );

      for (const u of mentionedUsers) {
        // Avoid notifying self
        if (u.id === req.user.id) continue;
        await pool.query(
          `INSERT INTO notifications (user_id, type, source_user_id, post_id, comment_id)
           VALUES ($1, 'mention', $2, $3, $4)`,
          [u.id, req.user.id, post_id, commentId]
        );
      }
    }

    res.status(201).json({ success: true, comment_id: commentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// Get comments for a post
router.get('/post/:post_id', async (req, res) => {
  const { post_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.id, c.content, c.created_at,
        u.username, u.display_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [post_id]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;