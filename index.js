const express = require('express');
const cors = require('cors');
const path = require('path');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const reactionRoutes = require('./routes/reactions');
const notificationRoutes = require('./routes/notifications');
const profileRoutes = require('./routes/profiles');

const app = express();

// Allow frontend (on same domain) to access API
app.use(cors({
  origin: true, // Reflects request origin
  credentials: true
}));

app.use(express.json());
app.use(authMiddleware);

// API routes
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profiles', profileRoutes);

// Optional: RSS feed
app.get('/feed.xml', async (req, res) => {
  const pool = require('./db');
  try {
    const { rows: posts } = await pool.query(`
      SELECT 
        p.title, p.content, p.created_at,
        u.username AS author
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `);

    const items = posts.map(p => `
      <item>
        <title><![CDATA[${p.title || 'Untitled'}]]></title>
        <link>${process.env.FRONTEND_URL}/post/${p.id}</link>
        <description><![CDATA[${p.content.substring(0, 300)}...]]></description>
        <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
        <author>${p.author}</author>
      </item>
    `).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Plato’s Lair</title>
  <link>${process.env.FRONTEND_URL || 'https://your-frontend.onrender.com'}</link>
  <description>Reflections from the gloom</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${items}
</channel>
</rss>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('RSS feed error');
  }
});

// Serve static frontend in monolith mode (not used in our setup, but safe)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Plato’s Lair] Server running on port ${PORT}`);
});