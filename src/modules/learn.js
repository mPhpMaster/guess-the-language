import { recordPlay } from './api.js';
import { $, announce, setTitlebar, showScreen } from './dom.js';
import { setRichText } from './game.js';
import { highlight } from './highlight.js';
import { t, uiLang } from './i18n.js';
import { renderHome } from './home.js';
import { sfx } from './sound.js';
import { state } from './state.js';

// ============================================================
//  Learn — courses made of levels. Each level is a few short lessons followed
//  by a 10-question test. The lessons can be skipped; the test cannot be
//  skipped to move on: a level opens only once the test before it is passed.
//
//  Content lives in src/data/courses/<id>.json (bilingual en/ar), loaded through
//  gameAPI.getCourse (fetch on the web, IPC in Electron). Progress is per device,
//  in localStorage — it is a study tool, not a leaderboard.
// ============================================================
export const COURSES = [
    { id: 'fastapi', icon: '⚡' }
];
export const PASS_PCT = 70;
const PROGRESS_KEY = 'gtl_learn';

const ui = {
    course: null,     // loaded course JSON
    levelIdx: 0,
    lessonIdx: 0,
    quiz: null        // { qs, i, correct, answered, misses, order }
};
const cache = new Map();

// ---------- text ----------
function L(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[uiLang()] ?? obj.en ?? '';
}
function listOf(block) {
    const v = block[uiLang()];
    return Array.isArray(v) ? v : (block.en || []);
}
function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) setRichText(e, text);
    return e;
}
function btn(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}

// ---------- progress ----------
export function loadProgress() {
    try {
        const v = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        return v && typeof v === 'object' ? v : {};
    } catch (_) { return {}; }
}
function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) { /* best-effort */ }
}
function courseProgress(courseId) {
    const p = loadProgress();
    const c = p[courseId] || {};
    return { best: c.best || {}, read: c.read || {} };
}
function updateCourseProgress(courseId, fn) {
    const p = loadProgress();
    const c = p[courseId] || { best: {}, read: {} };
    c.best = c.best || {};
    c.read = c.read || {};
    fn(c);
    p[courseId] = c;
    saveProgress(p);
}
export function isLevelPassed(courseId, levelId) {
    return (courseProgress(courseId).best[levelId] || 0) >= PASS_PCT;
}
// The first level is always open; every other one opens when the one before it
// has been passed.
export function isLevelUnlocked(course, idx) {
    if (idx <= 0) return true;
    return isLevelPassed(course.id, course.levels[idx - 1].id);
}

// ---------- loading ----------
async function getCourse(id) {
    if (cache.has(id)) return cache.get(id);
    const c = await window.gameAPI.getCourse(id);
    cache.set(id, c);
    return c;
}

// ---------- navigation ----------
export async function openLearn() {
    showScreen('learn');
    renderCourseList();
}

function setCrumbs(parts) {
    const box = $('#learn-crumbs');
    if (!box) return;
    box.textContent = '';
    parts.forEach((p, i) => {
        if (i) box.appendChild(el('span', 'learn-crumb-sep', '/'));
        if (p.onClick) {
            const a = document.createElement('button');
            a.type = 'button';
            a.className = 'learn-crumb';
            a.textContent = p.label;
            a.addEventListener('click', p.onClick);
            box.appendChild(a);
        } else {
            box.appendChild(el('span', 'learn-crumb is-current', p.label));
        }
    });
    setTitlebar(`learn — ${parts.map((p) => p.label).join(' / ').toLowerCase()}`);
}

function body() {
    ui.quiz = null; // any view change leaves a test behind
    const b = $('#learn-body');
    b.textContent = '';
    // The screen itself is the scroller; every new view starts at its top.
    const scr = $('#screen-learn');
    if (scr) scr.scrollTop = 0;
    return b;
}

// The header's back button always goes one step up.
let backAction = () => { showScreen('home'); renderHome(); };
export function learnBack() { backAction(); }

// ---------- course list ----------
export async function renderCourseList() {
    backAction = () => { showScreen('home'); renderHome(); };
    setCrumbs([{ label: t('learnTitle') }]);
    const b = body();
    b.appendChild(el('h2', 'learn-h1 screen-heading', t('learnTitle')));
    b.appendChild(el('p', 'learn-sub', t('learnSubtitle')));
    const grid = el('div', 'learn-courses');
    b.appendChild(grid);
    for (const meta of COURSES) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'learn-course-card';
        grid.appendChild(card);
        try {
            const c = await getCourse(meta.id);
            const passed = c.levels.filter((lv) => isLevelPassed(c.id, lv.id)).length;
            card.append(
                el('span', 'learn-course-icon', meta.icon),
                el('strong', 'learn-course-title', L(c.title)),
                el('span', 'learn-course-desc', L(c.summary)),
                el('span', 'learn-course-progress', t('learnCourseProgress').replace('{n}', String(passed)).replace('{total}', String(c.levels.length)))
            );
            const bar = el('span', 'learn-bar');
            const fill = el('span', 'learn-bar-fill');
            fill.style.width = `${Math.round((passed / c.levels.length) * 100)}%`;
            bar.appendChild(fill);
            card.appendChild(bar);
            card.addEventListener('click', () => openCourse(c.id));
        } catch (e) {
            card.disabled = true;
            card.append(el('strong', 'learn-course-title', meta.id), el('span', 'learn-course-desc', t('loadFail')));
        }
    }
}

