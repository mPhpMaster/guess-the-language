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

// renderer.js is a native ES module entry; ship its module graph alongside it.
// The `?v=` stamping below rewrites index.html's script src, but a module's OWN
// import specifiers resolve relative to itself and would keep stable URLs — so
// the Discord client would happily serve last release's modules behind a fresh
// renderer.js. Stamp the specifiers too, making every release a new URL.
copyDir(path.join(src, 'modules'), path.join(out, 'modules'));

(function stampModuleImports() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  const v = encodeURIComponent(pkg.version);
  const rewrite = (file) => {
    const before = fs.readFileSync(file, 'utf-8');
    // Covers both static `from './x.js'` and the dynamic `import('./modules/app.js')`
    // that renderer.js uses to enter the graph.
    const after = before.replace(
      /(\bfrom\s+['"]|\bimport\(\s*['"])(\.\.?\/[^'"?]+\.js)(['"])/g,
      `$1$2?v=${v}$3`
    );
    if (after !== before) fs.writeFileSync(file, after, 'utf-8');
  };
  rewrite(path.join(out, 'renderer.js'));
  for (const name of fs.readdirSync(path.join(out, 'modules'))) {
    if (name.endsWith('.js')) rewrite(path.join(out, 'modules', name));
  }
  console.log('Stamped ?v=' + pkg.version + ' onto ES module import specifiers');
})();

// Cache-bust the non-hashed classic scripts. Vite fingerprints its own bundle
// (assets/index-<hash>.js), but renderer.js / multiplayer.js / web-shim.js and
// the config files keep stable URLs — so a client (notably the Discord Activity
// client, which caches the iframe aggressively) serves an OLD copy by URL across
// deploys, and updates never appear until the cache is cleared. Appending
// ?v=<version> to their src makes every release a fresh URL. index.html itself is
// served must-revalidate, so it's re-fetched on launch and pulls the new scripts.
(function stampVersionQueries() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  const v = encodeURIComponent(pkg.version);
  const indexPath = path.join(out, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  const bustable = [
    'discord-config.js', 'supabase-config.js', 'vendor/supabase.js',
    'web-shim.js', 'multiplayer.js', 'renderer.js'
  ];
  let html = fs.readFileSync(indexPath, 'utf-8');
  for (const name of bustable) {
    // Match src="name" or src="/name" (optionally already query-stamped) and
    // (re)write the query to the current version.
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(src=")(/?' + esc + ')(\\?[^"]*)?(")', 'g');
    html = html.replace(re, `$1$2?v=${v}$4`);
  }
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('Stamped ?v=' + pkg.version + ' onto classic scripts in index.html');
})();

console.log('Copied web assets to dist-web/');
