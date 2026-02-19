const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initDatabase() {
  const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schemaSQL);
  console.log('[DB] Schema initialized.');
}

module.exports = { initDatabase };