// ---------- course overview ----------
export async function openCourse(id) {
    showScreen('learn');
    try { ui.course = await getCourse(id); } catch (_) { announce(t('loadFail')); return; }
    renderCourse();
}

function renderCourse() {
    const c = ui.course;
    backAction = renderCourseList;
    setCrumbs([{ label: t('learnTitle'), onClick: renderCourseList }, { label: L(c.title) }]);
    const b = body();
    b.appendChild(el('h2', 'learn-h1 screen-heading', L(c.title)));
    b.appendChild(el('p', 'learn-sub', L(c.summary)));
    b.appendChild(el('p', 'learn-passmark', t('learnPassMark').replace('{pct}', String(PASS_PCT))));
    const prog = courseProgress(c.id);
    const list = el('ol', 'learn-levels');
    b.appendChild(list);
    c.levels.forEach((lv, i) => {
        const unlocked = isLevelUnlocked(c, i);
        const best = prog.best[lv.id];
        const passed = (best || 0) >= PASS_PCT;
        const li = el('li', 'learn-level' + (passed ? ' is-passed' : '') + (unlocked ? '' : ' is-locked'));
        const num = el('span', 'learn-level-num', passed ? '✓' : unlocked ? String(i + 1).padStart(2, '0') : '🔒');
        const main = el('div', 'learn-level-main');
        main.appendChild(el('strong', 'learn-level-title', L(lv.title)));
        main.appendChild(el('span', 'learn-level-summary', L(lv.summary)));
        const read = lv.lessons.filter((ls) => prog.read[`${lv.id}/${ls.id}`]).length;
        const meta = [t('learnLessonsCount').replace('{read}', String(read)).replace('{n}', String(lv.lessons.length))];
        if (best != null) meta.push(t('learnBest').replace('{pct}', String(best)));
        main.appendChild(el('span', 'learn-level-meta', meta.join(' · ')));
        const acts = el('div', 'learn-level-acts');
        if (unlocked) {
            acts.append(
                btn(t('learnLessons'), 'btn-ghost btn-sm', () => openLesson(i, 0)),
                btn(t('learnTest'), passed ? 'btn-ghost btn-sm' : 'btn-primary btn-sm', () => startLevelQuiz(i))
            );
        } else {
            acts.appendChild(el('span', 'learn-locked-hint', t('learnLockedHint').replace('{n}', String(i))));
        }
        main.appendChild(acts);
        li.append(num, main);
        list.appendChild(li);
    });
    if (c.levels.every((lv) => isLevelPassed(c.id, lv.id))) {
        b.appendChild(el('p', 'learn-done', t('learnAllDone')));
    }
}

// A raw HTTP message (request or response line first) is shown as plain text.
function codeBlock(src, lang) {
    const pre = document.createElement('pre');
    pre.className = 'learn-code';
    pre.setAttribute('dir', 'ltr');
    if (lang) pre.dataset.lang = lang;
    const code = document.createElement('code');
    const text = String(src || '');
    const plain = lang === 'http' || lang === 'text' ||
        /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S+ HTTP\/|^HTTP\/\d/m.test(text);
    if (plain) code.textContent = text;
    else code.innerHTML = highlight(text);
    pre.appendChild(code);
    return pre;
}

// ---------- lessons ----------
export function openLesson(levelIdx, lessonIdx) {
    ui.levelIdx = levelIdx;
    ui.lessonIdx = lessonIdx;
    renderLesson();
}

function renderBlock(block) {
    switch (block.type) {
        case 'h': return el('h4', 'learn-block-h', L(block));
        case 'list': {
            const ul = el('ul', 'learn-block-list');
            listOf(block).forEach((item) => ul.appendChild(el('li', null, item)));
            return ul;
        }
        case 'code': return codeBlock(block.code, block.lang);
        case 'tip': return el('p', 'learn-callout learn-tip', L(block));
        case 'warn': return el('p', 'learn-callout learn-warn', L(block));
        default: return el('p', 'learn-p', L(block));
    }
}

