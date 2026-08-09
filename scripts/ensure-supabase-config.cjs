'use strict';

/* Copy the Supabase config template into public/ on first run, so the dev server
   and the build always have a `window.SUPABASE_CONFIG` to load. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'public', 'supabase-config.js');
const template = path.join(__dirname, 'templates', 'supabase-config.example.js');

fs.mkdirSync(path.dirname(target), { recursive: true });
if (!fs.existsSync(target)) {
    fs.copyFileSync(template, target);
    console.log('Copied supabase-config.example.js → public/supabase-config.js');
}
