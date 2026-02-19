const { SlashCommandBuilder } = require('discord.js');
const { getConfig } = require('../database/queries');
const { buildErrorEmbed, buildSuccessEmbed } = require('../utils/embeds');
const { refreshDashboard } = require('../utils/dashboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('[ADMIN] Force-refresh or repost the property dashboard'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);

    if (!config) {
      return interaction.reply({
        embeds: [buildErrorEmbed('Broker has not been configured yet. Please run `/setup` first.')],
        ephemeral: true,
      });
    }

    const isOwner    = interaction.member.id === interaction.guild.ownerId;
    const isAdmin    = config.admin_role_id && interaction.member.roles.cache.has(config.admin_role_id);
    if (!isOwner && !isAdmin) {
      return interaction.reply({
        embeds: [buildErrorEmbed('You need the Admin role to use this command.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    await refreshDashboard(client, guildId);

    await interaction.editReply({
      embeds: [buildSuccessEmbed('Dashboard Refreshed', `The dashboard in <#${config.dashboard_channel_id}> has been updated.`)],
    });
  },
};
