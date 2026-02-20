const {
  SlashCommandBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
} = require('discord.js');
const {
  getConfig, getProperty, createProperty, updateProperty, insertHistory,
} = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildRemoveConfirmEmbed, buildPropertyEmbed } = require('../utils/embeds');
const { postAuditLog }    = require('../utils/auditLogger');
const { refreshDashboard } = require('../utils/dashboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('house')
    .setDescription('Manage properties in the registry')

    // ── /house add ────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('add')
        .setDescription('Add a new property to the registry')
        .addStringOption((o) =>
          o.setName('property_id')
            .setDescription('Unique property ID (e.g. PROP001)')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption((o) =>
          o.setName('address')
            .setDescription('Full property address')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption((o) =>
          o.setName('address_type')
            .setDescription('Type of property (e.g. House, Apartment, Commercial)')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addIntegerOption((o) =>
          o.setName('price')
            .setDescription('Sale price in dollars (e.g. 450000)')
            .setRequired(true)
            .setMinValue(0)
        )
        .addStringOption((o) =>
          o.setName('owner_name')
            .setDescription('Full name of the owner')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption((o) =>
          o.setName('owner_cid')
            .setDescription('Owner CID number')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((o) =>
          o.setName('owner_license')
            .setDescription('Owner license number')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption((o) =>
          o.setName('notes')
            .setDescription('Optional notes about this property')
            .setRequired(false)
            .setMaxLength(1000)
        )
    )

    // ── /house transfer ───────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('transfer')
        .setDescription('Transfer a property to a new owner')
        .addStringOption((o) =>
          o.setName('property_id')
            .setDescription('Property ID to transfer')
            .setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('owner_name')
            .setDescription('New owner full name')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption((o) =>
          o.setName('owner_cid')
            .setDescription('New owner CID')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((o) =>
          o.setName('owner_license')
            .setDescription('New owner license')
            .setRequired(true)
            .setMaxLength(255)
        )
        .addStringOption((o) =>
          o.setName('address')
            .setDescription('New address (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(255)
        )
        .addStringOption((o) =>
          o.setName('address_type')
            .setDescription('New address type (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(50)
        )
        .addIntegerOption((o) =>
          o.setName('price')
            .setDescription('New price in dollars (leave blank to keep current)')
            .setRequired(false)
            .setMinValue(0)
        )
        .addStringOption((o) =>
          o.setName('notes')
            .setDescription('Notes (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(1000)
        )
    )

    // ── /house remove ─────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('remove')
        .setDescription('[ADMIN] Permanently delete a property from the registry')
        .addStringOption((o) =>
          o.setName('property_id')
            .setDescription('Property ID to permanently delete')
            .setRequired(true)
        )
    ),

  async execute(client, interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);

    // ── /house add ────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const allowed = await checkPermission(interaction, config, 'agent');
      if (!allowed) return;

      const property_id   = interaction.options.getString('property_id').trim().toUpperCase();
      const address       = interaction.options.getString('address').trim();
      const address_type  = interaction.options.getString('address_type').trim();
      const price         = interaction.options.getInteger('price');
      const owner_name    = interaction.options.getString('owner_name').trim();
      const owner_cid     = interaction.options.getString('owner_cid').trim();
      const owner_license = interaction.options.getString('owner_license').trim();
      const notes         = interaction.options.getString('notes')?.trim() || null;

      await interaction.deferReply({ ephemeral: false });

      const existing = await getProperty(guildId, property_id);
      if (existing) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(`Property \`${property_id}\` already exists. Use \`/house transfer\` to update it.`)],
        });
      }

      const property = await createProperty(guildId, {
        property_id, address, address_type, price, owner_name, owner_cid, owner_license, notes,
      });

      await insertHistory(
        guildId, property.property_id, 'add',
        interaction.user.id, interaction.user.tag,
        null, property
      );

      await postAuditLog(client, guildId, {
        action: 'add',
        propertyId: property.property_id,
        performedById: interaction.user.id,
        performedByTag: interaction.user.tag,
        oldData: null,
        newData: property,
      });

      await refreshDashboard(client, guildId);

      return interaction.editReply({ embeds: [buildPropertyEmbed(property, 'Property Added')] });
    }

    // ── /house transfer ───────────────────────────────────────────────────────
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

      const owner_name    = interaction.options.getString('owner_name').trim();
      const owner_cid     = interaction.options.getString('owner_cid').trim();
      const owner_license = interaction.options.getString('owner_license').trim();
      // Optional fields fall back to the current property values
      const address       = interaction.options.getString('address')?.trim()      || property.address;
      const address_type  = interaction.options.getString('address_type')?.trim() || property.address_type;
      const price         = interaction.options.getInteger('price') ?? property.price;
      const notes         = interaction.options.getString('notes')?.trim()        || property.notes;

      await interaction.deferReply({ ephemeral: false });

      const updated = await updateProperty(guildId, propertyId, {
        address, address_type, price, owner_name, owner_cid, owner_license, notes,
      });

      await insertHistory(
        guildId, propertyId, 'transfer',
        interaction.user.id, interaction.user.tag,
        property, updated
      );

      await postAuditLog(client, guildId, {
        action: 'transfer',
        propertyId,
        performedById: interaction.user.id,
        performedByTag: interaction.user.tag,
        oldData: property,
        newData: updated,
      });

      await refreshDashboard(client, guildId);

      return interaction.editReply({ embeds: [buildPropertyEmbed(updated, 'Property Transferred')] });
    }

    // ── /house remove ─────────────────────────────────────────────────────────
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
