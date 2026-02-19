const { buildAuditEmbed } = require('./embeds');
const { getConfig } = require('../database/queries');

/**
 * Posts an audit entry to the guild's configured audit channel.
 *
 * @param {Client} client
 * @param {string} guildId
 * @param {object} opts
 * @param {string} opts.action           - 'add' | 'transfer' | 'repo' | 'notes_update' | 'remove'
 * @param {string} opts.propertyId
 * @param {string} opts.performedById    - Discord user snowflake
 * @param {string} opts.performedByTag   - Discord username
 * @param {object} [opts.oldData]        - property snapshot before action
 * @param {object} [opts.newData]        - property snapshot after action
 */
async function postAuditLog(client, guildId, opts) {
  try {
    const config = await getConfig(guildId);
    if (!config?.audit_channel_id) return;

    const channel = await client.channels.fetch(config.audit_channel_id).catch(() => null);
    if (!channel) return;

    const embed = buildAuditEmbed(opts);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[AuditLog] Failed to post audit entry:', err);
  }
}

module.exports = { postAuditLog };
