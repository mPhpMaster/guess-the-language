/**
 * Emit the runtime config scripts that index.html loads before the bundle.
 *
 * The app reads `window.SUPABASE_CONFIG` / `window.DISCORD_CONFIG` at runtime
 * rather than from baked-in constants, so one build artifact can be pointed at a
 * different Supabase project or Discord app without rebuilding.
 *
 * Two sources feed those files, in priority order:
 *
 *   1. Environment variables (VITE_SUPABASE_URL, ...). This is the only source a
 *      Vercel build has: `public/*-config.js` holds real credentials and is
 *      gitignored, so it does not exist on the build machine. Without this step
 *      a deployed build would silently come up with no leaderboard and no
 *      Discord client id.
 *   2. Whatever Vite already copied from `public/` — the local developer's
 *      credentials. Never clobbered by a blank env var.
 *
 * If neither supplies anything, a blank stub is written so the <script> tag does
 * not 404 and the app degrades cleanly to offline solo play.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, process.argv[2] || 'dist');

/** Written only when the env actually carries a value, so `public/` survives. */
function emit(file, values, body) {
  const target = path.join(outDir, file);
  const fromEnv = Object.values(values).some(Boolean);
  if (!fromEnv && fs.existsSync(target)) {
    console.log(`[config] ${file}: kept the copy from public/ (no env values set)`);
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(target, `// Auto-generated at build time — do not edit.\n${body}`, 'utf8');
  console.log(`[config] ${file}: ${fromEnv ? 'written from the environment' : 'written blank (offline mode)'}`);
}

const supabase = {
  url: process.env.VITE_SUPABASE_URL || '',
  anonKey: process.env.VITE_SUPABASE_ANON_KEY || ''
};
emit(
  'supabase-config.js',
  supabase,
  `window.SUPABASE_CONFIG = {\n  url: ${JSON.stringify(supabase.url)},\n  anonKey: ${JSON.stringify(supabase.anonKey)}\n};\n`
);

const discord = {
  clientId: process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || ''
};
// maxParticipants MUST match Activities -> Settings -> "Maximum Participants" in
// the Developer Portal; an empty field there is Discord's default of 5, not
// unlimited. presenceImage is an Art Asset key — an unknown key renders no image.
emit(
  'discord-config.js',
  discord,
  `window.DISCORD_CONFIG = {\n` +
    `  clientId: ${JSON.stringify(discord.clientId)},\n` +
    `  maxParticipants: ${Number(process.env.DISCORD_MAX_PARTICIPANTS) || 12},\n` +
    `  presenceImage: ${JSON.stringify(process.env.DISCORD_PRESENCE_IMAGE || '8-modeselect')}\n` +
    `};\n`
);
