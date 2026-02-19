const { SlashCommandBuilder } = require('discord.js');
const { getConfig, getAvailableProperties } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildAvailableEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('available')
    .setDescription('List all available (repo\'d) properties ready for new owners'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);
    const allowed = await checkPermission(interaction, config, 'agent');
    if (!allowed) return;

    await interaction.deferReply();

    const properties = await getAvailableProperties(guildId);

    return interaction.editReply({ embeds: [buildAvailableEmbed(properties)] });
  },
};
