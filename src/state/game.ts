import { createSignal, createMemo, createRoot, type Accessor } from 'solid-js';
import { createStore } from 'solid-js/store';
import { locale, modeLabel, t } from '../i18n';
import { loadQuestions } from '../lib/questions';
import {
    bumpAdaptive,
    buildRoundFromPool,
    createAdaptiveState,
    isFillCorrect,
    normalizeQuestion,
    pickAdaptiveQuestion,
    resolvedQuestionTime,
    scoreAnswer,
    shuffle,
    timeForDifficulty,
    type AdaptiveState,
} from '../lib/round';
import { buildDailyRound, isDailyDone, markDailyDone } from '../lib/daily';
import { normalizeFillAnswer, safeDisplayName, nameKey } from '../lib/names';
import { settings, highScore, setHighScore, updateSettings } from '../lib/settings';
import {
    canPlay,
    isDiscordLinked,
    ownAvatarUrl,
    playerName,
    requiresDiscordLogin,
    startDiscordLogin,
} from '../lib/identity';
import { sfx } from '../lib/audio';
import { supabaseConfigured } from '../lib/supabase';
import {
    fetchDailyTop,
    fetchPersonalRank,
    fetchTopScores,
    submitDailyScore,
    submitMultiplayerScores,
    submitScore,
    type MpScoreRow,
} from '../lib/leaderboard';
import { recordPlay } from '../lib/progression';
import { readString, writeString } from '../lib/storage';
import * as mp from '../lib/multiplayer';
import { discordActivity } from '../lib/discord';
import {
    configurePresence,
    pushPresence,
    resetPresenceClock,
    startPresenceClock,
} from '../lib/presence';
import {
    GAME_MODES,
    type BankedQuestion,
    type ChallengeInfo,
    type Difficulty,
    type GameMode,
    type LeaderboardEntry,
    type LeaderboardScope,
    type NormalizedQuestion,
    type Room,
    type RoomPlayer,
    type RoomSettings,
    type RoundAnswer,
    type ScreenName,
} from '../types/models';

/* ============================================================
   The single source of truth for a session: which screen is up,
   the round in flight, and everything the results view needs.
   ============================================================ */

export interface FeedbackState {
    readonly kind: 'good' | 'bad';
    readonly headline: string;
    readonly explanation: string;
}

export interface ChallengeTarget {
    readonly score: number;
    readonly mode: GameMode;
}

interface GameState {
    screen: ScreenName;
    mode: GameMode;
    allQuestions: readonly BankedQuestion[];
    questionsLoading: boolean;
    questionsFailed: boolean;

    round: readonly (BankedQuestion | null)[];
    index: number;
    score: number;
    correct: number;
    streak: number;
    bestStreak: number;
    roundHistory: readonly RoundAnswer[];
    current: NormalizedQuestion | null;

    answered: boolean;
    revealed: boolean;
    selectedAnswer: string | null;
    eliminated: readonly string[];
    lifelines: number;
    feedback: FeedbackState | null;
    showNextButton: boolean;

    timeLeft: number;
    questionTime: number;
    questionStartedAt: number;
    gameStartMs: number | null;

    /** Round flavours — mutually exclusive with each other. */
    practice: boolean;
    daily: boolean;
    viewOnly: boolean;

    multiplayer: boolean;
    spectator: boolean;
    mpChosen: string | null;
    mpSyncKey: string;
    mpResultsShown: boolean;
    mpRoundLength: number;
    mpStatus: string | null;
    revealChips: Readonly<Record<string, readonly string[]>>;

    challenge: ChallengeTarget | null;
    challengeBanner: ChallengeInfo | null;

    lbViewMode: GameMode;
    lbScope: LeaderboardScope;
    lbEntries: readonly LeaderboardEntry[];
    lbNote: string;
    lbNoteKind: 'idle' | 'online' | 'offline';
    lbSubtitle: string;
    personalResult: string | null;

    bootLoading: boolean;
    liveMessage: string;
    authError: string | null;
}

const MODE_STORAGE_KEY = 'gtl_mode';

function storedMode(): GameMode {
    const saved = readString(MODE_STORAGE_KEY);
    return GAME_MODES.find((m) => m === saved) ?? 'all';
}

const [state, setState] = createStore<GameState>({
    screen: 'home',
    mode: storedMode(),
    allQuestions: [],
    questionsLoading: false,
    questionsFailed: false,

    round: [],
    index: 0,
    score: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    roundHistory: [],
    current: null,

    answered: false,
    revealed: false,
    selectedAnswer: null,
    eliminated: [],
    lifelines: 2,
    feedback: null,
    showNextButton: false,

    timeLeft: 0,
    questionTime: 15,
    questionStartedAt: 0,
    gameStartMs: null,

    practice: false,
    daily: false,
    viewOnly: false,

    multiplayer: false,
    spectator: false,
    mpChosen: null,
    mpSyncKey: '',
    mpResultsShown: false,
    mpRoundLength: 0,
    mpStatus: null,
    revealChips: {},

    challenge: null,
    challengeBanner: null,

    lbViewMode: storedMode(),
    lbScope: 'all',
    lbEntries: [],
    lbNote: '',
    lbNoteKind: 'idle',
    lbSubtitle: '',
    personalResult: null,

    bootLoading: false,
    liveMessage: '',
    authError: null,
});

export { state };

/* ---------------- Achievement celebration ---------------- */

export interface AchievementPop {
    readonly title: string;
    readonly body: string;
}

