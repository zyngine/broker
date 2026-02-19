const { buildErrorEmbed, buildCancelledEmbed } = require('../utils/embeds');
const { handleModalSubmit } = require('./modalHandler');
const { repoProperty, deleteProperty, insertHistory, getProperty } = require('../database/queries');
const { postAuditLog }  = require('../utils/auditLogger');
const { refreshDashboard } = require('../utils/dashboard');

/**
 * Main interaction router. Handles slash commands, modals, and buttons.
 */
async function handleInteraction(client, interaction) {
  try {
    // ── Slash commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(client, interaction);
      return;
    }

    // ── Modals ───────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(client, interaction);
      return;
    }

    // ── Buttons ──────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButton(client, interaction);
      return;
    }
  } catch (err) {
    console.error('[InteractionHandler] Unhandled error:', err);
    try {
      const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
      await interaction[method]({
        embeds: [buildErrorEmbed('An unexpected error occurred.')],
        ephemeral: true,
      });
    } catch { /* suppress secondary errors */ }
  }
}

async function handleButton(client, interaction) {
  const [action, ...parts] = interaction.customId.split(':');

  // ── Dashboard pagination ─────────────────────────────────────────────────
  if (action === 'dashboard_prev' || action === 'dashboard_next') {
    const currentPage = parseInt(parts[0], 10);
    const guildId     = parts[1];
    const newPage     = action === 'dashboard_prev' ? currentPage - 1 : currentPage + 1;

    await interaction.deferUpdate();
    await refreshDashboard(client, guildId, newPage);
    return;
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  if (action === 'cancel_action') {
    await interaction.update({ embeds: [buildCancelledEmbed()], components: [] });
    return;
  }

  // ── Confirm Repo ─────────────────────────────────────────────────────────
  if (action === 'confirm_repo') {
    const [propertyId, requestingUserId] = parts;
    if (interaction.user.id !== requestingUserId) {
      return interaction.reply({
        embeds: [buildErrorEmbed('This confirmation is not for you.')],
        ephemeral: true,
      });
    }

    const guildId    = interaction.guildId;
    const oldProperty = await getProperty(guildId, propertyId);
    if (!oldProperty) {
      return interaction.update({
        embeds: [buildErrorEmbed(`Property \`${propertyId}\` no longer exists.`)],
        components: [],
      });
    }

    const updated = await repoProperty(guildId, propertyId);

    await insertHistory(
      guildId, propertyId, 'repo',
      interaction.user.id, interaction.user.tag,
      oldProperty, updated
    );

    await postAuditLog(client, guildId, {
      action: 'repo',
      propertyId,
      performedById: interaction.user.id,
      performedByTag: interaction.user.tag,
      oldData: oldProperty,
      newData: updated,
    });

    await refreshDashboard(client, guildId);

    const { buildSuccessEmbed } = require('../utils/embeds');
    await interaction.update({
      embeds: [buildSuccessEmbed('Property Repossessed', `\`${propertyId}\` has been cleared and marked as **Available**.`)],
      components: [],
    });
    return;
  }

  // ── Confirm Remove ───────────────────────────────────────────────────────
  if (action === 'confirm_remove') {
    const [propertyId, requestingUserId] = parts;
    if (interaction.user.id !== requestingUserId) {
      return interaction.reply({
        embeds: [buildErrorEmbed('This confirmation is not for you.')],
        ephemeral: true,
      });
    }

    const guildId     = interaction.guildId;
    const oldProperty = await getProperty(guildId, propertyId);
    if (!oldProperty) {
      return interaction.update({
        embeds: [buildErrorEmbed(`Property \`${propertyId}\` no longer exists.`)],
        components: [],
      });
    }

    await deleteProperty(guildId, propertyId);

    await insertHistory(
      guildId, propertyId, 'remove',
      interaction.user.id, interaction.user.tag,
      oldProperty, null
    );

    await postAuditLog(client, guildId, {
      action: 'remove',
      propertyId,
      performedById: interaction.user.id,
      performedByTag: interaction.user.tag,
      oldData: oldProperty,
      newData: null,
    });

    await refreshDashboard(client, guildId);

    const { buildSuccessEmbed } = require('../utils/embeds');
    await interaction.update({
      embeds: [buildSuccessEmbed('Property Removed', `\`${propertyId}\` has been permanently deleted.`)],
      components: [],
    });
    return;
  }
}

module.exports = { handleInteraction };
