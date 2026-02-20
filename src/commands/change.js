const { SlashCommandBuilder } = require('discord.js');
const {
  getConfig, getProperty, createProperty, deleteProperty, insertHistory,
} = require('../database/queries');
const { checkPermission } = require('../utils/permissions');
const { buildErrorEmbed, buildPropertyEmbed } = require('../utils/embeds');
const { postAuditLog }     = require('../utils/auditLogger');
const { refreshDashboard } = require('../utils/dashboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('change')
    .setDescription('Change a property\'s interior / house number')

    // ── /change interior ──────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('interior')
        .setDescription('Change a property type — this reassigns the house number')
        .addStringOption((o) =>
          o.setName('house_number')
            .setDescription('Current house number / property ID')
            .setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('new_house_number')
            .setDescription('New house number / property ID after the interior change')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption((o) =>
          o.setName('property_type')
            .setDescription('New property type (e.g. 2-Bed Apartment, Villa)')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((o) =>
          o.setName('postal')
            .setDescription('New postal code (leave blank to keep current)')
            .setRequired(false)
            .setMaxLength(20)
        )
        .addIntegerOption((o) =>
          o.setName('price')
            .setDescription('New price in dollars (leave blank to keep current)')
            .setRequired(false)
            .setMinValue(0)
        )
    ),

  async execute(client, interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config  = await getConfig(guildId);

    // ── /change interior ──────────────────────────────────────────────────────
    if (sub === 'interior') {
      const allowed = await checkPermission(interaction, config, 'agent');
      if (!allowed) return;

      const oldId        = interaction.options.getString('house_number').trim().toUpperCase();
      const newId        = interaction.options.getString('new_house_number').trim().toUpperCase();
      const propertyType = interaction.options.getString('property_type').trim();
      const postalRaw    = interaction.options.getString('postal')?.trim() || null;
      const priceRaw     = interaction.options.getInteger('price');

      await interaction.deferReply({ ephemeral: false });

      // ── Validate old property exists ─────────────────────────────────────
      const oldProperty = await getProperty(guildId, oldId);
      if (!oldProperty) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(`Property \`${oldId}\` not found.`)],
        });
      }

      // ── Validate new house number is free ────────────────────────────────
      if (newId !== oldId) {
        const conflict = await getProperty(guildId, newId);
        if (conflict) {
          return interaction.editReply({
            embeds: [buildErrorEmbed(`House number \`${newId}\` is already in use.`)],
          });
        }
      }

      const postal = postalRaw ?? oldProperty.postal;
      const price  = priceRaw  ?? oldProperty.price ?? 0;

      // ── Create the new property record ───────────────────────────────────
      const newProperty = await createProperty(guildId, {
        property_id:   newId,
        owner_name:    oldProperty.owner_name,
        owner_cid:     oldProperty.owner_cid,
        postal,
        property_tier: oldProperty.property_tier,
        interior_type: propertyType,
        price,
      });

      // ── Archive: record house_change on the OLD house number ─────────────
      await insertHistory(
        guildId, oldId, 'house_change',
        interaction.user.id, interaction.user.tag,
        oldProperty, newProperty
      );

      // ── Archive: record add on the NEW house number ──────────────────────
      await insertHistory(
        guildId, newId, 'add',
        interaction.user.id, interaction.user.tag,
        null, newProperty
      );

      // ── Delete the old property record ───────────────────────────────────
      await deleteProperty(guildId, oldId);

      // ── Audit log ─────────────────────────────────────────────────────────
      await postAuditLog(client, guildId, {
        action:         'house_change',
        propertyId:     oldId,
        performedById:  interaction.user.id,
        performedByTag: interaction.user.tag,
        oldData:        oldProperty,
        newData:        newProperty,
      });

      await refreshDashboard(client, guildId);

      return interaction.editReply({
        embeds: [buildPropertyEmbed(newProperty, `Interior Changed  •  ${oldId} → ${newId}`)],
      });
    }
  },
};
