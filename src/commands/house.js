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
          o.setName('house_number')
            .setDescription('House number / property ID (e.g. 42, PROP001)')
            .setRequired(true)
            .setMaxLength(50)
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
          o.setName('postal')
            .setDescription('Postal code of the property')
            .setRequired(false)
            .setMaxLength(20)
        )
        .addStringOption((o) =>
          o.setName('property_tier')
            .setDescription('Property tier (e.g. Tier 1, Tier 2)')
            .setRequired(false)
            .setMaxLength(50)
        )
        .addStringOption((o) =>
          o.setName('interior_type')
            .setDescription('Interior type (e.g. 2-Bed Apartment, Villa)')
            .setRequired(false)
            .setMaxLength(100)
        )
    )

    // ── /house transfer ───────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('transfer')
        .setDescription('Transfer a property to a new owner')
        .addStringOption((o) =>
          o.setName('house_number')
            .setDescription('House number / property ID to transfer')
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
          o.setName('postal')
            .setDescription('New postal code (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(20)
        )
        .addStringOption((o) =>
          o.setName('property_tier')
            .setDescription('New property tier (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(50)
        )
        .addStringOption((o) =>
          o.setName('interior_type')
            .setDescription('New interior type (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(100)
        )
    )

    // ── /house remove ─────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('remove')
        .setDescription('[ADMIN] Permanently delete a property from the registry')
        .addStringOption((o) =>
          o.setName('house_number')
            .setDescription('House number / property ID to permanently delete')
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

      const property_id   = interaction.options.getString('house_number').trim().toUpperCase();
      const owner_name    = interaction.options.getString('owner_name').trim();
      const owner_cid     = interaction.options.getString('owner_cid').trim();
      const postal        = interaction.options.getString('postal')?.trim()        || null;
      const property_tier = interaction.options.getString('property_tier')?.trim() || null;
      const interior_type = interaction.options.getString('interior_type')?.trim() || null;

      await interaction.deferReply({ ephemeral: false });

      const existing = await getProperty(guildId, property_id);
      if (existing) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(`Property \`${property_id}\` already exists. Use \`/house transfer\` to update it.`)],
        });
      }

      const property = await createProperty(guildId, {
        property_id, owner_name, owner_cid, postal, property_tier, interior_type,
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

      const propertyId = interaction.options.getString('house_number').trim().toUpperCase();
      const property   = await getProperty(guildId, propertyId);

      if (!property) {
        return interaction.reply({
          embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
          ephemeral: true,
        });
      }

      const owner_name    = interaction.options.getString('owner_name').trim();
      const owner_cid     = interaction.options.getString('owner_cid').trim();
      // Optional fields fall back to the current property values
      const postal        = interaction.options.getString('postal')?.trim()        ?? property.postal;
      const property_tier = interaction.options.getString('property_tier')?.trim() ?? property.property_tier;
      const interior_type = interaction.options.getString('interior_type')?.trim() ?? property.interior_type;

      await interaction.deferReply({ ephemeral: false });

      const updated = await updateProperty(guildId, propertyId, {
        owner_name, owner_cid, postal, property_tier, interior_type,
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

      const propertyId = interaction.options.getString('house_number').trim().toUpperCase();
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
