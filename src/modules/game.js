import { OPTION_COLORS, RING_CIRCUMFERENCE } from './constants.js';
import { $, announce, setTitlebar, showScreen } from './dom.js';
import { highlight } from './highlight.js';
import { diffLabel, t } from './i18n.js';
import { getSettings, updateInGameProfile } from './identity.js';
import { modeLabel, syncMpHudFromPlayers } from './mp-ui.js';
import { markPresenceRoundStart, pushPresence } from './presence.js';
import { endGame } from './results.js';
import { buildLanguageOptions, buildRound, bumpAdaptive, maybeSetupAdaptive, pickAdaptiveQuestion, resolvedQuestionTime, scoreAnswer, shuffle, shuffleOptions } from './round.js';
import { ensureValidPlayerName, requireNameToInteract } from './settings.js';
import { sfx } from './sound.js';
import { state } from './state.js';

// Shared round bootstrap used by both a normal game and the daily challenge.
export function beginRound() {
    state.index = 0;
    state.score = 0;
    state.correct = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.roundHistory = [];
    state.viewOnly = false;
    state.selectedAnswer = null;
    state.gameStartMs = Date.now();
    state.lifelines = 2; // two 50:50s per round
    updateScore();
    updateCorrect();
    updateStreakPill();
    updateFiftyButton();
    $('#q-total').textContent = String(state.round.length);
    $('#correct-total').textContent = String(state.round.length);
    updateInGameProfile();
    // The "you've been challenged" banner belongs on Home only — clear it once play
    // starts (the win/lose verdict shows on the results screen instead).
    $('#challenge-banner')?.classList.add('hidden');
    // Same for the first-run welcome: it is shown 500ms after boot and nothing
    // took it down, so starting a round left it floating over the question.
    document.getElementById('onboarding')?.classList.remove('show');
    showScreen('game');
    markPresenceRoundStart();
    nextQuestion();
}

// ============================================================
//  Game flow
// ============================================================
export async function startGame() {
    // On the web build you must sign in with Discord first (this kicks off the
    // flow); the button is also disabled, so this is mostly a safety net.
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) {
        announce(nameCheck.message || t('nameRequired'));
        return;
    }

    buildRound();
    state.daily = false;
    state.learn = false;
    maybeSetupAdaptive();
    beginRound();
}

// Practice mode: same questions, no timer, no scoring/leaderboard — just learn.
export async function startPractice() {
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) { announce(nameCheck.message || t('nameRequired')); return; }
    buildRound();
    state.daily = false;
    state.learn = true;
    maybeSetupAdaptive();
    beginRound();
}

