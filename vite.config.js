import { defineConfig } from 'vite';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, 'src');
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

function injectVersion(code) {
  return code.replace(/__GTL_VERSION__/g, pkg.version);
}

/** Classic script tags — serve raw so Vite does not parse dynamic imports inside vendor/supabase.js */
const STATIC_PREFIXES = ['vendor/', 'data/'];
const STATIC_FILES = new Set([
  'renderer.js',
  'multiplayer.js',
  'supabase-config.js',
  'web-shim.js'
]);

function isStaticAsset(rel) {
  return STATIC_FILES.has(rel) || STATIC_PREFIXES.some((p) => rel.startsWith(p));
}

function contentType(rel) {
  if (rel.endsWith('.json')) return 'application/json';
  return 'application/javascript';
}

function staticAssetPlugin() {
  return {
    name: 'static-classic-scripts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const rel = decodeURIComponent(url.startsWith('/') ? url.slice(1) : url);
        if (!rel || !isStaticAsset(rel)) return next();

        const filePath = path.join(srcRoot, rel);
        if (!filePath.startsWith(srcRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
          return next();
        }

        let body = readFileSync(filePath, 'utf-8');
        if (rel === 'web-shim.js') body = injectVersion(body);

        res.setHeader('Content-Type', contentType(rel));
        res.end(body);
      });
    }
  };
}

export default defineConfig({
  root: 'src',
  base: '/',
  build: {
    outDir: '../dist-web',
    emptyOutDir: true
  },
  plugins: [staticAssetPlugin()]
});
