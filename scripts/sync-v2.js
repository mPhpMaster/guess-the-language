/**
 * Rebuilds the SolidJS rewrite and copies its output into public/v2.
 *
 * The rewrite lives in its own repository (../prog-game-solid). Vercel builds only
 * THIS project, so what actually ships at /v2/ is the committed contents of
 * public/v2 — run this script whenever the rewrite changes, then commit the result.
 *
 * Usage: node scripts/sync-v2.js   (or: npm run sync:v2)
 */
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, rmSync, mkdirSync, cpSync } = require('node:fs');
const path = require('node:path');

const SOURCE_REPO = process.env.GTL_V2_SOURCE
  || path.resolve(__dirname, '..', '..', 'prog-game-solid');
const BUILD_OUTPUT = path.join(SOURCE_REPO, 'dist-web');
const TARGET = path.resolve(__dirname, '..', 'public', 'v2');

if (!existsSync(SOURCE_REPO)) {
  console.error(`Rewrite source not found at ${SOURCE_REPO}.`);
  console.error('Set GTL_V2_SOURCE to its path, or skip this script — public/v2 is already committed.');
  process.exit(1);
}

console.log(`Building the rewrite in ${SOURCE_REPO} …`);
execFileSync('pnpm', ['run', 'build'], { cwd: SOURCE_REPO, stdio: 'inherit', shell: true });

if (!existsSync(BUILD_OUTPUT)) {
  console.error(`Build finished but ${BUILD_OUTPUT} is missing.`);
  process.exit(1);
}

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });
cpSync(BUILD_OUTPUT, TARGET, { recursive: true });

console.log(`Copied ${BUILD_OUTPUT} -> ${TARGET}`);
console.log('Remember to commit public/v2 — that is what Vercel serves at /v2/.');