const [achievementPop, setAchievementPop] = createSignal<AchievementPop | null>(null);
export { achievementPop };

let achievementTimer: ReturnType<typeof setTimeout> | null = null;

function celebrateAchievements(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const names = ids.map((id) => t(`ach_${id}` as never) || id).join('  ·  ');
    setAchievementPop({ title: t('achievementUnlocked'), body: names });
    sfx.finish();
    if (achievementTimer) clearTimeout(achievementTimer);
    achievementTimer = setTimeout(() => setAchievementPop(null), 5200);
}

/* ---------------- Small helpers ---------------- */

/**
 * Store-level derivations live for the whole app, so they are created inside an
 * owner root: without one Solid warns that the computation can never be disposed.
 */
function rootMemo<T>(compute: () => T): Accessor<T> {
    return createRoot(() => createMemo(compute));
}

export function announce(message: string): void {
    setState('liveMessage', '');
    queueMicrotask(() => setState('liveMessage', message));
}

export function showScreen(screen: ScreenName): void {
    setState('screen', screen);
    pushPresence();
}

let timerId: ReturnType<typeof setInterval> | null = null;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let adaptive: AdaptiveState | null = null;
let lastTickSecond = -1;

function clearTimer(): void {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function clearAdvance(): void {
    if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
    }
}

export const currentHighScore = rootMemo(() => highScore(state.mode));

export const roundLength = rootMemo(() =>
    state.multiplayer ? state.mpRoundLength : state.round.length,
);

/* ---------------- Mode selection ---------------- */

export async function selectMode(mode: GameMode): Promise<void> {
    setState('mode', mode);
    writeString(MODE_STORAGE_KEY, mode);
    // Switching away from the challenged mode means the player opted out — drop
    // the pending challenge so the banner and verdict don't linger.
    if (state.challenge && state.challenge.mode !== mode) dismissChallenge();
    setState({ questionsLoading: true, questionsFailed: false });
    try {
        const questions = await loadQuestions(mode);
        setState({ allQuestions: questions, questionsLoading: false });
    } catch (err) {
        console.error('Failed to load questions:', err);
        setState({ allQuestions: [], questionsLoading: false, questionsFailed: true });
    }
}

/**
 * Multiplayer rounds can use any bank (the host picks the mode), so always load
 * the full set — refs carry their own bank and resolve regardless of mode.
 */
async function loadAllBanks(): Promise<void> {
    try {
        setState('allQuestions', await loadQuestions('all'));
    } catch (err) {
        console.error('Failed to load question banks:', err);
    }
}

/* ---------------- Identity gate ---------------- */

/** Gate before starting/hosting/joining. Returns false when the player is blocked. */
export function requireIdentity(openSettings: () => void): boolean {
    if (canPlay()) return true;
    if (requiresDiscordLogin()) {
        startDiscordLogin();
        return false;
    }
    openSettings();
    announce(t('nameRequired'));
    setState('authError', t('nameRequired'));
    return false;
}

export interface NameCheck {
    readonly valid: boolean;
    readonly message: string | null;
}

/** Verify the leaderboard name is present, safe and not already taken. */
export async function ensureValidPlayerName(): Promise<NameCheck> {
    if (isDiscordLinked()) return { valid: true, message: null };

    const candidate = settings().name.trim();
    if (!candidate) return { valid: false, message: t('nameRequired') };
    if (!safeDisplayName(candidate) || safeDisplayName(candidate) === t('hiddenPlayer')) {
        return { valid: false, message: t('unsafeName') };
    }
    if (!supabaseConfigured()) return { valid: true, message: null };

    try {
        const top = await fetchTopScores(state.mode, 'all', 100);
        const taken = top.some((row) => nameKey(row.player) === nameKey(candidate));
        if (taken) return { valid: false, message: t('nameTaken') };
    } catch (err) {
        console.warn('Unable to verify leaderboard name availability:', err);
    }
    return { valid: true, message: null };
}

/* ---------------- Round lifecycle ---------------- */

function beginRound(): void {
    clearTimer();
    clearAdvance();
    setState({
        index: 0,
        score: 0,
        correct: 0,
        streak: 0,
        bestStreak: 0,
        roundHistory: [],
        viewOnly: false,
        selectedAnswer: null,
        eliminated: [],
        lifelines: 2,
        feedback: null,
        showNextButton: false,
        revealed: false,
        gameStartMs: Date.now(),
        challengeBanner: null,
        mpStatus: null,
    });
    showScreen('game');
    startPresenceClock();
    nextQuestion();
}

export async function startGame(): Promise<NameCheck> {
    const check = await ensureValidPlayerName();
    if (!check.valid) return check;
    adaptive =
        settings().adaptive && state.allQuestions.length > 0
            ? createAdaptiveState(state.allQuestions)
            : null;
    const built = adaptive
        ? new Array<BankedQuestion | null>(
              Math.min(settings().questions, state.allQuestions.length || settings().questions),
          ).fill(null)
        : buildRoundFromPool(state.allQuestions, settings()).slice();
    setState({ round: built, practice: false, daily: false, multiplayer: false });
    beginRound();
    return check;
}

/** Practice: same questions, no timer, no scoring — just learn. */
export async function startPractice(): Promise<NameCheck> {
    const check = await ensureValidPlayerName();
    if (!check.valid) return check;
    adaptive = null;
    setState({
        round: buildRoundFromPool(state.allQuestions, settings()).slice(),
        practice: true,
        daily: false,
        multiplayer: false,
    });
    beginRound();
    return check;
}

