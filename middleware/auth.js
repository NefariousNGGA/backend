const bcrypt = require('bcrypt');
const pool = require('../db');

async function authMiddleware(req, res, next) {
  const token = req.headers['x-plato-token'];
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Hash the raw token to look up (but we can't index token_hash easily)
    // Alternative: store token_hash in a separate indexed column? Not needed yet.
    // For now, we'll do a full scan (fine for <10k users)
    const { rows } = await pool.query('SELECT id, username, display_name, token_hash FROM users');
    
    let user = null;
    for (const row of rows) {
      const isMatch = await bcrypt.compare(token, row.token_hash);
      if (isMatch) {
        user = {
          id: row.id,
          username: row.username,
          display_name: row.display_name
        };
        break;
      }
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Auth check failed' });
  }
}

module.exports = authMiddleware;