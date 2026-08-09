import { defineConfig, loadEnv, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

interface PackageManifest {
    readonly version: string;
}

const pkg = JSON.parse(
    readFileSync(path.join(rootDir, 'package.json'), 'utf-8'),
) as PackageManifest;

/**
 * The production Content-Security-Policy. Injected at build time only: Vite's dev
 * server needs inline module preambles that `script-src 'self'` would forbid.
 * `blob:` in img-src is required — the share card is previewed from a canvas blob.
 */
const CSP = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "script-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    'img-src \'self\' data: blob: https://cdn.discordapp.com',
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://discord.com https://*.discord.com",
].join('; ');

function cspPlugin(isBuild: boolean): Plugin {
    return {
        name: 'gtl-csp',
        transformIndexHtml(html: string): string {
            if (!isBuild) return html;
            return html.replace(
                '<head>',
                `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
            );
        },
    };
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer | string) => {
            body += String(chunk);
        });
        req.on('end', () => {
            try {
                resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
            } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
        req.on('error', reject);
    });
}

/** Dev-only stand-in for the deployed /api/token serverless function. */
function discordTokenDevPlugin(env: Record<string, string>): Plugin {
    return {
        name: 'discord-token-dev',
        configureServer(server) {
            server.middlewares.use(
                '/api/token',
                (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
                    if (req.method !== 'POST') {
                        next();
                        return;
                    }
                    const clientId = env['VITE_DISCORD_CLIENT_ID'] ?? env['DISCORD_CLIENT_ID'];
                    const clientSecret = env['DISCORD_CLIENT_SECRET'];
                    const send = (status: number, payload: unknown): void => {
                        res.statusCode = status;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(payload));
                    };
                    if (!clientId || !clientSecret) {
                        send(500, { error: 'Discord OAuth is not configured' });
                        return;
                    }
                    void (async (): Promise<void> => {
                        try {
                            const body = await readJsonBody(req);
                            const code = typeof body['code'] === 'string' ? body['code'] : '';
                            if (!code) {
                                send(400, { error: 'Missing authorization code' });
                                return;
                            }
                            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: new URLSearchParams({
                                    client_id: clientId,
                                    client_secret: clientSecret,
                                    grant_type: 'authorization_code',
                                    code,
                                }),
                            });
                            const data: unknown = await tokenRes.json();
                            send(tokenRes.status, data);
                        } catch (err) {
                            send(500, { error: `Token exchange failed: ${String(err)}` });
                        }
                    })();
                },
            );
        },
    };
}

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, rootDir, '');
    return {
        base: './',
        publicDir: path.join(rootDir, 'public'),
        server: {
            port: Number(process.env['PORT'] ?? 5178),
            strictPort: false,
        },
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
        },
        build: {
            outDir: 'dist-web',
            emptyOutDir: true,
            target: 'es2022',
        },
        plugins: [
            solid(),
            tailwindcss(),
            cspPlugin(command === 'build'),
            discordTokenDevPlugin(env),
        ],
    };
});
