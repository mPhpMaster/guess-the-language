import { normFill } from '$lib/game/round';
import type { RawQuestion } from '$lib/game/types';
import type { AnswerKey, RoomSettings, RoundRef } from './types';

/**
 * Deterministic shuffle shared by every client in a room.
 *
 * Deliberately NOT the single-player `mulberry32` — the server and the existing
 * clients agree on this LCG, so changing it would desynchronize option order
 * between an old client and a new one in the same room.
 */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = arr.slice();
  let s = (Number(seed) >>> 0) || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function timeForDifficulty(d: string): number {
  return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
}

/**
 * Seeded, fair-across-banks deal — the multiplayer twin of `sampleAcrossBanks`.
 * One slot per bank before any bank repeats, so an "All" room isn't dominated by
 * `languages` (over half the pool).
 */
function sampleAcrossBanks(pool: readonly RawQuestion[], count: number, seed: number): RawQuestion[] {
  const byBank = new Map<string, RawQuestion[]>();
  for (const q of pool) {
    const bank = q.bank ?? 'languages';
    const list = byBank.get(bank);
    if (list) list.push(q);
    else byBank.set(bank, [q]);
  }
  if (byBank.size < 2) return seededShuffle(pool, seed).slice(0, count);

  const queues = seededShuffle(Array.from(byBank.values()), seed).map((qs, i) =>
    seededShuffle(qs, (seed ^ ((i + 1) * 0x9e3779b9)) >>> 0)
  );

  const picked: RawQuestion[] = [];
  for (let depth = 0; picked.length < count; depth++) {
    let dealt = false;
    for (const queue of queues) {
      if (depth >= queue.length) continue;
      picked.push(queue[depth]!);
      dealt = true;
      if (picked.length === count) break;
    }
    if (!dealt) break;
  }
  return picked;
}

export interface BuiltRoom {
  roundRefs: RoundRef[];
  answerKeys: AnswerKey[];
  round: RawQuestion[];
}

/**
 * The host builds the round once and publishes refs + answer keys; the server
 * scores against the keys and every client resolves the refs locally.
 */
export function buildRoundForRoom(
  allQuestions: readonly RawQuestion[],
  settings: RoomSettings & { mode?: string },
  now: number = Date.now()
): BuiltRoom {
  let pool = allQuestions.slice();
  if (settings.mode && settings.mode !== 'all') {
    pool = pool.filter((q) => (q.bank ?? 'languages') === settings.mode);
  }
  if (pool.length === 0) pool = allQuestions.slice();
  if (settings.difficulty && settings.difficulty !== 'all') {
    const byDiff = pool.filter((q) => q.difficulty === settings.difficulty);
    if (byDiff.length) pool = byDiff;
  }
  if (pool.length === 0) pool = allQuestions.slice();

  const seed = (now & 0xffffffff) || 1;
  const count = Math.min(settings.questions, pool.length);
  const round = sampleAcrossBanks(pool, count, seed);

  const roundRefs: RoundRef[] = [];
  const answerKeys: AnswerKey[] = [];
  const fixedTimer = settings.timer && settings.timer !== 'auto' ? Number(settings.timer) : null;

  round.forEach((q, index) => {
    const bank = q.bank ?? 'languages';
    const optionSeed = ((now + index * 9973) & 0xffffffff) || 1;
    roundRefs.push({ bank, id: q.id, optionSeed, duration: fixedTimer || timeForDifficulty(q.difficulty) });

    const isCyber = Array.isArray(q.options) && q.answer != null;
    const isFill = !isCyber && q.answer != null && !q.correctLanguage;
    // Fill answers are normalized so the server's exact-match scoring lines up
    // with what the client submits.
    const answer = isFill ? normFill(q.answer) : isCyber ? q.answer! : q.correctLanguage!;
    answerKeys.push({ index, answer });
  });

  return { roundRefs, answerKeys, round };
}

export function resolveQuestion(ref: RoundRef, allQuestions: readonly RawQuestion[]): RawQuestion | null {
  return allQuestions.find((q) => (q.bank ?? 'languages') === ref.bank && q.id === ref.id) ?? null;
}

export function normalizeCode(code: unknown): string {
  return String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function remainingSeconds(endsAt: string | null | undefined): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
}
