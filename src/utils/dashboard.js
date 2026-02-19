const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildDashboardEmbed } = require('./embeds');
const { formatPropertyTable } = require('./tableFormatter');
const { getAllProperties, countProperties, getConfig, setDashboardMessageId } = require('../database/queries');
const { dashboard: dashConfig } = require('../../config');

/**
 * Refreshes (edits or creates) the dashboard message in the configured channel.
 * Safe to call after any mutating action — silently no-ops if bot is not configured.
 *
 * @param {Client} client
 * @param {string} guildId
 * @param {number} [page=1] - which page to display
 */
async function refreshDashboard(client, guildId, page = 1) {
  try {
    const config = await getConfig(guildId);
    if (!config?.dashboard_channel_id) return;

    const channel = await client.channels.fetch(config.dashboard_channel_id).catch(() => null);
    if (!channel) return;

    const stats      = await countProperties(guildId);
    const total      = parseInt(stats.total, 10);
    const totalPages = Math.max(1, Math.ceil(total / dashConfig.propertiesPerPage));
    const safePage   = Math.min(Math.max(page, 1), totalPages);
    const offset     = (safePage - 1) * dashConfig.propertiesPerPage;

    const properties = await getAllProperties(guildId, {
      limit: dashConfig.propertiesPerPage,
      offset,
    });

    const tableText = formatPropertyTable(properties);
    const embed     = buildDashboardEmbed(stats, tableText, safePage, totalPages);
    const row       = buildPaginationRow(safePage, totalPages, guildId);
    const payload   = { embeds: [embed], components: row ? [row] : [] };

    // Try to edit existing pinned message
    if (config.dashboard_message_id) {
      try {
        const msg = await channel.messages.fetch(config.dashboard_message_id);
        await msg.edit(payload);
        return;
      } catch {
        // Message was deleted — fall through to post a new one
      }
    }

    const newMsg = await channel.send(payload);
    await setDashboardMessageId(guildId, newMsg.id);
  } catch (err) {
    console.error('[Dashboard] Failed to refresh dashboard:', err);
  }
}

function buildPaginationRow(page, totalPages, guildId) {
  if (totalPages <= 1) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dashboard_prev:${page}:${guildId}`)
      .setLabel('◀  Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`dashboard_next:${page}:${guildId}`)
      .setLabel('Next  ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
}

module.exports = { refreshDashboard };
