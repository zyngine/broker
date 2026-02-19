const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getConfig, getProperty } = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildRemoveConfirmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('house')
    .setDescription('Manage properties in the registry')
    .addSubcommand((sub) =>
      sub.setName('add')
        .setDescription('Add a new property to the registry')
    )
    .addSubcommand((sub) =>
      sub.setName('transfer')
        .setDescription('Transfer a property to a new owner')
        .addStringOption((o) =>
          o.setName('property_id')
            .setDescription('The Property ID to transfer')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('remove')
        .setDescription('[ADMIN] Permanently delete a property from the registry')
        .addStringOption((o) =>
          o.setName('property_id')
            .setDescription('The Property ID to permanently delete')
            .setRequired(true)
        )
    ),

  async execute(client, interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);

    // /house add
    if (sub === 'add') {
      const allowed = await checkPermission(interaction, config, 'agent');
      if (!allowed) return;

      const modal = new ModalBuilder()
        .setCustomId('modal_house_add')
        .setTitle('Add Property  (1/2)');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('property_id').setLabel('Property ID')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
            .setPlaceholder('e.g. PROP001')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('address').setLabel('Address')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255)
            .setPlaceholder('e.g. 123 Grove St')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('address_type').setLabel('Address Type')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
            .setPlaceholder('e.g. House, Apartment, Commercial')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('price').setLabel('Price ($)')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)
            .setPlaceholder('e.g. 250000')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('owner_name').setLabel('Owner Name')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255)
            .setPlaceholder('Full name of the owner')
        ),
      );

      return interaction.showModal(modal);
    }

    // /house transfer
    if (sub === 'transfer') {
      const allowed = await checkPermission(interaction, config, 'agent');
      if (!allowed) return;

      const propertyId = interaction.options.getString('property_id').trim().toUpperCase();
      const property   = await getProperty(guildId, propertyId);

      if (!property) {
        return interaction.reply({
          embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_house_transfer:${encodeURIComponent(propertyId)}`)
        .setTitle(`Transfer  ${propertyId}  (1/2)`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('address').setLabel('Address')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255)
            .setValue(property.address)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('address_type').setLabel('Address Type')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
            .setValue(property.address_type)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('price').setLabel('Price ($)')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)
            .setValue(String(property.price))
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('owner_name').setLabel('New Owner Name')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255)
            .setPlaceholder('Full name of the new owner')
        ),
      );

      return interaction.showModal(modal);
    }

    // /house remove
    if (sub === 'remove') {
      const allowed = await checkPermission(interaction, config, 'admin');
      if (!allowed) return;

      const propertyId = interaction.options.getString('property_id').trim().toUpperCase();
      const property   = await getProperty(guildId, propertyId);

      if (!property) {
        return interaction.reply({
          embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
          ephemeral: true,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_remove:${propertyId}:${interaction.user.id}`)
          .setLabel('Yes, Delete Permanently')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`cancel_action:${propertyId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.reply({
        embeds: [buildRemoveConfirmEmbed(property)],
        components: [row],
        ephemeral: true,
      });
    }
  },
};
