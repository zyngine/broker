/**
 * Formats an array of property rows into a fixed-width ASCII table
 * wrapped in a Discord code block.
 */

const COL = {
  id:      10,
  address: 20,
  type:    10,
  price:   8,
  owner:   14,
  cid:     10,
  status:  6,
};

function pad(str, len) {
  const s = String(str ?? '');
  if (s.length > len) return s.slice(0, len - 1) + '…';
  return s.padEnd(len);
}

function formatPrice(n) {
  const num = Number(n);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

function buildRow(values) {
  return (
    pad(values[0], COL.id)      + ' │ ' +
    pad(values[1], COL.address) + ' │ ' +
    pad(values[2], COL.type)    + ' │ ' +
    pad(values[3], COL.price)   + ' │ ' +
    pad(values[4], COL.owner)   + ' │ ' +
    pad(values[5], COL.cid)     + ' │ ' +
    pad(values[6], COL.status)
  );
}

const SEPARATOR = '─'.repeat(
  Object.values(COL).reduce((a, b) => a + b, 0) +
  (Object.keys(COL).length - 1) * 3
);

const HEADER = buildRow(['ID', 'Address', 'Type', 'Price', 'Owner', 'CID', 'Status']);

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
      p.address,
      p.address_type,
      formatPrice(p.price),
      p.owner_name  ?? '—',
      p.owner_cid   ?? '—',
      p.status === 'available' ? 'AVAIL' : 'OWNED',
    ])
  );

  return '```\n' + HEADER + '\n' + SEPARATOR + '\n' + rows.join('\n') + '\n```';
}

module.exports = { formatPropertyTable };