function renderLesson() {
    const c = ui.course;
    const lv = c.levels[ui.levelIdx];
    const ls = lv.lessons[ui.lessonIdx];
    backAction = renderCourse;
    setCrumbs([
        { label: t('learnTitle'), onClick: renderCourseList },
        { label: L(c.title), onClick: renderCourse },
        { label: L(lv.title) }
    ]);
    updateCourseProgress(c.id, (p) => { p.read[`${lv.id}/${ls.id}`] = 1; });

    const b = body();
    const dots = el('div', 'learn-dots');
    lv.lessons.forEach((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'learn-dot' + (i === ui.lessonIdx ? ' is-active' : '');
        d.setAttribute('aria-label', `${i + 1}`);
        d.addEventListener('click', () => openLesson(ui.levelIdx, i));
        dots.appendChild(d);
    });
    b.appendChild(dots);
    b.appendChild(el('p', 'learn-kicker', t('learnLessonOf').replace('{i}', String(ui.lessonIdx + 1)).replace('{n}', String(lv.lessons.length))));
    b.appendChild(el('h2', 'learn-h1 screen-heading', L(ls.title)));
    const article = el('article', 'learn-lesson');
    (ls.blocks || []).forEach((blk) => article.appendChild(renderBlock(blk)));
    b.appendChild(article);

    const nav = el('div', 'learn-nav');
    const prev = btn(t('learnPrev'), 'btn-ghost', () => openLesson(ui.levelIdx, ui.lessonIdx - 1));
    prev.disabled = ui.lessonIdx === 0;
    const last = ui.lessonIdx >= lv.lessons.length - 1;
    const next = last
        ? btn(t('learnTakeTest'), 'btn-primary', () => startLevelQuiz(ui.levelIdx))
        : btn(t('learnNext'), 'btn-primary', () => openLesson(ui.levelIdx, ui.lessonIdx + 1));
    nav.append(prev, next);
    if (!last) nav.appendChild(btn(t('learnSkipToTest'), 'btn-ghost learn-skip', () => startLevelQuiz(ui.levelIdx)));
    b.appendChild(nav);
}

