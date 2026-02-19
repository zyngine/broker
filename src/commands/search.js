const { SlashCommandBuilder } = require('discord.js');
const { getConfig, getProperty } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildSearchEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Look up a property by its ID')
    .addStringOption((o) =>
      o.setName('property_id')
        .setDescription('The Property ID to search for')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const guildId  = interaction.guildId;
    const config   = await getConfig(guildId);
    // everyone can search
    const allowed  = await checkPermission(interaction, config, 'everyone');
    if (!allowed) return;

    const propertyId = interaction.options.getString('property_id').trim().toUpperCase();
    const property   = await getProperty(guildId, propertyId);

    if (!property) {
      return interaction.reply({
        embeds: [buildErrorEmbed(`No property found with ID \`${propertyId}\`.`)],
        ephemeral: true,
      });
    }

    return interaction.reply({ embeds: [buildSearchEmbed(property)] });
  },
};
