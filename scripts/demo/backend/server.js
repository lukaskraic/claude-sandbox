const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'sandbox',
  user: process.env.POSTGRES_USER || 'sandbox',
  password: process.env.POSTGRES_PASSWORD || 'sandbox',
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

app.get('/api/hello', (_req, res) => {
  res.json({
    message: 'Hello from Claude Sandbox!',
    timestamp: new Date().toISOString(),
    node_version: process.version,
  });
});

app.get('/api/messages', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO messages (text) VALUES ($1) RETURNING *',
      [text.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Demo app running on http://0.0.0.0:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    console.log('Starting server without database...');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Demo app running on http://0.0.0.0:${port} (no database)`);
    });
  });
