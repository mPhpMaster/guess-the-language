import { safeDisplayName } from '$lib/game/names';
import { modeMeta } from '$lib/game/modes';
import type { DifficultyFilter, ModeId } from '$lib/game/types';
import { isModeId } from '$lib/game/constants';
import { i18n } from '$lib/i18n/index.svelte';
import { discordAvatarUrl, discordProfile } from './discord.svelte';
import { supabaseConfig, supabaseConfigured } from './supabase';

/** Public origin used for challenge links and the card footer. */
export const GAME_PUBLIC_URL = 'https://guess-the-language-chi.vercel.app';

// ---------- share card ----------

export interface ShareCardInput {
  score: number;
  correct: number;
  total: number;
  player: string;
  daily: boolean;
  mode: ModeId;
}

/**
 * Load an image for canvas compositing. `crossOrigin` lets the pixels be read
 * back without tainting the canvas (which would make `toBlob` throw); resolves
 * null on any failure so the card falls back to the trophy.
 */
function loadCrossOriginImage(src: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Render the 1080x1350 result card. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob | null> {
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0e2a44');
  g.addColorStop(1, '#081019');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(46,197,255,0.10)';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.14, 340, 0, Math.PI * 2);
  ctx.fill();

  const cx = w / 2;
  const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';

  ctx.fillStyle = '#8ea6c0';
  ctx.font = `600 42px ${FONT}`;
  ctx.fillText('GUESS THE LANGUAGE', cx, 150);

  ctx.fillStyle = '#2ec5ff';
  ctx.font = `800 56px ${FONT}`;
  const heading = input.daily ? i18n.t('dailyChallenge') : modeMeta(input.mode).title[i18n.lang].join(' ');
  ctx.fillText(heading, cx, 250);

  // The player's Discord photo as a circular badge, with the trophy as fallback
  // when there is no avatar or it would taint the canvas.
  const avatar = await loadCrossOriginImage(discordAvatarUrl(discordProfile(), 256));
  if (avatar) {
    const r = 108;
    const ay = 430;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, ay, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#2ec5ff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, ay, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, cx - r, ay - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.font = '150px serif';
    ctx.fillText('🏆', cx, 470);
  }

  ctx.fillStyle = '#eaf4ff';
  ctx.font = `900 200px ${FONT}`;
  ctx.fillText(String(input.score), cx, 720);
  ctx.fillStyle = '#8ea6c0';
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText('SCORE', cx, 792);

  const total = input.total || 1;
  const acc = Math.round((input.correct / total) * 100);
  ctx.fillStyle = '#19f0c4';
  ctx.font = `800 62px ${FONT}`;
  ctx.fillText(`${acc}%   ·   ${input.correct}/${total}`, cx, 930);

  ctx.fillStyle = '#cfe0f4';
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(safeDisplayName(input.player, i18n.t('hiddenPlayer')) || 'Player', cx, 1130);

  ctx.fillStyle = '#5f7590';
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText('guess-the-language-chi.vercel.app', cx, 1275);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Upload the card to the public bucket and return its URL.
 *
 * This exists because Discord's iframe blocks both clipboard-image writes and
 * downloads — inside the Activity the only workable share is a link, so the card
 * has to live somewhere fetchable.
 */
export async function uploadShareCard(blob: Blob | null): Promise<string | null> {
  const cfg = supabaseConfig();
  if (!cfg || !blob) return null;
  const name = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const res = await fetch(`${cfg.url}/storage/v1/object/share-cards/${name}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'image/png' },
    body: blob
  });
  if (!res.ok) return null;
  return `${cfg.url}/storage/v1/object/public/share-cards/${name}`;
}

export function shareUploadAvailable(): boolean {
  return supabaseConfigured();
}

// ---------- challenge links ----------

export interface Challenge {
  mode: ModeId | null;
  questions: number | null;
  difficulty: DifficultyFilter | null;
  score: number | null;
}

export function buildChallengePayload(input: {
  mode: ModeId;
  difficulty: DifficultyFilter;
  questions: number;
  score: number;
}): string {
  return [
    `m=${input.mode}`,
    `d=${input.difficulty}`,
    `q=${input.questions}`,
    `s=${Math.max(0, input.score | 0)}`
  ].join('&');
}

/** Parse a challenge payload back. Returns null when it carries nothing usable. */
export function parseChallengePayload(raw: unknown): Challenge | null {
  if (!raw || typeof raw !== 'string') return null;
  const out: Record<string, string> = {};
  for (const kv of raw.split('&')) {
    const [k, v] = kv.split('=');
    if (k && v != null) out[k] = v;
  }
  const mode = out.m && isModeId(out.m) ? out.m : null;
  const questions = [5, 10, 15, 20].includes(Number(out.q)) ? Number(out.q) : null;
  const difficulty = (['all', 'easy', 'medium', 'hard'] as const).includes(
    out.d as DifficultyFilter
  )
    ? (out.d as DifficultyFilter)
    : null;
  const score = Number.isFinite(Number(out.s)) ? Math.max(0, Number(out.s) | 0) : null;
  if (!mode && score == null) return null;
  return { mode, questions, difficulty, score };
}

export function getChallengeFromUrl(): Challenge | null {
  try {
    const p = new URLSearchParams(location.search).get('challenge');
    return p ? parseChallengePayload(decodeURIComponent(p)) : null;
  } catch {
    return null;
  }
}

export function buildChallengeUrl(payload: string): string {
  return `${GAME_PUBLIC_URL}/?challenge=${encodeURIComponent(payload)}`;
}
