const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { getAllPropertiesForWeb, countAllPropertiesForWeb } = require('./src/database/queries');

const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
console.log(`[Web] module loaded. PORT=${PORT} PW_SET=${!!DASHBOARD_PASSWORD}`);

// In-memory session store: token -> expiry timestamp
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const [key, ...val] = cookie.split('=');
      list[key.trim()] = decodeURIComponent(val.join('=').trim());
    });
  }
  return list;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies['broker_session'];
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry || Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.redirect('/login');
}

function startWebServer() {
  console.log(`[Web] startWebServer() called. PORT=${process.env.PORT} PW_SET=${!!process.env.DASHBOARD_PASSWORD}`);
  if (!DASHBOARD_PASSWORD) {
    console.warn('[Web] DASHBOARD_PASSWORD is not set — web dashboard is disabled.');
    return;
  }

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Root — redirect based on auth state
  app.get('/', (req, res) => {
    if (isAuthenticated(req)) return res.redirect('/dashboard');
    res.redirect('/login');
  });

  // Login page
  app.get('/login', (req, res) => {
    if (isAuthenticated(req)) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  // Login POST
  app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (!password || password !== DASHBOARD_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const token = generateToken();
    sessions.set(token, Date.now() + 24 * 60 * 60 * 1000); // 24hr
    res.setHeader(
      'Set-Cookie',
      `broker_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
    );
    res.json({ ok: true });
  });

  // Logout
  app.get('/api/logout', (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies['broker_session'];
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'broker_session=; Path=/; Max-Age=0');
    res.redirect('/login');
  });

  // Dashboard page (auth required)
  app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });

  // Stats API
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const stats = await countAllPropertiesForWeb();
      res.json(stats);
    } catch (err) {
      console.error('[Web] /api/stats error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Properties API
  app.get('/api/properties', requireAuth, async (req, res) => {
    try {
      const { search, status } = req.query;
      const properties = await getAllPropertiesForWeb({ search, status });
      res.json(properties);
    } catch (err) {
      console.error('[Web] /api/properties error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`[Broker] Web dashboard running on port ${PORT}`);
  });
  server.on('error', (err) => {
    console.error('[Web] listen error:', err);
  });
}

module.exports = { startWebServer };
