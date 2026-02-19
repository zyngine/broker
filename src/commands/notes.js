const { SlashCommandBuilder } = require('discord.js');
const { getConfig, getProperty, updateNotes, insertHistory } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildSuccessEmbed } = require('../utils/embeds');
const { postAuditLog } = require('../utils/auditLogger');
const { refreshDashboard } = require('../utils/dashboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('Add or update notes for a property')
    .addStringOption((o) =>
      o.setName('property_id')
        .setDescription('The Property ID to update notes for')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('notes')
        .setDescription('The notes to set (leave blank to clear notes)')
        .setRequired(false)
        .setMaxLength(1000)
    ),

  async execute(client, interaction) {
    const guildId    = interaction.guildId;
    const config     = await getConfig(guildId);
    const allowed    = await checkPermission(interaction, config, 'agent');
    if (!allowed) return;

    const propertyId = interaction.options.getString('property_id').trim().toUpperCase();
    const notes      = interaction.options.getString('notes')?.trim() ?? null;

    const property = await getProperty(guildId, propertyId);
    if (!property) {
      return interaction.reply({
        embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: false });

    const oldNotes = property.notes;
    const updated  = await updateNotes(guildId, propertyId, notes);

    await insertHistory(
      guildId, propertyId, 'notes_update',
      interaction.user.id, interaction.user.tag,
      property, updated
    );

    await postAuditLog(client, guildId, {
      action: 'notes_update',
      propertyId,
      performedById: interaction.user.id,
      performedByTag: interaction.user.tag,
      oldData: property,
      newData: updated,
    });

    await refreshDashboard(client, guildId);

    const desc = notes
      ? `Notes for \`${propertyId}\` updated.\n\n**New Notes:** ${notes}`
      : `Notes for \`${propertyId}\` have been cleared.`;

    await interaction.editReply({ embeds: [buildSuccessEmbed('Notes Updated', desc)] });
  },
};
