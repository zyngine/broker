const { buildErrorEmbed } = require('./embeds');

const TIER_RANK = { everyone: 0, agent: 1, admin: 2 };

/**
 * Returns the tier of a guild member based on their roles.
 * @param {GuildMember} member
 * @param {object|null} config - row from bot_config
 * @returns {'admin'|'agent'|'everyone'}
 */
function getUserTier(member, config) {
  if (!config) return 'everyone';
  if (config.admin_role_id && member.roles.cache.has(config.admin_role_id)) return 'admin';
  if (config.agent_role_id && member.roles.cache.has(config.agent_role_id)) return 'agent';
  return 'everyone';
}

/**
 * Returns true if userTier meets or exceeds requiredTier.
 */
function canExecute(userTier, requiredTier) {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/**
 * Checks permission for an interaction. Replies with a denial embed if denied.
 * @returns {boolean} true if allowed, false if denied
 */
async function checkPermission(interaction, config, requiredTier) {
  const tier = getUserTier(interaction.member, config);
  if (canExecute(tier, requiredTier)) return true;

  const embed = buildErrorEmbed('You do not have permission to use this command.');
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return false;
}

module.exports = { getUserTier, canExecute, checkPermission };
