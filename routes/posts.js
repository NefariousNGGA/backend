const express = require('express');
const pool = require('../db');

const router = express.Router();

// Get all published posts
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        p.id, p.title, p.content, p.created_at,
        u.username AS author_username,
        u.display_name AS author_display_name,
        p.mood_tags
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT 
        p.id, p.title, p.content, p.created_at, p.mood_tags,
        u.username AS author_username,
        u.display_name AS author_display_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Submit a thought
router.post('/submit', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Identity required to submit' });
  }

  const { title, content, mood_tags } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    await pool.query(`
      INSERT INTO submissions (user_id, title, content, mood_tags, status)
      VALUES ($1, $2, $3, $4, 'pending')
    `, [req.user.id, title || null, content, mood_tags || []]);

    res.status(201).json({ success: true, message: 'Thought submitted for review' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// Admin: get pending submissions
router.get('/admin/submissions', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Admin access denied' });
  }

  try {
    const { rows } = await pool.query(`
      SELECT 
        s.id, s.title, s.content, s.mood_tags, s.created_at,
        u.username, u.display_name
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'pending'
      ORDER BY s.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Admin: publish submission
router.post('/admin/submissions/:id/publish', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Admin access denied' });
  }

  const { id } = req.params;
  try {
    const { rows: subs } = await pool.query(
      'SELECT user_id, title, content, mood_tags FROM submissions WHERE id = $1 AND status = $2',
      [id, 'pending']
    );
    if (subs.length === 0) {
      return res.status(404).json({ error: 'Submission not found or already processed' });
    }

    const sub = subs[0];

    await pool.query(
      'INSERT INTO posts (author_id, title, content, mood_tags) VALUES ($1, $2, $3, $4)',
      [sub.user_id, sub.title, sub.content, sub.mood_tags]
    );

    await pool.query('UPDATE submissions SET status = $1 WHERE id = $2', ['published', id]);

    res.json({ success: true, message: 'Submission published' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Publish failed' });
  }
});

module.exports = router;