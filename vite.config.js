import { defineConfig, loadEnv } from 'vite';
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
  'discord-config.js',
  'web-shim.js'
]);

function isStaticAsset(rel) {
  return STATIC_FILES.has(rel) || STATIC_PREFIXES.some((p) => rel.startsWith(p));
}

function contentType(rel) {
  if (rel.endsWith('.json')) return 'application/json';
  return 'application/javascript';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function discordTokenDevPlugin(env) {
  return {
    name: 'discord-token-dev',
    configureServer(server) {
      server.middlewares.use('/api/token', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        const clientId = env.VITE_DISCORD_CLIENT_ID || env.DISCORD_CLIENT_ID;
        const clientSecret = env.DISCORD_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Discord OAuth is not configured' }));
          return;
        }

        try {
          const { code } = await readJsonBody(req);
          if (!code) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing authorization code' }));
            return;
          }

          const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: 'authorization_code',
              code
            })
          });

          const data = await tokenRes.json();
          res.statusCode = tokenRes.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(tokenRes.ok ? { access_token: data.access_token } : data));
        } catch (err) {
          console.error('Discord token dev proxy error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Token exchange failed' }));
        }
      });
    }
  };
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(__dirname), '');

  return {
    root: 'src',
    publicDir: path.join(__dirname, 'public'),
    base: '/',
    build: {
      outDir: '../dist-web',
      emptyOutDir: true
    },
    plugins: [staticAssetPlugin(), discordTokenDevPlugin(env)]
  };
});
