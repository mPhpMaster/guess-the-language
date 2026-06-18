'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'src', 'discord-config.js');
const example = path.join(root, 'src', 'discord-config.example.js');

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  console.log('Copied discord-config.example.js → src/discord-config.js');
}