export async function startDailyChallenge(): Promise<NameCheck> {
    const check = await ensureValidPlayerName();
    if (!check.valid) return check;
    if (state.allQuestions.length === 0 || state.mode !== 'all') {
        setState('allQuestions', await loadQuestions('all'));
    }
    const round = buildDailyRound(state.allQuestions);
    if (round.length === 0) {
        announce(t('lbOffline'));
        return { valid: false, message: t('lbOffline') };
    }
    adaptive = null;
    setState({
        round: round.slice(),
        daily: true,
        practice: false,
        multiplayer: false,
        // Mixed styles; the daily board is separate from the mode boards.
        mode: 'all',
    });
    beginRound();
    return check;
}

export function dailyAlreadyPlayed(): boolean {
    return isDailyDone();
}

function nextQuestion(): void {
    clearTimer();
    clearAdvance();
    setState({
        answered: false,
        revealed: false,
        selectedAnswer: null,
        eliminated: [],
        feedback: null,
        showNextButton: false,
    });

    if (state.index >= state.round.length) {
        void endGame();
        return;
    }

    // Adaptive rounds fill each slot on demand from the running target difficulty.
    if (adaptive && !state.round[state.index]) {
        const picked = pickAdaptiveQuestion(adaptive);
        if (!picked) {
            void endGame();
            return;
        }
        const slot = state.index;
        setState('round', (round) => round.map((item, i) => (i === slot ? picked : item)));
    }

    const raw = state.round[state.index];
    if (!raw) {
        void endGame();
        return;
    }

    const question = normalizeQuestion(raw);
    setState({
        current: question,
        questionTime: resolvedQuestionTime(question.difficulty, settings()),
        questionStartedAt: Date.now(),
    });

    if (state.practice) {
        // No countdown — take your time. timeLeft stays finite (full time) so
        // scoring can never become Infinity; the display just shows ∞.
        setState('timeLeft', state.questionTime);
    } else {
        startTimer(state.questionTime);
    }
    pushPresence();
}

function startTimer(seconds: number): void {
    clearTimer();
    lastTickSecond = -1;
    setState('timeLeft', seconds);
    timerId = setInterval(() => {
        setState('timeLeft', state.timeLeft - 1);
        maybeCountdownBeep(state.timeLeft);
        if (state.timeLeft <= 0) {
            clearTimer();
            onTimeout();
        }
    }, 1000);
}

/** Beep once per second over the final 3 seconds, only while unanswered. */
function maybeCountdownBeep(left: number): void {
    if (left <= 3 && left > 0 && !state.answered && left !== lastTickSecond) {
        lastTickSecond = left;
        sfx.tick(left);
    }
}

export function chooseAnswer(label: string): void {
    if (state.multiplayer) {
        submitMultiplayerAnswer(label);
        return;
    }
    if (state.answered) return;
    setState('selectedAnswer', label);
    // Practice mode has no timer, so a pick resolves immediately.
    if (state.practice) {
        resolveCurrentQuestion(label, false);
        return;
    }
    // Once a choice is locked in, don't make the player wait out a long timer:
    // fast-forward to 2s (the answer stays changeable during that window).
    if (state.timeLeft > 2) setState('timeLeft', 2);
}

export function submitFillAnswer(typed: string): void {
    const question = state.current;
    if (!question || question.style !== 'fill' || state.answered) return;

    if (state.multiplayer) {
        if (state.spectator) return;
        if (mp.mpRoom()?.phase !== 'question') return;
        setState({ answered: true, mpChosen: typed, mpStatus: t('waitingOpponents') });
        void mp.submitAnswer(normalizeFillAnswer(typed), state.timeLeft).catch((err: unknown) => {
            console.error('submit_answer:', err);
        });
        return;
    }
    setState('selectedAnswer', typed);
    resolveCurrentQuestion(typed, false);
}

/** 50:50 lifeline — remove two wrong options. Single-player only. */
export function useFiftyFifty(): void {
    const question = state.current;
    if (
        state.multiplayer ||
        state.answered ||
        state.lifelines <= 0 ||
        !question ||
        question.style === 'fill'
    ) {
        return;
    }
    const wrong = question.options
        .map((option) => option.label)
        .filter((label) => label !== question.answer && !state.eliminated.includes(label));
    if (wrong.length <= 1) return; // already down to the answer + one wrong
    setState('eliminated', [...state.eliminated, ...shuffle(wrong).slice(0, 2)]);
    setState('lifelines', state.lifelines - 1);
    sfx.tick(3);
}

export function fiftyFiftyDisabled(): boolean {
    const question = state.current;
    if (!question || question.style === 'fill') return true;
    const remaining = question.options.filter(
        (option) => !state.eliminated.includes(option.label),
    ).length;
    return state.answered || state.lifelines <= 0 || remaining <= 2;
}

function recordRoundAnswer(
    question: NormalizedQuestion,
    chosen: string,
    correct: boolean,
    points: number,
    timedOut: boolean,
): void {
    const elapsed = Math.max(0, Date.now() - (state.questionStartedAt || Date.now()));
    const entry: RoundAnswer = {
        questionIndex: state.index,
        id: question.id,
        bank: question.bank,
        difficulty: question.difficulty,
        style: question.style,
        prompt: question.questionText || question.panelText,
        panelText: question.panelText,
        selectedAnswer: chosen,
        correctAnswer: question.answer,
        correct,
        timedOut,
        responseTimeMs: Math.min(elapsed, state.questionTime * 1000),
        points,
        explanation: question.explanation,
    };
    setState('roundHistory', (history) => [...history, entry]);
}

