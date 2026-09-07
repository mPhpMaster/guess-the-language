/* Weekly-challenge board: the client-side fold of daily_scores into one row per
   player. Runs the real fetchWeeklyTop() against a stubbed Supabase — no network,
   no database, plain node (ESM, because src/modules are ES modules).
     node test/smoke-weekly-board.mjs                                          */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

// Minimal browser surface: enough for the src/modules import graph to evaluate.
globalThis.window = {
    SUPABASE_CONFIG: { url: 'https://example.invalid', anonKey: 'anon-test-key' },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    innerWidth: 1200, innerHeight: 800
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = {
    documentElement: { classList: { contains: () => false, toggle() {}, add() {}, remove() {} }, style: { setProperty() {} } },
    body: { classList: { contains: () => false, toggle() {}, add() {}, remove() {} } },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });
globalThis.location = { search: '', href: 'http://localhost/', origin: 'http://localhost', pathname: '/' };

// A Thursday, so "this week" is Mon 2026-08-31 → today 2026-09-03 and the fixture
// can carry rows on both sides of that window.
const NOW = Date.UTC(2026, 8, 3, 12, 0, 0);
const RealDate = Date;
class FrozenDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(NOW); else super(...args); }
    static now() { return NOW; }
}
globalThis.Date = FrozenDate;

const ROWS = [
    // In the week. Ada played three days; day-desc, so her 09-03 avatar wins.
    { id: 9, day: '2026-09-03', player: 'Ada', score: 300, avatar: 'https://cdn/ada-new.png' },
    { id: 8, day: '2026-09-02', player: 'ada', score: 250, avatar: 'https://cdn/ada-old.png' }, // same person, different case
    { id: 7, day: '2026-09-01', player: 'Ada', score: 150, avatar: null },
    { id: 6, day: '2026-09-02', player: 'Grace', score: 500, avatar: null },
    { id: 5, day: '2026-08-31', player: 'Linus', score: 120, avatar: null }
];
// Rows the query must exclude: last week, and a day past today.
const OUT_OF_WINDOW = [
    { id: 4, day: '2026-08-30', player: 'Ada', score: 9999, avatar: null },
    { id: 3, day: '2026-09-06', player: 'Ada', score: 8888, avatar: null }
];

let requestedUrl = null;
globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    const from = (requestedUrl.match(/day=gte\.([\d-]+)/) || [])[1];
    const to = (requestedUrl.match(/day=lte\.([\d-]+)/) || [])[1];
    // Honour the filters the module actually sent, so a missing bound shows up
    // as an out-of-window row in the totals rather than passing silently.
    const rows = ROWS.concat(OUT_OF_WINDOW)
        .filter((r) => (!from || r.day >= from) && (!to || r.day <= to));
    return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
};

const api = await import(pathToFileURL(join(process.cwd(), 'src/modules/api.js')).href);

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

check('week starts on Monday', api.weekStartDateKey() === '2026-08-31', api.weekStartDateKey());

const top = await api.fetchWeeklyTop(20);
const by = Object.fromEntries(top.map((r) => [r.key, r]));

check('query is bounded at both ends',
    /day=gte\.2026-08-31/.test(requestedUrl) && /day=lte\.2026-09-03/.test(requestedUrl), requestedUrl);
check('one row per player', top.length === 3, top.length);
check('a player\'s days are summed', by.ada?.score === 700, by.ada?.score);
check('days played are counted', by.ada?.days === 3, by.ada?.days);
check('names fold case-insensitively', by.ada?.player === 'Ada', by.ada?.player);
check('most recent avatar wins', by.ada?.avatar === 'https://cdn/ada-new.png', by.ada?.avatar);
check('sorted by weekly total', top.map((r) => r.key).join(',') === 'ada,grace,linus', top.map((r) => r.key).join(','));
check('last week is excluded', by.ada?.score !== 9999 && !top.some((r) => r.score >= 8888), by.ada?.score);
check('limit is honoured', (await api.fetchWeeklyTop(2)).length === 2);

globalThis.Date = RealDate;

console.log('\n==== WEEKLY CHALLENGE BOARD ====');
checks.forEach((c) => console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass || c.detail === undefined ? '' : `  (got ${JSON.stringify(c.detail)})`}`));
const passed = checks.filter((c) => c.pass).length;
console.log(`==== ${passed}/${checks.length} passed ====`);
process.exit(passed === checks.length ? 0 : 1);
