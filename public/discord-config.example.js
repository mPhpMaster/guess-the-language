// ---------------------------------------------------------------------------
// Discord Activity configuration TEMPLATE.
//
// 1. Copy this file to "discord-config.js" (same folder).
// 2. Paste your OAuth2 Client ID (Discord Developer Portal -> General).
// 3. Set DISCORD_CLIENT_SECRET in the deployment env for /api/token.
//
// If clientId is blank the game still runs on the web and in Electron.
// ---------------------------------------------------------------------------
window.DISCORD_CONFIG = {
  clientId: '',
  maxParticipants: 5,
  presenceImage: '8-modeselect'
};