function resolveCurrentQuestion(chosen: string, timedOut: boolean): void {
    if (state.answered) return;
    const question = state.current;
    if (!question) return;

    setState({ answered: true, revealed: true, selectedAnswer: chosen });
    clearTimer();

    const correct =
        question.style === 'fill'
            ? isFillCorrect(question, chosen)
            : chosen === question.answer;

    let gained = 0;
    if (correct) {
        const streak = state.streak + 1;
        gained = scoreAnswer(state.timeLeft, streak);
        setState({
            streak,
            bestStreak: Math.max(state.bestStreak, streak),
            correct: state.correct + 1,
            score: state.score + gained,
        });
        sfx.correct();
        setState('feedback', {
            kind: 'good',
            headline: `${t('correct')} +${gained}${streak >= 3 ? `  ${t('streakBonus')}` : ''}`,
            explanation: question.explanation[locale()],
        });
    } else {
        setState('streak', 0);
        sfx.wrong();
        const hadPick =
            question.style === 'fill' ? normalizeFillAnswer(chosen).length > 0 : chosen.length > 0;
        setState('feedback', {
            kind: 'bad',
            headline: `${hadPick || !timedOut ? t('wrong') : t('timeUp')} ${question.answer}.`,
            explanation: question.explanation[locale()],
        });
    }

    recordRoundAnswer(question, chosen, correct, gained, timedOut);
    announce(`${state.feedback?.headline ?? ''} ${state.feedback?.explanation ?? ''}`);
    if (adaptive) bumpAdaptive(adaptive, correct);
    setState('index', state.index + 1);
    scheduleFeedbackAdvance();
    pushPresence();
}

function onTimeout(): void {
    if (state.answered) return;
    resolveCurrentQuestion(state.selectedAnswer ?? '', true);
}

function scheduleFeedbackAdvance(): void {
    setState('showNextButton', true);
    // Practice always waits for a manual "Next" so you can study the explanation.
    if (state.practice) return;
    const delay = settings().feedbackDelay;
    if (delay === 'manual') return;
    const ms = window.__GTL_FEEDBACK_MS ?? delay * 1000;
    advanceTimer = setTimeout(advanceAfterFeedback, ms);
}

export function advanceAfterFeedback(): void {
    clearAdvance();
    nextQuestion();
}

/** End the round early and show the results so far. */
export function endQuiz(): void {
    clearTimer();
    clearAdvance();
    if (state.multiplayer && mp.mpIsHost()) {
        void mp.endRoom().catch((err: unknown) => console.error(err));
        return;
    }
    void endGame();
}

function isPerfectRound(): boolean {
    return state.round.length > 0 && state.correct === state.round.length;
}

/** True when the local player has the (non-spectator) top score in the room. */
function amIWinner(): boolean {
    const players = mp.mpPlayers();
    const me = mp.localRoomPlayer();
    if (!me || me.spectator) return false;
    const top = Math.max(...players.filter((p) => !p.spectator).map((p) => p.score), 0);
    return top > 0 && me.score === top;
}

export async function endGame(): Promise<void> {
    clearTimer();
    clearAdvance();
    const viewOnly = state.viewOnly;

    if (!viewOnly) {
        if (state.score > highScore(state.mode)) setHighScore(state.mode, state.score);
        sfx.finish();
    }
    showScreen('results');

    if (!viewOnly && !state.multiplayer && !state.practice) {
        const seconds = state.gameStartMs ? (Date.now() - state.gameStartMs) / 1000 : 0;
        setState('gameStartMs', null);
        void recordPlay({
            player: playerName(),
            seconds,
            multiplayer: false,
            won: false,
            xp: state.score,
            perfect: isPerfectRound(),
        }).then(celebrateAchievements);
    }

    await buildResultsLeaderboard();
}

/* ---------------- Leaderboard building ---------------- */

export function setLeaderboardScope(scope: LeaderboardScope): void {
    setState('lbScope', scope);
    void buildResultsLeaderboard();
}

export function setLeaderboardMode(mode: GameMode): void {
    setState('lbViewMode', mode);
    void buildResultsLeaderboard();
}

function markYou(entries: LeaderboardEntry[], me: string): void {
    const key = nameKey(me);
    if (!key) return;
    const avatar = ownAvatarUrl();
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (entry && nameKey(entry.name) === key) {
            entries[i] = { ...entry, you: true, avatar: avatar ?? entry.avatar };
            return;
        }
    }
}

