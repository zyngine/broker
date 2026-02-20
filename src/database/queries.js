const pool = require('./db');

// ─── Bot Config ───────────────────────────────────────────────────────────────

async function getConfig(guildId) {
  const { rows } = await pool.query(
    'SELECT * FROM bot_config WHERE guild_id = $1',
    [guildId]
  );
  return rows[0] ?? null;
}

async function upsertConfig(guildId, fields) {
  const { dashboard_channel_id, audit_channel_id, admin_role_id, agent_role_id, dashboard_password } = fields;
  const { rows } = await pool.query(
    `INSERT INTO bot_config (guild_id, dashboard_channel_id, audit_channel_id, admin_role_id, agent_role_id, dashboard_password, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (guild_id) DO UPDATE SET
       dashboard_channel_id = EXCLUDED.dashboard_channel_id,
       audit_channel_id     = EXCLUDED.audit_channel_id,
       admin_role_id        = EXCLUDED.admin_role_id,
       agent_role_id        = EXCLUDED.agent_role_id,
       dashboard_password   = COALESCE(EXCLUDED.dashboard_password, bot_config.dashboard_password),
       updated_at           = NOW()
     RETURNING *`,
    [guildId, dashboard_channel_id, audit_channel_id, admin_role_id, agent_role_id, dashboard_password ?? null]
  );
  return rows[0];
}

async function getGuildByDashboardPassword(password) {
  const { rows } = await pool.query(
    `SELECT * FROM bot_config WHERE dashboard_password = $1 LIMIT 1`,
    [password]
  );
  return rows[0] ?? null;
}

async function setDashboardMessageId(guildId, messageId) {
  await pool.query(
    `UPDATE bot_config SET dashboard_message_id = $2, updated_at = NOW() WHERE guild_id = $1`,
    [guildId, messageId]
  );
}

// ─── Properties ───────────────────────────────────────────────────────────────

async function createProperty(guildId, data) {
  const { property_id, owner_name, owner_cid, postal, property_tier, interior_type, price } = data;
  const { rows } = await pool.query(
    `INSERT INTO properties
       (property_id, guild_id, owner_name, owner_cid, postal, property_tier, interior_type, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'owned')
     RETURNING *`,
    [property_id, guildId, owner_name, owner_cid, postal, property_tier, interior_type, price ?? 0]
  );
  return rows[0];
}

async function getProperty(guildId, propertyId) {
  const { rows } = await pool.query(
    'SELECT * FROM properties WHERE guild_id = $1 AND property_id = $2',
    [guildId, propertyId]
  );
  return rows[0] ?? null;
}

async function updateProperty(guildId, propertyId, data) {
  const { owner_name, owner_cid, postal, property_tier, interior_type, price } = data;
  const { rows } = await pool.query(
    `UPDATE properties SET
       owner_name    = $3,
       owner_cid     = $4,
       postal        = $5,
       property_tier = $6,
       interior_type = $7,
       price         = $8,
       status        = 'owned',
       updated_at    = NOW()
     WHERE guild_id = $1 AND property_id = $2
     RETURNING *`,
    [guildId, propertyId, owner_name, owner_cid, postal, property_tier, interior_type, price ?? 0]
  );
  return rows[0] ?? null;
}

async function updateNotes(guildId, propertyId, notes) {
  const { rows } = await pool.query(
    `UPDATE properties SET notes = $3, updated_at = NOW()
     WHERE guild_id = $1 AND property_id = $2
     RETURNING *`,
    [guildId, propertyId, notes]
  );
  return rows[0] ?? null;
}

async function repoProperty(guildId, propertyId) {
  const { rows } = await pool.query(
    `UPDATE properties SET
       owner_name    = NULL,
       owner_cid     = NULL,
       status        = 'repossessed',
       updated_at    = NOW()
     WHERE guild_id = $1 AND property_id = $2
     RETURNING *`,
    [guildId, propertyId]
  );
  return rows[0] ?? null;
}

async function deleteProperty(guildId, propertyId) {
  const { rows } = await pool.query(
    `DELETE FROM properties WHERE guild_id = $1 AND property_id = $2 RETURNING *`,
    [guildId, propertyId]
  );
  return rows[0] ?? null;
}

