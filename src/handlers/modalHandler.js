/**
 * Handles modal submissions for /house add and /house transfer.
 *
 * Discord modals max at 5 fields. Both commands need 8 fields,
 * so we chain two modals. Modal 1 data is stored in pendingData
 * (a Map<userId, {data, action, original_property_id}>).
 * Modal 2 retrieves it and completes the operation.
 */

const {
  createProperty, updateProperty, insertHistory, getProperty,
} = require('../database/queries');
const { buildPropertyEmbed, buildErrorEmbed } = require('../utils/embeds');
const { postAuditLog }  = require('../utils/auditLogger');
const { refreshDashboard } = require('../utils/dashboard');

// In-memory store for partial modal data, keyed by userId
// Entries expire after 5 minutes
const pendingData = new Map();

function storePending(userId, payload) {
  pendingData.set(userId, {
    ...payload,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}

function retrievePending(userId) {
  const entry = pendingData.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingData.delete(userId);
    return null;
  }
  pendingData.delete(userId);
  return entry;
}

// ─── Modal 1 handlers ────────────────────────────────────────────────────────

async function handleHouseAddModal1(client, interaction) {
  const property_id  = interaction.fields.getTextInputValue('property_id').trim().toUpperCase();
  const address      = interaction.fields.getTextInputValue('address').trim();
  const address_type = interaction.fields.getTextInputValue('address_type').trim();
  const priceRaw     = interaction.fields.getTextInputValue('price').trim().replace(/[$,]/g, '');
  const owner_name   = interaction.fields.getTextInputValue('owner_name').trim();

  const price = parseInt(priceRaw, 10);
  if (isNaN(price) || price < 0) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Price must be a valid whole number (e.g. 250000).')],
      ephemeral: true,
    });
  }

  storePending(interaction.user.id, {
    action: 'add',
    data: { property_id, address, address_type, price, owner_name },
  });

  // Show modal 2
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`modal_house_add_2`)
    .setTitle('Add Property  (2/2)');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('owner_cid').setLabel('Owner CID').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('owner_license').setLabel('Owner License').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('notes').setLabel('Notes (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
    ),
  );

  await interaction.showModal(modal);
}

async function handleHouseAddModal2(client, interaction) {
  const pending = retrievePending(interaction.user.id);
  if (!pending) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/house add` again.')],
      ephemeral: true,
    });
  }

  const owner_cid     = interaction.fields.getTextInputValue('owner_cid').trim();
  const owner_license = interaction.fields.getTextInputValue('owner_license').trim();
  const notes         = interaction.fields.getTextInputValue('notes').trim() || null;

  const fullData = { ...pending.data, owner_cid, owner_license, notes };

  await interaction.deferReply({ ephemeral: false });

  const guildId = interaction.guildId;

  // Check for duplicate property_id
  const existing = await getProperty(guildId, fullData.property_id);
  if (existing) {
    return interaction.editReply({
      embeds: [buildErrorEmbed(`Property \`${fullData.property_id}\` already exists. Use \`/house transfer\` to update it.`)],
    });
  }

  const property = await createProperty(guildId, fullData);

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

  await interaction.editReply({ embeds: [buildPropertyEmbed(property, 'Property Added')] });
}

// ─── Transfer modals ─────────────────────────────────────────────────────────

async function handleHouseTransferModal1(client, interaction) {
  const [, encodedId] = interaction.customId.split(':');
  const property_id  = decodeURIComponent(encodedId);

  const address      = interaction.fields.getTextInputValue('address').trim();
  const address_type = interaction.fields.getTextInputValue('address_type').trim();
  const priceRaw     = interaction.fields.getTextInputValue('price').trim().replace(/[$,]/g, '');
  const owner_name   = interaction.fields.getTextInputValue('owner_name').trim();

  const price = parseInt(priceRaw, 10);
  if (isNaN(price) || price < 0) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Price must be a valid whole number (e.g. 250000).')],
      ephemeral: true,
    });
  }

  storePending(interaction.user.id, {
    action: 'transfer',
    originalPropertyId: property_id,
    data: { property_id, address, address_type, price, owner_name },
  });

  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`modal_house_transfer_2`)
    .setTitle(`Transfer  ${property_id}  (2/2)`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('owner_cid').setLabel('New Owner CID').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('owner_license').setLabel('New Owner License').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('notes').setLabel('Notes (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
    ),
  );

  await interaction.showModal(modal);
}

async function handleHouseTransferModal2(client, interaction) {
  const pending = retrievePending(interaction.user.id);
  if (!pending) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/house transfer` again.')],
      ephemeral: true,
    });
  }

  const owner_cid     = interaction.fields.getTextInputValue('owner_cid').trim();
  const owner_license = interaction.fields.getTextInputValue('owner_license').trim();
  const notes         = interaction.fields.getTextInputValue('notes').trim() || null;

  const fullData = { ...pending.data, owner_cid, owner_license, notes };

  await interaction.deferReply({ ephemeral: false });

  const guildId = interaction.guildId;
  const propertyId = pending.originalPropertyId;

  const oldProperty = await getProperty(guildId, propertyId);
  if (!oldProperty) {
    return interaction.editReply({
      embeds: [buildErrorEmbed(`Property \`${propertyId}\` not found.`)],
    });
  }

  const updated = await updateProperty(guildId, propertyId, fullData);

  await insertHistory(
    guildId, propertyId, 'transfer',
    interaction.user.id, interaction.user.tag,
    oldProperty, updated
  );

  await postAuditLog(client, guildId, {
    action: 'transfer',
    propertyId,
    performedById: interaction.user.id,
    performedByTag: interaction.user.tag,
    oldData: oldProperty,
    newData: updated,
  });

  await refreshDashboard(client, guildId);

  await interaction.editReply({ embeds: [buildPropertyEmbed(updated, 'Property Transferred')] });
}

// ─── Router ──────────────────────────────────────────────────────────────────

async function handleModalSubmit(client, interaction) {
  const id = interaction.customId;

  try {
    if (id === 'modal_house_add')        return await handleHouseAddModal1(client, interaction);
    if (id === 'modal_house_add_2')      return await handleHouseAddModal2(client, interaction);
    if (id.startsWith('modal_house_transfer:')) return await handleHouseTransferModal1(client, interaction);
    if (id === 'modal_house_transfer_2') return await handleHouseTransferModal2(client, interaction);
  } catch (err) {
    console.error('[ModalHandler] Error:', err);
    const reply = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
    await interaction[reply]({
      embeds: [buildErrorEmbed('An unexpected error occurred. Please try again.')],
      ephemeral: true,
    });
  }
}

module.exports = { handleModalSubmit };
