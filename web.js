const express = require('express');
const path = require('path');
const crypto = require('crypto');
const {
  getAllPropertiesForWeb, countAllPropertiesForWeb,
  getDistinctGuildIds, getGuildByDashboardPassword,
} = require('./src/database/queries');

const PORT = process.env.PORT || 3000;
const MASTER_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

// In-memory session store: token -> { expiry, guildId }
// guildId is null for master (sees all guilds), or a guild ID string for guild-scoped sessions
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

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies['broker_session'];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiry) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function isAuthenticated(req) {
  return getSession(req) !== null;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.redirect('/login');
}

function startWebServer(client) {
  if (!MASTER_PASSWORD) {
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

  // Login POST — master password gets full access; guild password gets guild-scoped access
  app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(401).json({ error: 'Invalid password' });

    let guildId = null;

    if (password === MASTER_PASSWORD) {
      // Master access — sees all guilds
      guildId = null;
    } else {
      // Check per-guild passwords
      const guildConfig = await getGuildByDashboardPassword(password);
      if (!guildConfig) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      guildId = guildConfig.guild_id;
    }

    const token = generateToken();
    sessions.set(token, { expiry: Date.now() + 24 * 60 * 60 * 1000, guildId });
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

  // Session info — tells the dashboard whether it is guild-scoped or master
  app.get('/api/session', requireAuth, (req, res) => {
    const session = getSession(req);
    const guildId = session.guildId;
    let guildName = null;
    if (guildId) {
      const g = client && client.guilds.cache.get(guildId);
      guildName = g ? g.name : guildId;
    }
    res.json({ guildId, guildName });
  });

  // Guilds API — master gets all guilds; guild-scoped gets only their guild
  app.get('/api/guilds', requireAuth, async (req, res) => {
    try {
      const session = getSession(req);
      if (session.guildId) {
        const g = client && client.guilds.cache.get(session.guildId);
        return res.json([{ id: session.guildId, name: g ? g.name : session.guildId }]);
      }
      const guildIds = await getDistinctGuildIds();
      const guilds = guildIds.map((id) => {
        const g = client && client.guilds.cache.get(id);
        return { id, name: g ? g.name : id };
      });
      res.json(guilds);
    } catch (err) {
      console.error('[Web] /api/guilds error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Stats API — guild-scoped sessions are locked to their guild regardless of query param
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const session = getSession(req);
      const guildId = session.guildId ?? req.query.guild ?? null;
      const stats = await countAllPropertiesForWeb({ guildId });
      res.json(stats);
    } catch (err) {
      console.error('[Web] /api/stats error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Properties API — guild-scoped sessions are locked to their guild regardless of query param
  app.get('/api/properties', requireAuth, async (req, res) => {
    try {
      const session = getSession(req);
      const { search, status } = req.query;
      const guildId = session.guildId ?? req.query.guild ?? null;
      const properties = await getAllPropertiesForWeb({ search, status, guildId });
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
