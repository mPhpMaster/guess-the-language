'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');
const out = path.join(__dirname, '..', 'dist-web');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const f = path.join(from, name);
    const t = path.join(to, name);
    if (fs.statSync(f).isDirectory()) copyDir(f, t);
    else fs.copyFileSync(f, t);
  }
}

const files = [
  'renderer.js',
  'multiplayer.js',
  'web-shim.js',
  path.join('vendor', 'supabase.js')
];

for (const file of files) {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let contents = fs.readFileSync(path.join(src, file), 'utf-8');
  if (file === 'web-shim.js') {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    contents = contents.replace(/__GTL_VERSION__/g, pkg.version);
  }
  fs.writeFileSync(dest, contents, 'utf-8');
}

copyDir(path.join(src, 'data'), path.join(out, 'data'));
console.log('Copied web assets to dist-web/');
