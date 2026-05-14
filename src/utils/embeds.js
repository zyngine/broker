const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../config');

const FOOTER = { text: 'Broker  •  FiveM Real Estate' };

function base(color) {
  return new EmbedBuilder().setColor(color).setFooter(FOOTER).setTimestamp();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(val) {
  const n = Number(val);
  if (!n) return 'N/A';
  return '$' + n.toLocaleString('en-US');
}

function toEST(dateVal) {
  return new Date(dateVal).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' EST';
}

// ─── General ─────────────────────────────────────────────────────────────────

function buildSuccessEmbed(title, description) {
  return base(colors.success).setTitle(`✅  ${title}`).setDescription(description);
}

function buildErrorEmbed(description) {
  return base(colors.danger).setTitle('Error').setDescription(description);
}

function buildPermissionDeniedEmbed() {
  return base(colors.danger)
    .setTitle('Access Denied')
    .setDescription('You do not have the required role to use this command.');
}

// ─── Property ────────────────────────────────────────────────────────────────

function buildPropertyEmbed(property, titlePrefix = 'Property') {
  const statusBadge   = property.status === 'repossessed' ? '🔴 Repossessed' : '🟢 Owned';
  const insuredBadge  = property.has_stash_insurance ? '🛡️ Yes' : '— No';
  return base(colors.primary)
    .setTitle(`🏠  ${titlePrefix}  —  ${property.property_id}`)
    .addFields(
      { name: 'Status',        value: statusBadge,                          inline: true },
      { name: 'Property Tier', value: property.property_tier ?? 'N/A',     inline: true },
      { name: 'Property Type', value: property.interior_type ?? 'N/A',     inline: true },
      { name: 'Postal',        value: property.postal        ?? 'N/A',     inline: true },
      { name: 'Price',         value: formatPrice(property.price),         inline: true },
      { name: 'Sold By',       value: property.sold_by       ?? 'N/A',     inline: true },
      { name: 'Owner',         value: property.owner_name    ?? 'N/A',     inline: true },
      { name: 'CID',           value: property.owner_cid     ?? 'N/A',     inline: true },
      { name: 'Stash Insurance', value: insuredBadge,                       inline: true },
    );
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

function buildRepoConfirmEmbed(property) {
  return base(colors.danger)
    .setTitle(`⚠️  Confirm Repossession  —  ${property.property_id}`)
    .setDescription(
      `This will clear all owner information and mark the property as **Repossessed**.\n\n` +
      `**Current Owner:** ${property.owner_name ?? 'N/A'}\n` +
      `**CID:** ${property.owner_cid ?? 'N/A'}\n\n` +
      `Are you sure?`
    );
}

function buildRemoveConfirmEmbed(property) {
  return base(colors.danger)
    .setTitle(`⚠️  Confirm Permanent Removal  —  ${property.property_id}`)
    .setDescription(
      `This will **permanently delete** this property record from the system.\n\n` +
      `**House Number:** ${property.property_id}\n` +
      `**Owner:** ${property.owner_name ?? 'N/A'}\n\n` +
      `This action **cannot be undone**. Are you sure?`
    );
}

function buildPurgeAllConfirmEmbed(count) {
  return base(colors.danger)
    .setTitle('☠️  Confirm Full Registry Wipe')
    .setDescription(
      `This will **permanently erase every property and all ownership history** for this server.\n\n` +
      `**${count} propert${count === 1 ? 'y' : 'ies'}** will be deleted. The archive will also be wiped.\n\n` +
      `**This cannot be undone.** Are you absolutely sure?`
    );
}

function buildPurgeConfirmEmbed(property) {
  return base(colors.danger)
    .setTitle(`☠️  Confirm Full Purge  —  ${property.property_id}`)
    .setDescription(
      `This will **permanently erase all records** of this house number, including the full ownership history.\n\n` +
      `**House Number:** ${property.property_id}\n` +
      `**Current Owner:** ${property.owner_name ?? 'N/A'}\n` +
      `**CID:** ${property.owner_cid ?? 'N/A'}\n\n` +
      `The archive will also be wiped. **This cannot be undone.** Are you sure?`
    );
}

function buildCancelledEmbed() {
  return base(colors.muted).setTitle('Cancelled').setDescription('Action was cancelled.');
}

// ─── Search ──────────────────────────────────────────────────────────────────

function buildSearchEmbed(property) {
  const statusBadge  = property.status === 'repossessed' ? '🔴 Repossessed' : '🟢 Owned';
  const insuredBadge = property.has_stash_insurance ? '🛡️ Yes' : '— No';
  return base(colors.primary)
    .setTitle(`🔍  Property  —  ${property.property_id}`)
    .addFields(
      { name: 'Status',        value: statusBadge,                      inline: true },
      { name: 'Property Tier', value: property.property_tier ?? 'N/A', inline: true },
      { name: 'Property Type', value: property.interior_type ?? 'N/A', inline: true },
      { name: 'Postal',        value: property.postal        ?? 'N/A', inline: true },
      { name: 'Price',         value: formatPrice(property.price),     inline: true },
      { name: 'Sold By',       value: property.sold_by       ?? 'N/A', inline: true },
      { name: 'Owner',         value: property.owner_name    ?? 'N/A', inline: true },
      { name: 'CID',           value: property.owner_cid     ?? 'N/A', inline: true },
      { name: 'Stash Insurance', value: insuredBadge,                   inline: true },
    );
}

// ─── Available ───────────────────────────────────────────────────────────────

function buildAvailableEmbed(properties) {
  if (!properties.length) {
    return base(colors.accent)
      .setTitle('🔴  Repossessed Properties')
      .setDescription('There are no repossessed properties at this time.');
  }

  const lines = properties.map((p) =>
    `\`${p.property_id}\`  •  ${p.property_tier ?? 'N/A'}  •  Postal: ${p.postal ?? 'N/A'}`
  );

  return base(colors.accent)
    .setTitle(`🔴  Repossessed Properties  (${properties.length})`)
    .setDescription(lines.join('\n'));
}

// ─── History ─────────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  add:          '🟢 Added',
  transfer:     '🔄 Transferred',
  repo:         '🔴 Repossessed',
  notes_update: '📝 Notes Updated',
  remove:       '⛔ Removed',
  house_change: '🔀 Property Changed',
  purge_all:    '💀 Full Registry Wipe',
};

function buildHistoryEmbed(propertyId, rows) {
  if (!rows.length) {
    return base(colors.primary)
      .setTitle(`📋  History  —  ${propertyId}`)
      .setDescription('No history found for this property.');
  }

  const lines = rows.slice(0, 10).map((r) => {
    const label  = ACTION_LABELS[r.action] ?? r.action.toUpperCase();
    const ts     = toEST(r.created_at);
    const by     = r.performed_by_tag;

    let detail = '';
    if (r.action === 'transfer' && r.old_data && r.new_data) {
      const oldOwner = r.old_data.owner_name ?? 'N/A';
      const newOwner = r.new_data.owner_name ?? 'N/A';
      detail = `\n  ↳ ${oldOwner} → ${newOwner}`;
    }
    if (r.action === 'house_change' && r.old_data && r.new_data) {
      const oldId = r.old_data.property_id ?? 'N/A';
      const newId = r.new_data.property_id ?? 'N/A';
      detail = `\n  ↳ House # ${oldId} → ${newId}`;
    }
    if (r.action === 'notes_update' && r.new_data) {
      const note = r.new_data.notes ?? 'cleared';
      detail = `\n  ↳ ${note.slice(0, 80)}${note.length > 80 ? '…' : ''}`;
    }

    return `${label}  by **${by}**\n  ↳ ${ts}${detail}`;
  });

  const footer = rows.length > 10 ? `\n*Showing 10 of ${rows.length} entries*` : '';

  return base(colors.primary)
    .setTitle(`📋  History  —  ${propertyId}`)
    .setDescription(lines.join('\n\n') + footer);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function buildStatsEmbed(stats) {
  const total       = Number(stats.total);
  const owned       = Number(stats.owned);
  const repossessed = Number(stats.available);

  const ownedPct = total > 0 ? ((owned / total) * 100).toFixed(0) : 0;

  return base(colors.accent)
    .setTitle('📊  Real Estate Market Statistics')
    .addFields(
      { name: 'Total Properties', value: String(total),              inline: true },
      { name: 'Owned',            value: `${owned} (${ownedPct}%)`, inline: true },
      { name: 'Repossessed',      value: String(repossessed),        inline: true },
    );
}

// ─── Setup ───────────────────────────────────────────────────────────────────

function buildSetupEmbed(config, dashChannel, auditChannel, adminRole, agentRole) {
  return base(colors.success)
    .setTitle('⚙️  Broker Configured')
    .setDescription('The bot has been set up successfully.')
    .addFields(
      { name: 'Dashboard Channel', value: `<#${config.dashboard_channel_id}>`, inline: true  },
      { name: 'Audit Log Channel', value: `<#${config.audit_channel_id}>`,     inline: true  },
      { name: 'Admin Role',        value: `<@&${config.admin_role_id}>`,        inline: true  },
      { name: 'Agent Role',        value: `<@&${config.agent_role_id}>`,        inline: true  },
    );
}

// ─── Audit ───────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  owner_name:          'Owner',
  owner_cid:           'CID',
  postal:              'Postal',
  property_tier:       'Property Tier',
  interior_type:       'Property Type',
  price:               'Price',
  sold_by:             'Sold By',
  has_stash_insurance: 'Stash Insurance',
};

function buildAuditEmbed(opts) {
  const { action, propertyId, performedByTag, performedById, oldData, newData } = opts;
  const label = ACTION_LABELS[action] ?? action.toUpperCase();

  const embed = base(colors.muted)
    .setTitle(`${label}  —  ${propertyId}`)
    .addFields(
      { name: 'Performed By', value: `${performedByTag} (<@${performedById}>)`, inline: true },
      { name: 'Property ID',  value: propertyId,                                 inline: true },
      { name: 'When',         value: toEST(new Date()),                          inline: true },
    );

  if (action === 'add' && newData) {
    embed.addFields(
      { name: 'Property Tier',   value: newData.property_tier ?? 'N/A',                        inline: true },
      { name: 'Property Type',   value: newData.interior_type ?? 'N/A',                        inline: true },
      { name: 'Postal',          value: newData.postal        ?? 'N/A',                        inline: true },
      { name: 'Price',           value: formatPrice(newData.price),                            inline: true },
      { name: 'Sold By',         value: newData.sold_by       ?? 'N/A',                        inline: true },
      { name: 'Owner',           value: newData.owner_name    ?? 'N/A',                        inline: true },
      { name: 'CID',             value: newData.owner_cid     ?? 'N/A',                        inline: true },
      { name: 'Stash Insurance', value: newData.has_stash_insurance ? '🛡️ Yes' : '— No',     inline: true },
    );
  } else if (action === 'transfer' && oldData && newData) {
    const fields = ['owner_name', 'owner_cid', 'postal', 'property_tier', 'interior_type', 'price', 'sold_by', 'has_stash_insurance'];
    const fmt = (f, v) => {
      if (f === 'price')               return formatPrice(v);
      if (f === 'has_stash_insurance') return v ? '🛡️ Yes' : '— No';
      return v ?? 'N/A';
    };
    const diffs = fields.filter((f) => String(oldData[f]) !== String(newData[f]));
    if (diffs.length) {
      const diffLines = diffs.map((f) => {
        const label = FIELD_LABELS[f] ?? f;
        return `**${label}:** ${fmt(f, oldData[f])} → ${fmt(f, newData[f])}`;
      }).join('\n');
      embed.addFields({ name: 'Changes', value: diffLines, inline: false });
    }
  } else if (action === 'repo' && oldData) {
    embed.addFields(
      { name: 'Former Owner', value: oldData.owner_name ?? 'N/A', inline: true },
      { name: 'Former CID',   value: oldData.owner_cid  ?? 'N/A', inline: true },
    );
  } else if (action === 'notes_update') {
    embed.addFields(
      { name: 'New Notes', value: (newData?.notes ?? 'cleared').slice(0, 1024), inline: false },
    );
  } else if (action === 'remove' && oldData) {
    embed.addFields(
      { name: 'House #', value: oldData.property_id ?? 'N/A', inline: true },
      { name: 'Owner',   value: oldData.owner_name  ?? 'N/A', inline: true },
      { name: 'CID',     value: oldData.owner_cid   ?? 'N/A', inline: true },
    );
  } else if (action === 'house_change' && oldData && newData) {
    embed.addFields(
      { name: 'Old House #',   value: oldData.property_id   ?? 'N/A', inline: true },
      { name: 'New House #',   value: newData.property_id   ?? 'N/A', inline: true },
      { name: 'Property Type', value: newData.interior_type ?? 'N/A', inline: true },
      { name: 'Sold By',       value: newData.sold_by       ?? 'N/A', inline: true },
      { name: 'Owner',         value: newData.owner_name    ?? 'N/A', inline: true },
      { name: 'CID',           value: newData.owner_cid     ?? 'N/A', inline: true },
    );
  } else if (action === 'purge_all') {
    embed.addFields(
      { name: 'Scope', value: 'All properties and full archive for this server', inline: false },
    );
  }

  return embed;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function buildDashboardEmbed(stats, tableText, page, totalPages) {
  const total       = Number(stats.total);
  const owned       = Number(stats.owned);
  const repossessed = Number(stats.available);

  const statsLine =
    `\`Total: ${total}\`  •  \`Owned: ${owned}\`  •  \`Repossessed: ${repossessed}\``;

  return new EmbedBuilder()
    .setColor(colors.accent)
    .setTitle('🏢  BROKER  —  PROPERTY REGISTRY')
    .setDescription(statsLine + '\n' + tableText)
    .setFooter({ text: `Broker  •  FiveM Real Estate  •  Page ${page} of ${totalPages}` })
    .setTimestamp();
}

module.exports = {
  buildSuccessEmbed, buildErrorEmbed, buildPermissionDeniedEmbed,
  buildPropertyEmbed, buildSearchEmbed,
  buildRepoConfirmEmbed, buildRemoveConfirmEmbed, buildPurgeConfirmEmbed, buildPurgeAllConfirmEmbed, buildCancelledEmbed,
  buildAvailableEmbed, buildHistoryEmbed, buildStatsEmbed,
  buildSetupEmbed, buildAuditEmbed, buildDashboardEmbed,
};