// Normalise a typed fill-in answer so grading ignores case and spacing.
export function normFill(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Grade a fill-in-the-blank answer. Single-player also accepts the question's
// `accept` variants; multiplayer uses canonical-only so it matches the server.
export function isFillCorrect(cur, typed, canonicalOnly) {
    const n = normFill(typed);
    if (!n) return false;
    if (n === normFill(cur.answer)) return true;
    if (canonicalOnly) return false;
    return (cur.accept || []).some((a) => normFill(a) === n);
}

// Turn a raw question into a uniform shape for rendering. The type is detected
// per-question (by its fields) so the "All" mode can mix all kinds in a round:
//   languages -> pick a language button; cyber -> multiple choice;
//   fill -> type the missing code (a ____ blank + a typed answer).
export function normalizeQuestion(q, opts) {
    const optionSeed = opts && opts.optionSeed != null ? opts.optionSeed : null;
    if (q.correctLanguage) {
        return {
            id: q.id,
            bank: q.bank || 'languages',
            style: 'languages',
            panelText: q.codeSnippet,
            panelIsCode: true,
            questionText: t('langPrompt'),
            options: buildLanguageOptions(q.correctLanguage, optionSeed),
            answer: q.correctLanguage,
            difficulty: q.difficulty,
            explanation: q.explanation
        };
    }
    if (Array.isArray(q.options) && q.answer != null) {
        const hasCmd = !!(q.codeSnippet && q.codeSnippet.trim().length);
        return {
            id: q.id,
            bank: q.bank || state.mode,
            style: 'cyber',
            panelText: hasCmd ? q.codeSnippet : q.question.en,
            panelIsCode: hasCmd,
            questionText: hasCmd ? q.question.en : '',
            options: shuffleOptions(q.options, optionSeed).map((o) => ({
                label: o
            })),
            answer: q.answer,
            difficulty: q.difficulty,
            explanation: q.explanation
        };
    }
    // Fill-in-the-blank / code completion.
    return {
        id: q.id,
        bank: q.bank || 'algorithms',
        style: 'fill',
        panelText: q.codeSnippet || '',
        panelIsCode: true,
        questionText: q.question ? q.question.en : t('fillPrompt'),
        answer: q.answer,
        accept: Array.isArray(q.accept) ? q.accept : [],
        difficulty: q.difficulty,
        explanation: q.explanation
    };
}

export function nextQuestion() {
    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    state.answered = false;
    state.selectedAnswer = null;
    if (state.index >= state.round.length) {
        endGame();
        return;
    }
    // Adaptive rounds fill each slot on demand based on the running target difficulty.
    if (state.adaptive && !state.round[state.index]) {
        const picked = pickAdaptiveQuestion();
        if (!picked) { endGame(); return; }
        state.round[state.index] = picked;
    }

    const cur = normalizeQuestion(state.round[state.index]);
    state.current = cur;
    $('#q-current').textContent = String(state.index + 1);
    setTitlebar(`${modeLabel(state.mode).toLowerCase()} — ${t('tbRound')} ${state.index + 1}/${state.round.length}`);
    const dEl = $('#code-difficulty');
    dEl.dataset.diff = cur.difficulty;
    dEl.textContent = diffLabel(cur.difficulty);

    // Prompt panel: highlighted code, or wrapped plain text for concept questions.
    const codeEl = $('#code-snippet');
    const panel = codeEl.parentElement; // the <pre class="code-panel">
    if (cur.panelIsCode) {
        panel.classList.remove('as-text');
        panel.setAttribute('dir', 'ltr');
        codeEl.innerHTML = highlight(cur.panelText);
    } else {
        panel.classList.add('as-text');
        panel.setAttribute('dir', 'auto');
        codeEl.textContent = cur.panelText;
    }
    renderCodeChrome(cur);

    // Sub-question (cyber: "what does this command do?").
    const qt = $('#question-text');
    if (cur.questionText) {
        qt.classList.remove('hidden');
        qt.textContent = cur.questionText;
    } else {
        qt.classList.add('hidden');
        qt.textContent = '';
    }

    hideToast();
    renderQuestionUI(cur, false);
    state.questionTime = resolvedQuestionTime(cur.difficulty);
    state.questionStartedAt = Date.now();
    if (state.learn) {
        // Practice mode: no countdown — take your time. Keep timeLeft finite (full
        // time) so scoring never becomes Infinity; the display just shows ∞.
        clearTimer();
        state.timeLeft = state.questionTime;
        $('#timer-num').textContent = '∞';
        setRing(1);
    } else {
        startTimer(state.questionTime);
    }
    pushPresence();
}

// Render the answer UI for a question: option buttons for languages/cyber, or a
// typed input for fill-in-the-blank. Keeps the two mutually exclusive.
export function renderQuestionUI(cur, disabled) {
    const grid = $('#options-grid');
    const fill = $('#fill-form');
    if (cur.style === 'fill') {
        grid.innerHTML = '';
        grid.classList.add('hidden');
        setupFillForm(disabled);
        fill.classList.remove('hidden');
    } else {
        fill.classList.add('hidden');
        renderOptions(cur, disabled);
        grid.classList.remove('hidden');
    }
    updateFiftyButton();
}

// 50:50 lifeline — remove two wrong options from the current choice question.
// Single-player / daily only (hidden in multiplayer), two uses per round.
export function updateFiftyButton() {
    const btn = $('#btn-fifty');
    if (!btn) return;
    const cur = state.current;
    const isChoice = cur && cur.style !== 'fill';
    btn.classList.toggle('hidden', !!state.multiplayer || !isChoice);
    const remaining = document.querySelectorAll('#options-grid button:not(:disabled):not(.eliminated)').length;
    btn.disabled = state.answered || (state.lifelines || 0) <= 0 || remaining <= 2;
    const cnt = $('#fifty-count');
    if (cnt) cnt.textContent = String(state.lifelines || 0);
}

export function useFifty() {
    const cur = state.current;
    if (state.multiplayer || state.answered || (state.lifelines || 0) <= 0 || !cur || cur.style === 'fill') return;
    const live = [...document.querySelectorAll('#options-grid button:not(:disabled):not(.eliminated)')];
    const wrong = live.filter((b) => b.dataset.answer !== cur.answer);
    if (wrong.length <= 1) return; // already down to the answer + one wrong
    shuffle(wrong).slice(0, 2).forEach((b) => { b.classList.add('eliminated'); b.disabled = true; });
    state.lifelines -= 1;
    try { sfx.tick(3); } catch (_) {}
    updateFiftyButton();
}

export function setupFillForm(disabled) {
    const input = $('#fill-input');
    const submit = $('#fill-submit');
    if (input) {
        input.value = '';
        input.disabled = !!disabled;
        input.classList.remove('fill-correct', 'fill-wrong');
        input.placeholder = t('fillPlaceholder');
    }
    if (submit) submit.disabled = !!disabled;
    if (!disabled && input) setTimeout(() => { try { input.focus(); } catch (e) {} }, 40);
}

export function renderOptions(cur, disabled) {
    const grid = $('#options-grid');
    grid.innerHTML = '';
    grid.classList.toggle('cyber', cur.style === 'cyber');
    grid.classList.toggle('languages', cur.style === 'languages');
    cur.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.dataset.answer = opt.label;
        btn.disabled = !!disabled;
        if (cur.style === 'languages') {
            btn.className = 'lang-btn';
            btn.innerHTML =
                `<span class="opt-key" aria-hidden="true">${index + 1}</span>` +
                `<span class="lang-icon" style="background:${opt.color}">${opt.glyph}</span>` +
                `<span class="lang-name">${opt.label}</span>`;
        } else {
            // Give multiple-choice options the same card-with-icon look as the
            // language buttons: a lettered A/B/C/D badge plus the answer text.
            btn.className = 'opt-btn';
            const badge = document.createElement('span');
            badge.className = 'opt-badge';
            badge.style.background = OPTION_COLORS[index % OPTION_COLORS.length];
            badge.textContent = String(index + 1);
            const text = document.createElement('span');
            text.className = 'opt-text';
            text.textContent = opt.label;
            btn.appendChild(badge);
            btn.appendChild(text);
        }
        btn.addEventListener('click', () => {
            if (state.multiplayer) onAnswerMultiplayer(opt.label, btn);
            else onAnswer(opt.label, btn);
        });
        grid.appendChild(btn);
    });
}