// ---------- quiz ----------
function shuffled(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function startLevelQuiz(levelIdx) {
    const c = ui.course;
    if (!isLevelUnlocked(c, levelIdx)) return;
    ui.levelIdx = levelIdx;
    const lv = c.levels[levelIdx];
    // Question order and option order are shuffled per attempt, so a retry is
    // not answered by position memory.
    const qs = shuffled(lv.quiz.length).map((qi) => {
        const q = lv.quiz[qi];
        return { q, order: shuffled(q.options.length) };
    });
    ui.quiz = { qs, i: 0, correct: 0, answered: false, misses: [], startedAt: Date.now() };
    renderQuestion();
}

function renderQuestion() {
    const c = ui.course;
    const lv = c.levels[ui.levelIdx];
    const z = ui.quiz;
    const { q, order } = z.qs[z.i];
    z.answered = false;
    backAction = renderCourse;
    setCrumbs([
        { label: t('learnTitle'), onClick: renderCourseList },
        { label: L(c.title), onClick: renderCourse },
        { label: `${L(lv.title)} — ${t('learnTest')}` }
    ]);
    const b = body();
    ui.quiz = z; // body() clears it; this view is the test
    const head = el('div', 'learn-quiz-head');
    head.append(
        el('span', 'learn-kicker', t('learnQuestionOf').replace('{i}', String(z.i + 1)).replace('{n}', String(z.qs.length))),
        el('span', 'learn-score', `✓ ${z.correct}`)
    );
    b.appendChild(head);
    const bar = el('div', 'learn-bar');
    const fill = el('span', 'learn-bar-fill');
    fill.style.width = `${Math.round((z.i / z.qs.length) * 100)}%`;
    bar.appendChild(fill);
    b.appendChild(bar);

    if (q.codeSnippet) {
        b.appendChild(codeBlock(q.codeSnippet));
    }
    b.appendChild(el('h3', 'learn-question screen-heading', L(q.question)));

    const opts = el('div', 'learn-options');
    order.forEach((oi, pos) => {
        const o = document.createElement('button');
        o.type = 'button';
        o.className = 'opt-btn learn-opt';
        o.dataset.index = String(oi);
        const key = el('span', 'opt-key');
        key.textContent = String(pos + 1);
        key.setAttribute('aria-hidden', 'true');
        o.append(key, el('span', 'opt-text', L(q.options[oi])));
        o.addEventListener('click', () => answerQuestion(oi));
        opts.appendChild(o);
    });
    b.appendChild(opts);
    b.appendChild(el('div', 'learn-feedback hidden'));
}

function answerQuestion(chosen) {
    const z = ui.quiz;
    if (!z || z.answered) return;
    z.answered = true;
    const { q } = z.qs[z.i];
    const ok = chosen === q.answer;
    if (ok) { z.correct += 1; try { sfx.correct(); } catch (_) {} }
    else { z.misses.push({ q, chosen }); try { sfx.wrong(); } catch (_) {} }
    document.querySelectorAll('.learn-opt').forEach((o) => {
        const idx = Number(o.dataset.index);
        o.disabled = true;
        if (idx === q.answer) o.classList.add('correct');
        else if (idx === chosen) o.classList.add('wrong');
    });
    const fb = $('.learn-feedback');
    fb.classList.remove('hidden');
    fb.classList.toggle('is-good', ok);
    fb.classList.toggle('is-bad', !ok);
    fb.textContent = '';
    fb.appendChild(el('strong', 'learn-fb-head', ok ? t('learnCorrect') : t('learnWrong')));
    fb.appendChild(el('p', 'learn-fb-why', L(q.explanation)));
    const last = z.i >= z.qs.length - 1;
    const next = btn(last ? t('learnFinish') : t('learnNextQ'), 'btn-primary btn-sm', () => {
        if (last) finishQuiz();
        else { z.i += 1; renderQuestion(); }
    });
    fb.appendChild(next);
    announce(`${ok ? t('learnCorrect') : t('learnWrong')} ${L(q.explanation)}`);
    requestAnimationFrame(() => next.focus());
}

function finishQuiz() {
    const c = ui.course;
    const lv = c.levels[ui.levelIdx];
    const z = ui.quiz;
    const pct = Math.round((z.correct / z.qs.length) * 100);
    const passed = pct >= PASS_PCT;
    const wasPassed = isLevelPassed(c.id, lv.id);
    updateCourseProgress(c.id, (p) => { p.best[lv.id] = Math.max(p.best[lv.id] || 0, pct); });
    // XP the first time a level is passed — a reward for learning, not farmable
    // by retaking a test already passed.
    if (passed && !wasPassed) {
        state.gameStartMs = z.startedAt;
        recordPlay(false, false, z.correct * 100, z.correct === z.qs.length);
    }
    try { sfx.finish(); } catch (_) {}

    const unlockedNext = passed && !wasPassed && ui.levelIdx < c.levels.length - 1;
    backAction = renderCourse;
    const b = body();
    b.appendChild(el('p', 'learn-kicker', `${L(lv.title)} — ${t('learnTest')}`));
    b.appendChild(el('h2', 'learn-h1 learn-result-score screen-heading', `${z.correct} / ${z.qs.length} · ${pct}%`));
    b.appendChild(el('p', 'learn-verdict ' + (passed ? 'is-good' : 'is-bad'),
        passed ? t('learnResultPass') : t('learnResultFail').replace('{pct}', String(PASS_PCT))));
    if (unlockedNext) {
        b.appendChild(el('p', 'learn-unlocked', t('learnUnlocked').replace('{name}', L(c.levels[ui.levelIdx + 1].title))));
    }
    const acts = el('div', 'learn-nav');
    if (passed && ui.levelIdx < c.levels.length - 1) {
        acts.appendChild(btn(t('learnNextLevel'), 'btn-primary', () => openLesson(ui.levelIdx + 1, 0)));
    }
    acts.appendChild(btn(t('learnRetry'), passed ? 'btn-ghost' : 'btn-primary', () => startLevelQuiz(ui.levelIdx)));
    acts.appendChild(btn(t('learnReview'), 'btn-ghost', () => openLesson(ui.levelIdx, 0)));
    acts.appendChild(btn(t('learnBackToCourse'), 'btn-ghost', renderCourse));
    b.appendChild(acts);

    if (z.misses.length) {
        b.appendChild(el('h4', 'learn-block-h', t('learnMissed').replace('{n}', String(z.misses.length))));
        z.misses.forEach(({ q, chosen }) => {
            const card = el('div', 'learn-miss');
            card.appendChild(el('strong', null, L(q.question)));
            if (q.codeSnippet) {
                card.appendChild(codeBlock(q.codeSnippet));
            }
            card.appendChild(el('p', 'learn-miss-you', `${t('learnYouPicked')} ${L(q.options[chosen])}`));
            card.appendChild(el('p', 'learn-miss-answer', `${t('learnAnswerWas')} ${L(q.options[q.answer])}`));
            card.appendChild(el('p', 'learn-miss-why', L(q.explanation)));
            b.appendChild(card);
        });
    }
}

// Keyboard: 1–4 answer, Enter continues.
export function onLearnKeydown(e) {
    if (!$('#screen-learn')?.classList.contains('active')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!ui.quiz || ui.quiz.answered) return;
    if (e.key >= '1' && e.key <= '4') {
        const btns = document.querySelectorAll('.learn-opt');
        const b = btns[Number(e.key) - 1];
        if (b) { e.preventDefault(); b.click(); }
    }
}
