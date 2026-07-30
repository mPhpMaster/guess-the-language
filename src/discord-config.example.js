// ---------------------------------------------------------------------------
// Discord Activity configuration TEMPLATE.
//
// 1. Copy this file to "discord-config.js" (same folder).
// 2. Create an app at https://discord.com/developers/applications
// 3. Enable Activities, add URL mapping (/.proxy -> your Vercel URL).
// 4. Paste your OAuth2 Client ID below (General Information).
// 5. Set DISCORD_CLIENT_SECRET in Vercel env vars for /api/token.
//
// If clientId is blank, the game still runs on the web and in Electron.
// ---------------------------------------------------------------------------
window.DISCORD_CONFIG = {
  clientId: '', // e.g. '1234567890123456789'

  // --- Rich presence (the card shown when a member is clicked) — both optional.
  // The "of N" in Discord's party badge. MUST match Activities -> Settings ->
  // "Maximum Participants" in the Developer Portal. Note an EMPTY field there is
  // not unlimited — it is Discord's default of 5.
  maxParticipants: 12,
  // Art asset key from Rich Presence -> Art Assets, used as the card's image.
  // An unknown key just renders no image.
  presenceImage: '8-modeselect'
};