async function purgeProperty(guildId, propertyId) {
  // Wipe from both tables — no record remains
  const { rows } = await pool.query(
    `DELETE FROM properties WHERE guild_id = $1 AND property_id = $2 RETURNING *`,
    [guildId, propertyId]
  );
  await pool.query(
    `DELETE FROM property_history WHERE guild_id = $1 AND property_id = $2`,
    [guildId, propertyId]
  );
  return rows[0] ?? null;
}

async function getRepossessedProperties(guildId) {
  const { rows } = await pool.query(
    `SELECT * FROM properties WHERE guild_id = $1 AND status = 'repossessed' ORDER BY property_id ASC`,
    [guildId]
  );
  return rows;
}

async function getAllProperties(guildId, { limit, offset }) {
  const { rows } = await pool.query(
    `SELECT * FROM properties WHERE guild_id = $1 ORDER BY property_id ASC LIMIT $2 OFFSET $3`,
    [guildId, limit, offset]
  );
  return rows;
}

async function countProperties(guildId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                        AS total,
       COUNT(*) FILTER (WHERE status = 'owned')       AS owned,
       COUNT(*) FILTER (WHERE status = 'repossessed') AS available
     FROM properties WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0];
}

// ─── History ─────────────────────────────────────────────────────────────────

async function insertHistory(guildId, propertyId, action, performedById, performedByTag, oldData, newData) {
  const { rows } = await pool.query(
    `INSERT INTO property_history
       (guild_id, property_id, action, performed_by_id, performed_by_tag, old_data, new_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [guildId, propertyId, action, performedById, performedByTag,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null]
  );
  return rows[0];
}

async function getPropertyHistory(guildId, propertyId) {
  const { rows } = await pool.query(
    `SELECT * FROM property_history
     WHERE guild_id = $1 AND property_id = $2
     ORDER BY created_at DESC
     LIMIT 25`,
    [guildId, propertyId]
  );
  return rows;
}

// ─── Web Dashboard Queries ────────────────────────────────────────────────────

async function getAllPropertiesForWeb({ search, status, guildId } = {}) {
  let query = 'SELECT * FROM properties WHERE 1=1';
  const params = [];

  if (guildId) {
    params.push(guildId);
    query += ` AND guild_id = $${params.length}`;
  }
  if (status && status !== 'all') {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    const n = params.length;
    query += ` AND (property_id ILIKE $${n} OR owner_name ILIKE $${n} OR owner_cid ILIKE $${n} OR postal ILIKE $${n} OR property_tier ILIKE $${n})`;
  }

  query += ' ORDER BY property_id ASC';
  const { rows } = await pool.query(query, params);
  return rows;
}

async function countAllPropertiesForWeb({ guildId } = {}) {
  const params = [];
  let where = '';
  if (guildId) {
    params.push(guildId);
    where = `WHERE guild_id = $1`;
  }
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                        AS total,
       COUNT(*) FILTER (WHERE status = 'owned')       AS owned,
       COUNT(*) FILTER (WHERE status = 'repossessed') AS available
     FROM properties ${where}`,
    params
  );
  return rows[0];
}

async function getDistinctGuildIds() {
  const { rows } = await pool.query(
    `SELECT DISTINCT guild_id FROM bot_config ORDER BY guild_id ASC`
  );
  return rows.map((r) => r.guild_id);
}

async function getArchiveHistory({ guildId, houseNumber } = {}) {
  const params = [];
  let query = 'SELECT * FROM property_history WHERE 1=1';

  if (guildId) {
    params.push(guildId);
    query += ` AND guild_id = $${params.length}`;
  }
  if (houseNumber) {
    params.push(houseNumber.toUpperCase());
    query += ` AND property_id = $${params.length}`;
  }

  query += ' ORDER BY created_at DESC LIMIT 100';
  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = {
  getConfig, upsertConfig, setDashboardMessageId, getGuildByDashboardPassword,
  createProperty, getProperty, updateProperty, updateNotes, repoProperty, deleteProperty, purgeProperty,
  getRepossessedProperties, getAllProperties, countProperties,
  insertHistory, getPropertyHistory,
  getAllPropertiesForWeb, countAllPropertiesForWeb, getDistinctGuildIds, getArchiveHistory,
};
