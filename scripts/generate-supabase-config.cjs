'use strict';

const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', 'dist-web', 'supabase-config.js');
const url = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const body = `// Auto-generated at build time — do not edit.
window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, body, 'utf-8');
console.log('Wrote', outFile);
