/**
 * Build the renderer for Electron.
 *
 * The desktop shell loads the build from disk over file://, where absolute asset
 * paths ("/assets/…") resolve against the filesystem root and 404. Setting
 * GTL_BASE makes Vite emit relative URLs instead. Web and the Discord Activity
 * keep the default "/" base, so this is a separate build rather than a flag on
 * the normal one.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const result = spawnSync(process.execPath, [vite, 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, GTL_BASE: './' }
});

process.exit(result.status ?? 1);
