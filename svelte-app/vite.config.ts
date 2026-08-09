import { defineConfig, loadEnv, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

/**
 * Dev-only stand-in for the deployed `/api/token` function: exchanges a Discord
 * authorization code for an access token so the Activity handshake can be
 * exercised locally. Production keeps using the real serverless endpoint.
 */
function discordTokenDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'discord-token-dev',
    configureServer(server) {
      server.middlewares.use('/api/token', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        const clientId = env.VITE_DISCORD_CLIENT_ID || env.DISCORD_CLIENT_ID;
        const clientSecret = env.DISCORD_CLIENT_SECRET;
        res.setHeader('Content-Type', 'application/json');

        if (!clientId || !clientSecret) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Discord OAuth is not configured' }));
          return;
        }

        try {
          const { code } = await readJsonBody(req);
          if (!code) {
            res.statusCode = 400;
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
              code: String(code)
            })
          });
          const data = await tokenRes.json();
          res.statusCode = tokenRes.status;
          res.end(JSON.stringify(tokenRes.ok ? { access_token: data.access_token } : data));
        } catch (err) {
          console.error('Discord token dev proxy error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Token exchange failed' }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    // Electron loads the build from disk (file://), so that target needs relative
    // URLs; web and the Discord Activity iframe both serve from the domain root.
    base: env.GTL_BASE || '/',
    plugins: [svelte(), discordTokenDevPlugin(env)],
    resolve: {
      alias: { $lib: path.join(__dirname, 'src/lib') }
    },
    define: {
      __GTL_VERSION__: JSON.stringify(pkg.version)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2022',
      // The Discord Activity runs in an iframe on mobile data — keep an eye on
      // payload size rather than silently shipping a bloated bundle.
      chunkSizeWarningLimit: 700
    },
    server: { port: 5273 }
  };
});
