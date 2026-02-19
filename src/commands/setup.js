const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { getConfig, upsertConfig } = require('../database/queries');
const { buildErrorEmbed, buildSetupEmbed } = require('../utils/embeds');
const { refreshDashboard } = require('../utils/dashboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('[ADMIN] Configure the Broker bot for this server')
    .addChannelOption((o) =>
      o.setName('dashboard_channel')
        .setDescription('Channel where the live property dashboard will be displayed')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((o) =>
      o.setName('audit_channel')
        .setDescription('Channel where all actions will be logged')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((o) =>
      o.setName('admin_role')
        .setDescription('Role with full access to all commands (repo, remove, setup)')
        .setRequired(true)
    )
    .addRoleOption((o) =>
      o.setName('agent_role')
        .setDescription('Role with access to add, transfer, notes, and read commands')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);

    // Allow guild owner to run setup even with no config yet
    const isOwner = interaction.member.id === interaction.guild.ownerId;

    if (config) {
      const adminRoleId = config.admin_role_id;
      if (!isOwner && (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId))) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You must have the Admin role or be the server owner to run `/setup`.')],
          ephemeral: true,
        });
      }
    } else if (!isOwner) {
      return interaction.reply({
        embeds: [buildErrorEmbed('Only the server owner can run the first-time `/setup`.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const dashChannel  = interaction.options.getChannel('dashboard_channel');
    const auditChannel = interaction.options.getChannel('audit_channel');
    const adminRole    = interaction.options.getRole('admin_role');
    const agentRole    = interaction.options.getRole('agent_role');

    const newConfig = await upsertConfig(guildId, {
      dashboard_channel_id: dashChannel.id,
      audit_channel_id: auditChannel.id,
      admin_role_id: adminRole.id,
      agent_role_id: agentRole.id,
    });

    // Post initial dashboard
    await refreshDashboard(client, guildId);

    await interaction.editReply({
      embeds: [buildSetupEmbed(newConfig, dashChannel, auditChannel, adminRole, agentRole)],
    });
  },
};
