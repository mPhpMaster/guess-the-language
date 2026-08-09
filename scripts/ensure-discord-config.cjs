'use strict';

/* Copy the Discord config template into public/ on first run. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'public', 'discord-config.js');
const template = path.join(__dirname, 'templates', 'discord-config.example.js');

fs.mkdirSync(path.dirname(target), { recursive: true });
if (!fs.existsSync(target)) {
    fs.copyFileSync(template, target);
    console.log('Copied discord-config.example.js → public/discord-config.js');
}
