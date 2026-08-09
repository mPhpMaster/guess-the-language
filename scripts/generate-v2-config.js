'use strict';

/**
 * Writes the runtime config for the SolidJS rewrite served at /v2/.
 *
 * public/v2 is a build artifact copied in from the rewrite's own repo (see
 * scripts/sync-v2.js). That build happens on a developer machine, where the
 * Supabase/Discord environment variables are absent — so the config files it
 * produces are EMPTY placeholders. This script overwrites them at deploy time,
 * which is what makes /v2/ reach the backend at all.
 *
 * It derives the values from the v1 files generated moments earlier in the same
 * build rather than reading the environment directly: that way /v2/ always talks
 * to exactly the same backend as /, no matter which variable names supply it.
 *
 * Runs as part of `build:web`, after generate-supabase-config / generate-discord-config.
 */

const fs = require('node:fs');
const path = require('node:path');

const distWeb = path.join(__dirname, '..', 'dist-web');
const outDir = path.join(distWeb, 'v2');

if (!fs.existsSync(outDir)) {
  console.log('No dist-web/v2 — nothing to configure.');
  process.exit(0);
}

/** Pull a "key: <json string>" value out of an already-generated config file. */
function readGenerated(file, key) {
  const full = path.join(distWeb, file);
  if (!fs.existsSync(full)) return '';
  const match = fs.readFileSync(full, 'utf-8').match(
    new RegExp(key + String.raw`\s*:\s*(['"])([\s\S]*?)\1`)
  );
  return match ? match[2] : '';
}

// Identical shape in both apps (window.SUPABASE_CONFIG = { url, anonKey }), so the
// v1 file can be reused verbatim.
const v1Supabase = path.join(distWeb, 'supabase-config.js');
if (fs.existsSync(v1Supabase)) {
  fs.copyFileSync(v1Supabase, path.join(outDir, 'supabase-config.js'));
  console.log('Copied supabase-config.js -> dist-web/v2/');
} else {
  console.warn('dist-web/supabase-config.js missing — /v2/ will have no backend.');
}

// The rewrite's DISCORD_CONFIG carries two extra fields, so rebuild rather than copy.
const clientId =
  readGenerated('discord-config.js', 'clientId') ||
  process.env.VITE_DISCORD_CLIENT_ID ||
  process.env.DISCORD_CLIENT_ID ||
  '';

const discord = `// Auto-generated at build time — do not edit.
window.DISCORD_CONFIG = {
  clientId: ${JSON.stringify(clientId)},
  maxParticipants: ${JSON.stringify(Number(process.env.DISCORD_MAX_PARTICIPANTS || 12))},
  presenceImage: ${JSON.stringify(process.env.DISCORD_PRESENCE_IMAGE || '8-modeselect')}
};
`;

fs.writeFileSync(path.join(outDir, 'discord-config.js'), discord, 'utf-8');
console.log('Wrote', path.join(outDir, 'discord-config.js'));