export async function buildResultsLeaderboard(): Promise<void> {
    // Practice rounds aren't scored — no submit, no leaderboard.
    if (state.practice && !state.viewOnly) {
        setState({
            lbEntries: [],
            lbSubtitle: t('practiceRound'),
            lbNote: t('practiceNotSaved'),
            lbNoteKind: 'idle',
            personalResult: null,
        });
        return;
    }
    if (state.daily) {
        await buildDailyLeaderboard();
        return;
    }
    if (state.multiplayer) {
        buildRoomLeaderboard();
        return;
    }
    // A real round's results always show the mode just played; only the standalone
    // leaderboard view can repoint the board to another mode.
    if (!state.viewOnly) setState('lbViewMode', state.mode);

    const me = playerName();
    if (!supabaseConfigured()) {
        setState({
            lbSubtitle: t('comparison'),
            lbNote: '',
            lbNoteKind: 'idle',
            lbEntries: [
                {
                    id: -1,
                    name: me,
                    avatar: ownAvatarUrl(),
                    score: state.score,
                    rank: 1,
                    you: true,
                },
            ],
        });
        return;
    }

    setState({ lbNote: t('lbLoading'), lbNoteKind: 'idle' });
    try {
        const mode = state.lbViewMode;
        // Only submit a real score; browsing the board must not write a row.
        const inserted = state.score > 0 ? await submitScore(me, state.score, mode) : null;
        const [top, personalRank] = await Promise.all([
            fetchTopScores(mode, state.lbScope, 10),
            state.score > 0 ? fetchPersonalRank(mode, state.lbScope, state.score) : null,
        ]);

        const entries: LeaderboardEntry[] = top.map((row, index) => ({
            id: row.id,
            name: safeDisplayName(row.player),
            avatar: row.avatar ?? null,
            score: row.score,
            multiplayer: row.multiplayer === true,
            rank: index + 1,
            you: false,
        }));
        markYou(entries, me);

        if (state.score > 0 && !entries.some((entry) => entry.you)) {
            const byId = inserted ? entries.findIndex((e) => e.id === inserted.id) : -1;
            if (byId >= 0) {
                const found = entries[byId];
                if (found) entries[byId] = { ...found, you: true, avatar: ownAvatarUrl() };
            } else {
                entries.push({
                    id: -1,
                    name: me,
                    avatar: ownAvatarUrl(),
                    score: state.score,
                    rank: personalRank,
                    you: true,
                });
            }
        }

        setState({
            lbEntries: entries,
            lbSubtitle: `${t('globalLeaderboard')} · ${modeLabel(mode)}`,
            lbNote: t('lbOnline'),
            lbNoteKind: 'online',
            personalResult:
                state.score > 0
                    ? `${t('personalRank')}: ${personalRank ? `#${personalRank}` : '—'} · ${state.score} pts`
                    : null,
        });
    } catch (err) {
        console.error('Leaderboard error:', err);
        setState({ lbNote: t('lbOffline'), lbNoteKind: 'offline' });
    }
}

async function buildDailyLeaderboard(): Promise<void> {
    const me = playerName();
    setState('lbSubtitle', `${t('dailyChallenge')} · ${new Date().toISOString().slice(0, 10)}`);
    if (!supabaseConfigured()) {
        setState({ lbNote: '', lbNoteKind: 'idle', lbEntries: [] });
        return;
    }
    setState({ lbNote: t('lbLoading'), lbNoteKind: 'idle' });
    try {
        if (state.score > 0) {
            await submitDailyScore(me, state.score);
            markDailyDone();
        }
        const top = await fetchDailyTop(20);
        const entries: LeaderboardEntry[] = top.map((row, index) => ({
            id: row.id,
            name: safeDisplayName(row.player),
            avatar: row.avatar ?? null,
            score: row.score,
            rank: index + 1,
            you: false,
        }));
        markYou(entries, me);
        const mine = entries.find((entry) => entry.you);
        setState({
            lbEntries: entries,
            lbNote: t('lbOnline'),
            lbNoteKind: 'online',
            personalResult:
                state.score > 0
                    ? `${t('personalRank')}: ${mine?.rank ? `#${mine.rank}` : '—'} · ${state.score} pts`
                    : null,
        });
    } catch (err) {
        console.error('Daily leaderboard error:', err);
        setState({ lbNote: t('lbOffline'), lbNoteKind: 'offline' });
    }
}

function roomAvatarOf(player: RoomPlayer): string | null {
    if (player.id === mp.mpPlayerId()) {
        const own = ownAvatarUrl();
        if (own) return own;
    }
    const participant = discordActivity.participant(player.discord_user_id);
    if (participant?.avatar) {
        return `https://cdn.discordapp.com/avatars/${participant.id}/${participant.avatar}.png?size=64`;
    }
    return null;
}

function buildRoomLeaderboard(): void {
    const entries: LeaderboardEntry[] = mp
        .mpPlayers()
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
            id: index,
            name: safeDisplayName(player.name),
            avatar: roomAvatarOf(player),
            color: player.color,
            score: player.score,
            rank: index + 1,
            you: player.id === mp.mpPlayerId(),
        }));
    setState({
        lbEntries: entries,
        lbSubtitle: t('roomResults'),
        lbNote: '',
        lbNoteKind: 'idle',
        personalResult: null,
    });
}

/* ---------------- Standalone leaderboard views ---------------- */

export function viewLeaderboard(): void {
    clearTimer();
    clearAdvance();
    setState({
        score: 0,
        correct: 0,
        round: [],
        viewOnly: true,
        daily: false,
        practice: false,
        multiplayer: false,
        lbViewMode: state.mode,
    });
    void endGame();
}

export function viewDailyResults(): void {
    setState({
        score: 0,
        correct: 0,
        round: [],
        viewOnly: true,
        daily: true,
        practice: false,
        multiplayer: false,
    });
    void endGame();
}

/* ---------------- Challenges ---------------- */

export function applyChallenge(info: ChallengeInfo): void {
    if (info.mode) {
        setState('mode', info.mode);
        writeString(MODE_STORAGE_KEY, info.mode);
    }
    updateSettings({
        ...(info.difficulty ? { difficulty: info.difficulty } : {}),
        ...(info.questions ? { questions: info.questions } : {}),
    });
    setState({
        challenge: { score: info.score ?? 0, mode: info.mode ?? state.mode },
        challengeBanner: info,
    });
}

