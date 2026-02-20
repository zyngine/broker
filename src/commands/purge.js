const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { countProperties } = require('../database/queries');
const { buildErrorEmbed, buildPurgeAllConfirmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('[SERVER MANAGER] Nuke the entire property registry — deletes all records and history'),

  async execute(client, interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')],
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const stats   = await countProperties(guildId);
    const count   = Number(stats.total);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_purge_all:${interaction.user.id}`)
        .setLabel('Yes, Wipe Everything')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`cancel_action`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      embeds: [buildPurgeAllConfirmEmbed(count)],
      components: [row],
      ephemeral: true,
    });
  },
};
