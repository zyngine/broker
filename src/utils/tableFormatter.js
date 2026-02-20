/**
 * Formats an array of property rows into a fixed-width ASCII table
 * wrapped in a Discord code block.
 */

const COL = {
  house:    10,
  postal:   8,
  tier:     14,
  interior: 14,
  owner:    14,
  cid:      10,
  status:   12,
};

function pad(str, len) {
  const s = String(str ?? '');
  if (s.length > len) return s.slice(0, len - 1) + '…';
  return s.padEnd(len);
}

function buildRow(values) {
  return (
    pad(values[0], COL.house)    + ' │ ' +
    pad(values[1], COL.postal)   + ' │ ' +
    pad(values[2], COL.tier)     + ' │ ' +
    pad(values[3], COL.interior) + ' │ ' +
    pad(values[4], COL.owner)    + ' │ ' +
    pad(values[5], COL.cid)      + ' │ ' +
    pad(values[6], COL.status)
  );
}

const SEPARATOR = '─'.repeat(
  Object.values(COL).reduce((a, b) => a + b, 0) +
  (Object.keys(COL).length - 1) * 3
);

const HEADER = buildRow(['House #', 'Postal', 'Tier', 'Interior', 'Owner', 'CID', 'Status']);

/**
 * @param {Array} properties - rows from DB
 * @returns {string} code block string
 */
function formatPropertyTable(properties) {
  if (!properties.length) {
    return '```\n  No properties found.\n```';
  }

  const rows = properties.map((p) =>
    buildRow([
      p.property_id,
      p.postal         ?? '—',
      p.property_tier  ?? '—',
      p.interior_type  ?? '—',
      p.owner_name     ?? '—',
      p.owner_cid      ?? '—',
      p.status === 'repossessed' ? 'REPOSSESSED' : 'OWNED',
    ])
  );

  return '```\n' + HEADER + '\n' + SEPARATOR + '\n' + rows.join('\n') + '\n```';
}

module.exports = { formatPropertyTable };
