const { SlashCommandBuilder } = require('discord.js');
const { getConfig, getProperty, getPropertyHistory } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildHistoryEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View the full ownership history of a property')
    .addStringOption((o) =>
      o.setName('property_id')
        .setDescription('The Property ID to view history for')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const guildId  = interaction.guildId;
    const config   = await getConfig(guildId);
    const allowed  = await checkPermission(interaction, config, 'agent');
    if (!allowed) return;

    const propertyId = interaction.options.getString('property_id').trim().toUpperCase();

    await interaction.deferReply();

    const property = await getProperty(guildId, propertyId);
    if (!property) {
      return interaction.editReply({
        embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
      });
    }

    const rows = await getPropertyHistory(guildId, propertyId);

    return interaction.editReply({ embeds: [buildHistoryEmbed(propertyId, rows)] });
  },
};
