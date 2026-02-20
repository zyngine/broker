const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, getProperty } = require('../database/queries');
const { buildErrorEmbed, buildPurgeConfirmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('[SERVER MANAGER] Permanently erase a house number and all its history')
    .addStringOption((o) =>
      o.setName('house_number')
        .setDescription('House number / property ID to fully erase')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    // Requires Discord's "Manage Server" permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')],
        ephemeral: true,
      });
    }

    const guildId    = interaction.guildId;
    const propertyId = interaction.options.getString('house_number').trim().toUpperCase();
    const property   = await getProperty(guildId, propertyId);

    if (!property) {
      // Check if there's history even if property row is gone
      return interaction.reply({
        embeds: [buildErrorEmbed(`No property found with house number \`${propertyId}\`.`)],
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_purge:${propertyId}:${interaction.user.id}`)
        .setLabel('Yes, Erase Everything')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`cancel_action:${propertyId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      embeds: [buildPurgeConfirmEmbed(property)],
      components: [row],
      ephemeral: true,
    });
  },
};