export function clearSelectedOption() {
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.classList.remove('selected');
    });
}

// Keyboard answering for choice questions: 1–4 / a–d pick the matching option.
export function onGameKeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!$('#screen-game')?.classList.contains('active')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    const grid = $('#options-grid');
    if (!grid || grid.classList.contains('hidden') || state.answered) return;

    let idx = -1;
    if (e.key >= '1' && e.key <= '9') idx = Number(e.key) - 1;
    else {
        const k = (e.key || '').toLowerCase();
        if (k.length === 1 && k >= 'a' && k <= 'f') idx = k.charCodeAt(0) - 97;
    }
    if (idx < 0) return;
    const btns = grid.querySelectorAll('button:not(:disabled)');
    if (btns[idx]) {
        e.preventDefault();
        btns[idx].click();
    }
}

export function onAnswer(chosen, btn) {
    if (state.answered) return;
    state.selectedAnswer = chosen;
    clearSelectedOption();
    if (btn) {
        btn.classList.add('selected');
    }
    // Practice mode has no timer, so a pick resolves immediately (with the explanation).
    if (state.learn) { resolveCurrentQuestion(chosen, false); return; }
    // Once a choice is locked in, don't make the player wait out a long timer:
    // if more than 2s remain, fast-forward the countdown to 2s (the answer stays
    // changeable during that window, then resolves).
    if (state.timeLeft > 2) {
        state.timeLeft = 2;
        updateTimerDisplay();
        setRing(state.timeLeft / state.questionTime);
    }
}

