import {
    QUESTION_BANKS,
    type BankedQuestion,
    type GameMode,
    type QuestionBank,
    type RawQuestion,
} from '../types/models';

/* ============================================================
   Question bank loading.

   The banks are bundled as code-split chunks (rather than fetched) so the same
   loader works on the web, inside the Discord iframe, and from Electron's
   file:// origin, where fetch() of a local JSON path is blocked.
   ============================================================ */

const BANK_FILES: Readonly<Record<QuestionBank, string>> = {
    languages: '../data/questions.json',
    cybersecurity: '../data/questions-cyber.json',
    devops: '../data/questions-devops.json',
    network: '../data/questions-network.json',
    gamedev: '../data/questions-gamedev.json',
    algorithms: '../data/questions-algo.json',
};

const modules: Readonly<Record<string, () => Promise<unknown>>> = import.meta.glob(
    '../data/*.json',
);

const cache = new Map<QuestionBank, readonly BankedQuestion[]>();

function isQuestionBank(mode: GameMode): mode is QuestionBank {
    return (QUESTION_BANKS as readonly string[]).includes(mode);
}

async function loadBank(bank: QuestionBank): Promise<readonly BankedQuestion[]> {
    const cached = cache.get(bank);
    if (cached) return cached;

    const key = BANK_FILES[bank];
    const loader = modules[key];
    if (!loader) throw new Error(`Unknown question bank: ${bank}`);

    const mod = (await loader()) as { default?: unknown };
    const rows = Array.isArray(mod.default) ? (mod.default as readonly RawQuestion[]) : [];
    const tagged: readonly BankedQuestion[] = rows.map((q) => ({ ...q, bank }));
    cache.set(bank, tagged);
    return tagged;
}

export async function loadQuestions(mode: GameMode): Promise<readonly BankedQuestion[]> {
    if (isQuestionBank(mode)) return loadBank(mode);
    const banks = await Promise.all(QUESTION_BANKS.map((bank) => loadBank(bank)));
    return banks.flat();
}

export async function totalQuestionCount(): Promise<number> {
    const all = await loadQuestions('all');
    return all.length;
}
