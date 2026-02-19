const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getConfig, getProperty } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildRepoConfirmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('repo')
    .setDescription('[ADMIN] Repossess a property — clears all owner info and marks it as available')
    .addStringOption((o) =>
      o.setName('property_id')
        .setDescription('The Property ID to repossess')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const guildId    = interaction.guildId;
    const config     = await getConfig(guildId);
    const allowed    = await checkPermission(interaction, config, 'admin');
    if (!allowed) return;

    const propertyId = interaction.options.getString('property_id').trim().toUpperCase();
    const property   = await getProperty(guildId, propertyId);

    if (!property) {
      return interaction.reply({
        embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
        ephemeral: true,
      });
    }

    if (property.status === 'available') {
      return interaction.reply({
        embeds: [buildErrorEmbed(`Property \`${propertyId}\` is already available.`)],
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_repo:${propertyId}:${interaction.user.id}`)
        .setLabel('Yes, Repossess')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`cancel_action:${propertyId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      embeds: [buildRepoConfirmEmbed(property)],
      components: [row],
      ephemeral: true,
    });
  },
};