// Submit a typed fill-in-the-blank answer. Single-player grades and reveals
// immediately; multiplayer submits and waits for the shared reveal.
export function submitFill() {
    if (!state.current || state.current.style !== 'fill') return;
    if (state.answered) return;
    const input = $('#fill-input');
    const typed = input ? input.value : '';
    if (state.multiplayer) {
        if (state.spectator) return;
        const room = window.GTL_MULTIPLAYER.state.room;
        if (!room || room.phase !== 'question') return;
        state.answered = true;
        state.mpChosen = typed;
        if (input) input.disabled = true;
        const submit = $('#fill-submit');
        if (submit) submit.disabled = true;
        showMpWaiting();
        window.GTL_MULTIPLAYER.submitAnswer(normFill(typed), state.timeLeft)
            .catch((e) => console.error('submit_answer:', e));
        state.mpAnsweredIndex = state.index;
    } else {
        state.selectedAnswer = typed;
        resolveCurrentQuestion(typed, false);
    }
}

export function resolveCurrentQuestion(chosen, timedOut = false) {
    if (state.answered) return;
    state.answered = true;
    clearTimer();
    updateFiftyButton(); // grey out the lifeline once the question is locked
    const cur = state.current;
    const isFill = cur.style === 'fill';
    const correct = isFill ? isFillCorrect(cur, chosen) : (chosen === cur.answer);

    if (isFill) {
        const input = $('#fill-input');
        const submit = $('#fill-submit');
        if (input) {
            input.disabled = true;
            input.classList.remove('fill-correct', 'fill-wrong');
            input.classList.add(correct ? 'fill-correct' : 'fill-wrong');
        }
        if (submit) submit.disabled = true;
    } else {
        const buttons = Array.from(document.querySelectorAll('#options-grid button'));
        buttons.forEach((b) => {
            b.disabled = true;
            b.classList.remove('selected');
        });
        buttons.forEach((b) => {
            if (b.dataset.answer === cur.answer) b.classList.add('correct');
        });
        if (!correct && chosen) {
            const selectedBtn = buttons.find((b) => b.dataset.answer === chosen);
            if (selectedBtn) selectedBtn.classList.add('wrong', 'shake');
        }
    }

    let gained = 0;
    if (correct) {
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        state.correct += 1;
        gained = scoreAnswer(state.timeLeft, state.streak);
        state.score += gained;
        sfx.correct();
        updateScore(true);
        updateCorrect();
        showFeedback('good', `${t('correct')} +${gained}${state.streak >= 3 ? '  ' + t('streakBonus') : ''}`, cur.explanation.en);
    } else {
        state.streak = 0;
        sfx.wrong();
        showFeedback('bad', `${t('wrong')} ${cur.answer}.`, cur.explanation.en);
    }

    recordRoundAnswer(cur, chosen, correct, gained, timedOut);
    // Split the award the way the design's footer reads it: the flat 100 for a
    // correct answer, then whatever the remaining time was worth.
    const gainEl = $('#game-footer-gain');
    if (gainEl) {
        if (!correct) gainEl.textContent = '';
        else {
            const mult = state.streak >= 3 ? 1.5 : 1;
            const base = Math.round(100 * mult);
            const speed = Math.max(0, gained - base);
            gainEl.textContent = speed > 0 ? `+${base}  ·  speed bonus +${speed}` : `+${gained}`;
        }
    }
    updateStreakPill();
    if (state.multiplayer) return;
    bumpAdaptive(correct); // nudge the next question's difficulty
    state.index += 1;
    scheduleFeedbackAdvance();
}

