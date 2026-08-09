'use strict';

/* Overwrite the placeholder public/discord-config.js copied into dist-web with the
   real values from the build environment. */

const fs = require('node:fs');
const path = require('node:path');

const outFile = path.join(__dirname, '..', 'dist-web', 'discord-config.js');
const clientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '';
const maxParticipants = Number(process.env.DISCORD_MAX_PARTICIPANTS || 12);
const presenceImage = process.env.DISCORD_PRESENCE_IMAGE || '8-modeselect';

const body = `// Auto-generated at build time — do not edit.
window.DISCORD_CONFIG = {
  clientId: ${JSON.stringify(clientId)},
  maxParticipants: ${JSON.stringify(maxParticipants)},
  presenceImage: ${JSON.stringify(presenceImage)}
};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, body, 'utf-8');
console.log('Wrote', outFile);
