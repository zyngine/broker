require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  databaseUrl: process.env.DATABASE_URL,

  colors: {
    primary: 0x6B21A8,   // Purple — informational embeds
    accent: 0xFFD700,    // Gold — dashboard / highlights
    success: 0x22C55E,   // Green — success confirmations
    danger: 0xEF4444,    // Red — destructive action confirmations
    dark: 0x1C1C1E,      // iOS dark surface
    muted: 0x3B3B3B,     // Muted grey — secondary info
  },

  dashboard: {
    propertiesPerPage: 15,
  },
};