export function recordRoundAnswer(cur, chosen, correct, points, timedOut) {
    const elapsed = Math.max(0, Date.now() - (state.questionStartedAt || Date.now()));
    state.roundHistory.push({
        questionIndex: state.index,
        id: cur.id,
        bank: cur.bank,
        difficulty: cur.difficulty,
        style: cur.style,
        prompt: cur.questionText || cur.panelText,
        panelText: cur.panelText,
        selectedAnswer: chosen || '',
        correctAnswer: cur.answer,
        correct: !!correct,
        timedOut: !!timedOut,
        responseTimeMs: Math.min(elapsed, state.questionTime * 1000),
        points: Number(points) || 0,
        explanation: cur.explanation || {}
    });
}

export function scheduleFeedbackAdvance() {
    const panel = $('#feedback-panel');
    const next = $('#btn-next');
    panel?.classList.remove('hidden');
    next?.classList.remove('hidden');
    requestAnimationFrame(() => next?.focus());
    // Practice mode always waits for a manual "Next" so you can study the explanation.
    if (state.learn) return;
    const setting = getSettings().feedbackDelay;
    if (setting === 'manual') return;
    const seconds = [2, 4, 6].includes(Number(setting)) ? Number(setting) : 4;
    const delay = typeof window.__GTL_FEEDBACK_MS === 'number' ? window.__GTL_FEEDBACK_MS : seconds * 1000;
    state.advanceTimer = setTimeout(advanceAfterFeedback, delay);
}

export function advanceAfterFeedback() {
    if (state.advanceTimer) clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
    nextQuestion();
}

export function onAnswerMultiplayer(chosen, btn) {
    // Spectators watch only — their picks never count.
    if (state.spectator) return;
    // Accept picks only while the question is open. The player MAY change their
    // answer as many times as they like before the timer runs out.
    const room = window.GTL_MULTIPLAYER.state.room;
    if (!room || room.phase !== 'question') return;
    state.answered = true;
    state.mpChosen = chosen;
    const timeLeft = state.timeLeft;

    // Highlight the current choice but keep every option clickable so it can be
    // changed. Correctness and the score stay hidden until the reveal, and the
    // score itself is not awarded until the question's time is up.
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.classList.toggle('mp-selected', b.dataset.answer === chosen);
    });
    showMpWaiting();

    window.GTL_MULTIPLAYER.submitAnswer(chosen, timeLeft)
        .catch((e) => console.error('submit_answer:', e));

    state.mpAnsweredIndex = state.index;
}

// ---------- Timer ----------
export function startTimer(seconds) {
    if (state.multiplayer) {
        startTimerFromServer();
        return;
    }
    state.timeLeft = seconds;
    state.lastTickSecond = -1;
    updateTimerDisplay();
    setRing(1);
    state.timerId = setInterval(() => {
        state.timeLeft -= 1;
        updateTimerDisplay();
        setRing(state.timeLeft / state.questionTime);
        maybeCountdownBeep(state.timeLeft);
        if (state.timeLeft <= 0) {
            clearTimer();
            onTimeout();
        }
    }, 1000);
}

// Beep once per second over the final 3 seconds, but only while the player has
// not answered yet (so a locked-in answer goes quiet).
export function maybeCountdownBeep(left) {
    if (left <= 3 && left > 0 && !state.answered && left !== state.lastTickSecond) {
        state.lastTickSecond = left;
        sfx.tick(left);
    }
}

export function startTimerFromServer() {
    clearTimer();
    state.lastTickSecond = -1;
    const total = state.questionTime || 15;

    function tick() {
        const room = window.GTL_MULTIPLAYER.state.room;
        if (!room ?.question_ends_at) return;
        const left = window.GTL_MULTIPLAYER.remainingSeconds(room);
        state.timeLeft = left;
        updateTimerDisplay();
        setRing(left / total);
        if (room.phase === 'question') maybeCountdownBeep(left);
        if (left <= 0 && room.phase === 'question') {
            if (!state.answered) {
                onTimeoutMultiplayer();
            } else {
                // Time is up — lock in the current pick (no more changes).
                document.querySelectorAll('#options-grid button').forEach((b) => {
                    b.disabled = true;
                });
            }
        }
    }
    tick();
    state.timerId = setInterval(tick, 200);
}

