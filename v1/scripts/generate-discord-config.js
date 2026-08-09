'use strict';

const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', 'dist-web', 'discord-config.js');
const clientId =
  process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '';

const body = `// Auto-generated at build time — do not edit.
window.DISCORD_CONFIG = {
  clientId: ${JSON.stringify(clientId)}
};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, body, 'utf-8');
console.log('Wrote', outFile);
