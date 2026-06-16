'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'src', 'supabase-config.js');
const example = path.join(root, 'src', 'supabase-config.example.js');

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  console.log('Copied supabase-config.example.js → src/supabase-config.js');
}