export function onTimeout() {
    if (state.answered) return;
    const cur = state.current;
    // For fill-in questions the "pick" is whatever was typed (even if not
    // submitted); for choice questions it's the selected option.
    let pick = state.selectedAnswer;
    if (cur && cur.style === 'fill') {
        const input = $('#fill-input');
        pick = input ? input.value : '';
    }
    const hadPick = cur && cur.style === 'fill' ? !!normFill(pick) : !!state.selectedAnswer;
    // resolveCurrentQuestion already shows the correct/wrong feedback (and
    // handles the streak + score) for whatever the player picked. Only when
    // NOTHING was picked do we replace it with the red "time's up" message.
    resolveCurrentQuestion(pick, true);
    if (!hadPick && !state.multiplayer) {
        showFeedback('bad', `${t('timeUp')} ${cur.answer}.`, cur.explanation.en);
    }
    updateStreakPill();
}

export function onTimeoutMultiplayer() {
    if (state.answered) return;
    state.answered = true;
    // For a fill question, submit whatever was typed (even if not clicked) so it
    // still counts; otherwise no pick was made.
    if (state.current && state.current.style === 'fill') {
        const input = $('#fill-input');
        state.mpChosen = input ? input.value : '';
        if (input) input.disabled = true;
        const submit = $('#fill-submit');
        if (submit) submit.disabled = true;
    } else {
        state.mpChosen = '';
    }
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.disabled = true;
    });
    // The shared deadline has passed; the reveal follows almost immediately.
    showMpWaiting();
    // A fill answer typed-but-not-submitted still counts on timeout.
    const finalAnswer = state.current && state.current.style === 'fill'
        ? normFill(state.mpChosen) : '';
    window.GTL_MULTIPLAYER.submitAnswer(finalAnswer, 0)
        .then(() => syncMpHudFromPlayers())
        .catch((e) => console.error('timeout submit:', e));
    state.mpAnsweredIndex = state.index;
}

// End the round early and show the results so far.
export function endQuiz() {
    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    if (state.multiplayer && window.GTL_MULTIPLAYER.state.isAdmin) {
        window.GTL_MULTIPLAYER.endRoom().catch((e) => console.error(e));
        return;
    }
    endGame();
}

export function clearTimer() {
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }
}

export function updateTimerDisplay() {
    $('#timer-num').textContent = String(Math.max(0, state.timeLeft));
}

export function setRing(fraction) {
    fraction = Math.max(0, Math.min(1, fraction));
    const ring = $('#ring-fg');
    // The ring is hidden in the Terminal/IDE design but kept in the DOM, so the
    // headless tests that read it still work.
    if (ring) {
        ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
        ring.classList.toggle('warn', fraction <= 0.4 && fraction > 0.2);
        ring.classList.toggle('danger', fraction <= 0.2);
    }
    // The visible countdown: a run-bar across the top of the round.
    const bar = $('#timer-bar-fill');
    if (bar) {
        bar.style.width = `${fraction * 100}%`;
        bar.classList.toggle('warn', fraction <= 0.4 && fraction > 0.2);
        bar.classList.toggle('danger', fraction <= 0.2);
    }
}

// Line-number gutter beside the snippet, and the editor-style tab label. The
// gutter is aria-hidden, so it is decoration only — the code itself still reads
// cleanly to a screen reader.
export function renderCodeChrome(cur) {
    const gutter = $('#code-gutter');
    if (gutter) {
        const lines = String(cur.panelText || '').split('\n').length;
        gutter.textContent = cur.panelIsCode
            ? Array.from({ length: lines }, (_, i) => i + 1).join('\n')
            : '';
    }
    const tab = $('#code-tab');
    if (tab) tab.textContent = cur.panelIsCode ? t('snippetTab') : 'question.md';
    buildHint(cur);
    showCodeTab('snippet');   // every new question opens on the snippet
}