export function dismissChallenge(): void {
    setState({ challenge: null, challengeBanner: null });
}

export interface ChallengeVerdict {
    readonly won: boolean;
    readonly target: number;
}

/** The win/lose verdict for a round played against a friend's challenge. */
export const challengeVerdict = rootMemo<ChallengeVerdict | null>(() => {
    const challenge = state.challenge;
    const eligible =
        !state.viewOnly &&
        challenge !== null &&
        !state.multiplayer &&
        !state.practice &&
        !state.daily &&
        state.mode === challenge.mode;
    if (!eligible || !challenge) return null;
    const target = Math.max(0, Math.trunc(challenge.score));
    return { won: state.score > target, target };
});

/* ---------------- Multiplayer ---------------- */

export function roomSettings(): RoomSettings {
    const current = settings();
    return {
        questions: current.questions,
        difficulty: current.difficulty,
        timer: current.timer,
        feedbackDelay: current.feedbackDelay,
    };
}

export async function hostRoomFlow(): Promise<string | null> {
    if (!mp.multiplayerAvailable()) return t('mpNeedOnline');
    try {
        await loadAllBanks();
        await mp.hostRoom(state.mode, roomSettings(), playerName());
        setState({ multiplayer: true, viewOnly: false });
        showScreen('lobby');
        return null;
    } catch (err) {
        const message = `${t('mpHostFail')}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(message);
        return message;
    }
}

export async function joinRoomFlow(code: string): Promise<string | null> {
    try {
        await loadAllBanks();
        await mp.joinRoom(code, playerName());
        setState({ multiplayer: true, viewOnly: false, mpSyncKey: '' });
        const room = mp.mpRoom();
        if (room?.status === 'playing') handleMultiplayerUpdate(room, mp.mpPlayers());
        else showScreen('lobby');
        return null;
    } catch (err) {
        return `${t('mpJoinFail')}: ${err instanceof Error ? err.message : String(err)}`;
    }
}

export async function startRoomGame(): Promise<void> {
    const room = mp.mpRoom();
    const merged: RoomSettings = { ...roomSettings(), ...(room?.settings ?? {}) };
    const built = mp.buildRoundForRoom(state.allQuestions, room?.mode ?? state.mode, merged);
    setState('mpRoundLength', built.roundRefs.length);
    try {
        await mp.startRoom(built.roundRefs, built.answerKeys);
    } catch (err) {
        announce(err instanceof Error ? err.message : String(err));
    }
}

export async function leaveMultiplayer(): Promise<void> {
    await mp.leaveRoom();
    returnHome();
}

export function returnHome(): void {
    setState({
        multiplayer: false,
        mpResultsShown: false,
        mpSyncKey: '',
        mpStatus: null,
        spectator: false,
    });
    clearTimer();
    resetPresenceClock();
    showScreen('home');
    void selectMode(state.mode);
}

/** Host resets the room to its lobby; guests just go back and wait. */
export function multiplayerPlayAgain(): void {
    setState({ mpResultsShown: false, mpSyncKey: '' });
    if (mp.mpIsHost()) {
        void mp.restartRoom().catch((err: unknown) => {
            console.error(err);
            announce(err instanceof Error ? err.message : String(err));
        });
    } else {
        showScreen('lobby');
    }
}

function submitMultiplayerAnswer(chosen: string): void {
    // Spectators watch only — their picks never count.
    if (state.spectator) return;
    // Accept picks only while the question is open; the player MAY change their
    // answer as often as they like before the timer runs out.
    if (mp.mpRoom()?.phase !== 'question') return;
    setState({ answered: true, mpChosen: chosen, mpStatus: t('waitingOpponents') });
    void mp.submitAnswer(chosen, state.timeLeft).catch((err: unknown) => {
        console.error('submit_answer:', err);
    });
}

function startTimerFromServer(): void {
    clearTimer();
    lastTickSecond = -1;
    const tick = (): void => {
        const room = mp.mpRoom();
        if (!room?.question_ends_at) return;
        const left = mp.remainingSeconds(room);
        setState('timeLeft', left);
        if (room.phase === 'question') maybeCountdownBeep(left);
        if (left <= 0 && room.phase === 'question' && !state.answered) {
            onMultiplayerTimeout();
        }
    };
    tick();
    timerId = setInterval(tick, 200);
}

function onMultiplayerTimeout(): void {
    if (state.answered) return;
    const question = state.current;
    setState({ answered: true, mpStatus: t('waitingOpponents') });
    // A fill answer typed-but-not-submitted still counts on timeout.
    const finalAnswer =
        question?.style === 'fill' ? normalizeFillAnswer(state.mpChosen ?? '') : '';
    void mp.submitAnswer(finalAnswer, 0).catch((err: unknown) => {
        console.error('timeout submit:', err);
    });
}

function showMultiplayerQuestion(room: Room): void {
    const refs = room.round_refs ?? [];
    const ref = refs[room.question_index];
    if (!ref) return;
    const raw = mp.resolveQuestion(ref, state.allQuestions);
    if (!raw) return;

    clearTimer();
    clearAdvance();
    setState({
        answered: false,
        revealed: false,
        mpChosen: null,
        selectedAnswer: null,
        eliminated: [],
        feedback: null,
        showNextButton: false,
        revealChips: {},
        index: room.question_index,
        mpRoundLength: refs.length,
        current: normalizeQuestion(raw, ref.optionSeed),
        questionTime: ref.duration || timeForDifficulty(raw.difficulty),
        questionStartedAt: Date.now(),
        mpStatus: state.spectator ? t('spectating') : null,
    });
    syncHudFromRoom();
    startTimerFromServer();
}

async function showMultiplayerReveal(room: Room): Promise<void> {
    // If this question was never rendered (a dropped realtime update), sync first
    // — otherwise the reveal would run against a stale question.
    if (!state.current || state.index !== room.question_index) showMultiplayerQuestion(room);
    const question = state.current;
    if (!question) return;

    clearTimer();
    setState({ answered: true, revealed: true, mpStatus: null });

    const chosen = state.mpChosen ?? '';
    const correct =
        question.style === 'fill'
            ? isFillCorrect(question, chosen, true)
            : chosen === question.answer;

    if (state.spectator) {
        setState('feedback', {
            kind: 'good',
            headline: question.answer,
            explanation: question.explanation[locale()],
        });
    } else if (correct) {
        sfx.correct();
        setState('feedback', {
            kind: 'good',
            headline: t('correct'),
            explanation: question.explanation[locale()],
        });
    } else {
        sfx.wrong();
        const hadPick =
            question.style === 'fill' ? normalizeFillAnswer(chosen).length > 0 : chosen.length > 0;
        setState('feedback', {
            kind: 'bad',
            headline: `${hadPick ? t('wrong') : t('timeUp')} ${question.answer}.`,
            explanation: question.explanation[locale()],
        });
    }

    if (
        !state.spectator &&
        !state.roundHistory.some((item) => item.questionIndex === state.index)
    ) {
        recordRoundAnswer(question, chosen, correct, 0, chosen.length === 0);
    }

    // Show what every player picked, grouped per option.
    try {
        const answers = await mp.fetchAnswers(room.question_index);
        const grouped: Record<string, string[]> = {};
        for (const row of answers) {
            const bucket = grouped[row.answer];
            if (bucket) bucket.push(row.player_id);
            else grouped[row.answer] = [row.player_id];
        }
        setState('revealChips', grouped);
    } catch (err) {
        console.error('fetchAnswers:', err);
    }
}

function syncHudFromRoom(): void {
    const me = mp.localRoomPlayer();
    if (!me) return;
    setState({
        score: me.score,
        correct: me.correct,
        streak: me.streak,
        bestStreak: Math.max(state.bestStreak, me.streak),
    });
}

function showRoomResults(): void {
    const me = mp.localRoomPlayer();
    const total = state.mpRoundLength || (mp.mpRoom()?.round_refs ?? []).length;
    setState({
        score: me?.score ?? 0,
        correct: me?.correct ?? 0,
        mpRoundLength: total,
    });
    showScreen('results');
    buildRoomLeaderboard();

    if (!state.mpResultsShown) {
        sfx.finish();
        setState('mpResultsShown', true);
        registerMultiplayerScores();
        if (!state.spectator) {
            const seconds = state.gameStartMs ? (Date.now() - state.gameStartMs) / 1000 : 0;
            setState('gameStartMs', null);
            void recordPlay({
                player: playerName(),
                seconds,
                multiplayer: true,
                won: amIWinner(),
                xp: state.score,
                perfect: state.correct === total && total > 0,
            }).then(celebrateAchievements);
        }
    }
}

/**
 * Register every player's final score globally, flagged as a multiplayer result.
 * The host submits once for the whole room. Zero scores are skipped so a player
 * who scored nothing never creates a "— 0 pts" leaderboard entry.
 */
function registerMultiplayerScores(): void {
    if (!supabaseConfigured() || !mp.mpIsHost()) return;
    const mode = mp.mpRoom()?.mode ?? state.mode;
    const rows: readonly MpScoreRow[] = mp
        .mpPlayers()
        .filter((player) => player.score > 0 && !player.spectator)
        .map((player) => ({
            player: player.name,
            score: player.score,
            mode,
            multiplayer: true,
            avatar: roomAvatarOf(player),
        }));
    if (rows.length === 0) return;
    void submitMultiplayerScores(rows).catch((err: unknown) => {
        console.error('register mp scores:', err);
    });
}

export function handleMultiplayerUpdate(room: Room | null, _players: readonly RoomPlayer[]): void {
    if (!room) return;

    if (room.status === 'lobby') {
        // Fresh lobby, or back from a finished game. Everyone is a full player
        // again (spectator flags were cleared server-side).
        setState({
            multiplayer: true,
            mpSyncKey: '',
            mpResultsShown: false,
            spectator: false,
            roundHistory: [],
            bestStreak: 0,
            mpStatus: null,
        });
        clearTimer();
        if (state.screen !== 'lobby') showScreen('lobby');
        resetPresenceClock();
        return;
    }

    if (room.status === 'closed') {
        if (!state.multiplayer) return;
        mp.teardown();
        returnHome();
        return;
    }

    if (room.status === 'finished') {
        if (!state.multiplayer) return;
        clearTimer();
        setState('mpStatus', null);
        if (state.screen !== 'results') showRoomResults();
        else buildRoomLeaderboard();
        pushPresence();
        return;
    }

    // status === 'playing'
    setState({
        multiplayer: true,
        mpResultsShown: false,
        spectator: mp.amSpectator(),
    });
    if (!state.gameStartMs) setState('gameStartMs', Date.now());

    const key = `${room.question_index}|${room.phase}`;
    if (key !== state.mpSyncKey) {
        setState('mpSyncKey', key);
        if (state.screen !== 'game') showScreen('game');
        if (room.phase === 'question') showMultiplayerQuestion(room);
        else void showMultiplayerReveal(room);
        startPresenceClock();
    }
    syncHudFromRoom();
    pushPresence();
}

export function onMultiplayerKicked(): void {
    announce(t('mpKicked'));
    mp.teardown();
    returnHome();
}

/* ---------------- Discord Activity room flow ---------------- */

let autoJoinInFlight = false;

export async function autoJoinDiscordVoiceRoom(): Promise<boolean> {
    if (!discordActivity.active || !mp.multiplayerAvailable()) return false;
    if (autoJoinInFlight) return false;
    autoJoinInFlight = true;
    try {
        const instanceId = discordActivity.instanceId;
        const userId = discordActivity.user?.id;
        if (!instanceId || !userId) return false;
        await loadAllBanks();
        await mp.joinDiscordRoom(instanceId, state.mode, roomSettings(), playerName(), userId);
        setState({ multiplayer: true, viewOnly: false, mpSyncKey: '' });
        const room = mp.mpRoom();
        if (room?.status === 'playing') handleMultiplayerUpdate(room, mp.mpPlayers());
        else showScreen('lobby');
        return true;
    } catch (err) {
        console.error('Discord voice room join failed:', err);
        return false;
    } finally {
        autoJoinInFlight = false;
    }
}

/**
 * A member pressed "Ask to Join": Discord launches the Activity for them and
 * hands over the secret we published.
 */
export async function handleActivityJoin(secret: string | null): Promise<void> {
    const match = /^room:([A-Za-z0-9]{4})$/.exec(secret ?? '');
    if (!match?.[1]) return;
    const code = match[1].toUpperCase();
    if (mp.mpRoom()?.code === code) return;
    if (!mp.multiplayerAvailable()) return;
    const error = await joinRoomFlow(code);
    if (error) announce(t('joinRequestFailed'));
}

/* ---------------- Round statistics ---------------- */

export interface RoundStats {
    readonly accuracy: string;
    readonly bestStreak: string;
    readonly average: string;
    readonly fastest: string;
}

function formatSeconds(ms: number): string {
    return Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)}s` : '—';
}

export const roundStats = rootMemo<RoundStats>(() => {
    const history = state.roundHistory;
    const total = roundLength() || history.length;
    const answered = history.filter((item) => item.selectedAnswer.length > 0).length;
    const average =
        history.length > 0
            ? history.reduce((sum, item) => sum + item.responseTimeMs, 0) / history.length
            : Number.NaN;
    const correctTimes = history.filter((item) => item.correct).map((item) => item.responseTimeMs);
    return {
        accuracy: total > 0 ? `${Math.round((state.correct / total) * 100)}%` : '0%',
        bestStreak: String(state.bestStreak),
        average: answered > 0 ? formatSeconds(average) : '—',
        fastest: correctTimes.length > 0 ? formatSeconds(Math.min(...correctTimes)) : '—',
    };
});

export interface BreakdownRow {
    readonly key: string;
    readonly label: string;
    readonly pct: number;
    readonly correct: number;
    readonly total: number;
    readonly best: boolean;
    readonly worst: boolean;
}

/**
 * Per-category accuracy: by bank when the round mixed several banks (All /
 * daily), otherwise by difficulty.
 */
export const roundBreakdown = rootMemo<readonly BreakdownRow[]>(() => {
    const rows = state.roundHistory;
    if (rows.length === 0) return [];
    const banks = new Set(rows.map((row) => row.bank));
    const useBank = banks.size > 1;
    const groups = new Map<string, { correct: number; total: number }>();
    for (const row of rows) {
        const key = useBank ? row.bank : row.difficulty;
        const group = groups.get(key) ?? { correct: 0, total: 0 };
        group.total += 1;
        if (row.correct) group.correct += 1;
        groups.set(key, group);
    }
    if (groups.size < 2) return [];

    const entries = [...groups.entries()]
        .map(([key, group]) => ({
            key,
            label: useBank
                ? modeLabel(key as GameMode)
                : difficultyName(key as Difficulty),
            pct: Math.round((group.correct / group.total) * 100),
            correct: group.correct,
            total: group.total,
            best: false,
            worst: false,
        }))
        .sort((a, b) => b.pct - a.pct);

    const first = entries[0];
    const last = entries[entries.length - 1];
    return entries.map((entry) => ({
        ...entry,
        best: entry === first,
        worst: entry === last && first !== last,
    }));
});

function difficultyName(difficulty: Difficulty): string {
    return difficulty === 'easy' ? t('diffEasy') : difficulty === 'medium' ? t('diffMedium') : t('diffHard');
}

/* ---------------- Boot-time helpers ---------------- */

export function setBootLoading(value: boolean): void {
    setState('bootLoading', value);
}

export function setAuthError(message: string | null): void {
    setState('authError', message);
}

export function setSpectator(value: boolean): void {
    setState('spectator', value);
}

// Presence reads the live game state through this one-way hook, so the presence
// module never has to import the store (and create an import cycle).
configurePresence(() => ({
    screen: state.screen,
    mode: state.mode,
    score: state.score,
    index: state.index,
    roundLength: roundLength(),
    multiplayer: state.multiplayer,
    spectator: state.spectator,
    room: mp.mpRoom(),
    players: mp.mpPlayers(),
}));
