const { SlashCommandBuilder } = require('discord.js');
const { getConfig, countProperties } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildStatsEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View server-wide real estate market statistics'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);
    const allowed = await checkPermission(interaction, config, 'agent');
    if (!allowed) return;

    await interaction.deferReply();

    const stats = await countProperties(guildId);

    return interaction.editReply({ embeds: [buildStatsEmbed(stats)] });
  },
};