// ---------- hint.md ----------
// A hint has to help without answering. The question's own explanation is the
// only prose available and it usually names the answer outright, so the answer
// (and every accept-variant) is masked out of it. What survives is the reasoning:
// "The ▮▮▮▮ shebang and [ -f ] test are ▮▮▮▮." That points at the right idea
// without handing over the word.
export function maskAnswer(text, cur) {
    let out = String(text || '');
    const targets = [cur.answer, ...(cur.accept || [])]
        .filter((a) => typeof a === 'string' && a.trim().length > 1)
        .sort((a, b) => b.length - a.length); // longest first, so a subset can't half-mask
    for (const a of targets) {
        const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(esc, 'gi'), '▮'.repeat(Math.min(a.length, 8)));
    }
    return out;
}

export function buildHint(cur) {
    const box = $('#hint-body');
    if (!box) return;
    box.innerHTML = '';
    const bank = cur.bank || '';
    const rows = [];
    if (bank) rows.push([t('hintCategory'), modeLabel(bank === 'bug' || bank === 'output' ? 'algorithms' : bank)]);
    if (cur.difficulty) rows.push([t('hintDifficulty'), diffLabel(cur.difficulty)]);
    rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'hint-row';
        const key = document.createElement('span');
        key.className = 'hint-key';
        key.textContent = k;
        const val = document.createElement('span');
        val.className = 'hint-val';
        val.textContent = v;
        row.append(key, val);
        box.appendChild(row);
    });
    const p = document.createElement('p');
    p.className = 'hint-text';
    const explanation = (cur.explanation && cur.explanation.en) || '';
    p.textContent = explanation ? maskAnswer(explanation, cur) : t('hintMasked');
    box.appendChild(p);
}

export function showCodeTab(which) {
    const isHint = which === 'hint';
    $('#hint-body')?.classList.toggle('hidden', !isHint);
    const pre = $('#code-snippet')?.parentElement;
    if (pre) pre.classList.toggle('hidden', isHint);
    $('#code-tab')?.classList.toggle('is-active', !isHint);
    $('#code-tab-hint')?.classList.toggle('is-active', isHint);
}

// ---------- HUD ----------
export function updateScore(pulse) {
    const el = $('#game-score');
    el.textContent = String(state.score);
    if (pulse) {
        el.animate(
            [{
                transform: 'scale(1)'
            }, {
                transform: 'scale(1.35)'
            }, {
                transform: 'scale(1)'
            }], {
                duration: 350,
                easing: 'ease-out'
            }
        );
    }
    // The score is half of what the Discord card advertises.
    pushPresence();
}

export function updateCorrect() {
    $('#correct-count').textContent = String(state.correct);
}

export function updateStreakPill() {
    const pill = $('#streak-pill');
    if (state.streak >= 3) {
        pill.classList.remove('hidden');
        $('#streak-count').textContent = String(state.streak);
    } else {
        pill.classList.add('hidden');
    }
}

// Structured answer feedback: a bold result headline plus the question's
// explanation on its own line, so the teaching text is readable at a glance
// (and stays put for the whole review window) instead of a cramped single line.
export function showFeedback(kind, headline, explanation) {
    const toast = $('#answer-toast');
    const h = $('#fb-headline');
    const e = $('#fb-explanation');
    if (h) h.textContent = headline || '';
    if (e) {
        e.textContent = explanation || '';
        e.classList.toggle('hidden', !explanation);
    }
    if (toast) toast.className = `toast show ${kind}`;
    $('#feedback-panel')?.classList.remove('hidden');
    $('#btn-next')?.classList.toggle('hidden', state.multiplayer);
    announce(`${headline || ''}${explanation ? '. ' + explanation : ''}`);
}

// Back-compat shim for any single-line callers.
export function showToast(text, kind) {
    showFeedback(kind, text, '');
}

export function hideToast() {
    $('#answer-toast').className = 'toast';
    $('#feedback-panel')?.classList.add('hidden');
    $('#btn-next')?.classList.add('hidden');
}

// Multiplayer "Waiting for opponents…" banner (shown after you lock an answer
// while the timer keeps running for the others).
export function showMpWaiting() {
    const el = $('#mp-status');
    if (!el) return;
    el.textContent = t('waitingOpponents');
    el.classList.remove('hidden');
}

export function hideMpStatus() {
    const el = $('#mp-status');
    if (el) el.classList.add('hidden');
}
