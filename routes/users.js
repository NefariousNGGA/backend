const express = require('express');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const pool = require('../db');

const router = express.Router();

// Create identity (first-time user)
router.post('/', async (req, res) => {
  const { display_name, username } = req.body;

  // Basic validation
  if (!display_name || !username) {
    return res.status(400).json({ error: 'Display name and username required' });
  }

  if (!username.startsWith('@') || username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must start with @ and be 3–30 chars' });
  }

  // Check if username is already taken
  const { rows: existing } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  // Generate token and hash it
  const rawToken = nanoid(32); // e.g., "V1u2xKpL9qRnF4s7wTzX8aBcDeFgHiJk"
  const tokenHash = await bcrypt.hash(rawToken, 10);

  // Save user
  const { rows } = await pool.query(
    'INSERT INTO users (display_name, username, token_hash) VALUES ($1, $2, $3) RETURNING id, username, display_name',
    [display_name, username, tokenHash]
  );

  const user = rows[0];

  // Send raw token ONLY once — client must save it!
  res.status(201).json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name
    },
    token: rawToken // ⚠️ Only sent here!
  });
});

// Get current user (for frontend auto-login)
router.get('/me', async (req, res) => {
  const token = req.headers['x-plato-token'];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Find user by token hash
  const { rows } = await pool.query('SELECT id, username, display_name FROM users');
  let foundUser = null;
  for (const user of rows) {
    const isMatch = await bcrypt.compare(token, user.token_hash);
    if (isMatch) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.json({ user: foundUser });
});

module.exports = router;