import type { Bank, ModeId, RawQuestion } from '$lib/game/types';

/**
 * Question-bank loading.
 *
 * The banks stay as static JSON under `public/data` rather than being imported
 * into the bundle: together they are ~520 KB, and a single-bank round should not
 * pay for the other five. Each bank is fetched at most once per session.
 */

const QUESTION_FILES: Record<Bank, string> = {
  languages: 'questions.json',
  cybersecurity: 'questions-cyber.json',
  devops: 'questions-devops.json',
  network: 'questions-network.json',
  gamedev: 'questions-gamedev.json',
  algorithms: 'questions-algo.json'
};

const BANKS = Object.keys(QUESTION_FILES) as Bank[];

const cache = new Map<Bank, Promise<RawQuestion[]>>();

async function readBank(bank: Bank): Promise<RawQuestion[]> {
  const file = QUESTION_FILES[bank];
  // Relative so the same build works from a domain root, a subpath and file://.
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  const parsed = (await res.json()) as RawQuestion[];
  // Tag each row with the bank it came from — the mixed round needs it to
  // balance across banks, and the normalizer uses it as the fallback bank.
  return parsed.map((q) => ({ ...q, bank }));
}

function loadBank(bank: Bank): Promise<RawQuestion[]> {
  let pending = cache.get(bank);
  if (!pending) {
    pending = readBank(bank).catch((err) => {
      cache.delete(bank); // let a later attempt retry rather than caching the failure
      throw err;
    });
    cache.set(bank, pending);
  }
  return pending;
}

export async function getQuestions(mode: ModeId): Promise<RawQuestion[]> {
  if (mode === 'all') {
    const banks = await Promise.all(BANKS.map(loadBank));
    return banks.flat();
  }
  return loadBank(BANKS.includes(mode) ? mode : 'languages');
}

/** Total question count across every bank — shown on the About panel. */
export async function totalQuestionCount(): Promise<number> {
  const banks = await Promise.all(BANKS.map(loadBank));
  return banks.reduce((sum, b) => sum + b.length, 0);
}
