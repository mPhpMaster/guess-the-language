import {
    For,
    Show,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    type Component,
} from 'solid-js';
import { locale, modeLabel, t } from '../../i18n';
import { GAME_MODES, type GameMode, type LeaderboardEntry } from '../../types/models';
import { discordActivity } from '../../lib/discord';
import { appSessionToken, isAdmin, playerName } from '../../lib/identity';
import { supabaseConfigured } from '../../lib/supabase';
import { copyToClipboard } from '../../lib/platform';
import { settings } from '../../lib/settings';
import {
    buildChallengePayload,
    buildChallengeUrl,
    challengeMessage,
} from '../../lib/challenge';
import { renderShareCard } from '../../lib/share';
import {
    challengeVerdict,
    leaveMultiplayer,
    multiplayerPlayAgain,
    roundBreakdown,
    roundLength,
    roundStats,
    setLeaderboardMode,
    setLeaderboardScope,
    showScreen,
    startDailyChallenge,
    startGame,
    startPractice,
    state,
} from '../../state/game';
import { openProfileCard, openReportDialog, showShareCard } from '../../state/ui';
import { Avatar, Button, Select } from '../ui';
import {
    Camera,
    ChevronLeft,
    Flag,
    House,
    Link,
    RankBadge,
    RotateCw,
    Trophy,
    Users,
} from '../icons';

const COUNT_UP_MS = 900;

const CountUp: Component<{ readonly value: number }> = (props) => {
    const [shown, setShown] = createSignal(props.value);
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | null = null;

    createEffect(() => {
        const target = props.value;
        cancelAnimationFrame(frame);
        if (settle) clearTimeout(settle);

        // A backgrounded tab never fires rAF, which would leave the headline stuck
        // on the starting value — show the real score straight away instead.
        if (document.hidden) {
            setShown(target);
            return;
        }

        setShown(0);
        const start = performance.now();
        const tick = (now: number): void => {
            const progress = Math.min(1, (now - start) / COUNT_UP_MS);
            setShown(Math.round(target * (1 - (1 - progress) ** 3)));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        // Belt and braces: land on the exact value even if the frames stop coming.
        settle = setTimeout(() => setShown(target), COUNT_UP_MS + 120);
    });

    onCleanup(() => {
        cancelAnimationFrame(frame);
        if (settle) clearTimeout(settle);
    });

    return <>{shown()}</>;
};

const LeaderboardRow: Component<{ readonly entry: LeaderboardEntry; readonly index: number }> = (
    props,
) => {
    const max = createMemo(() => Math.max(...state.lbEntries.map((e) => e.score), 1));
    const width = (): string => `${30 + 70 * (props.entry.score / max())}%`;
    const canReport = (): boolean =>
        supabaseConfigured() &&
        !props.entry.you &&
        props.entry.id > 0 &&
        appSessionToken() !== null;

    return (
        <div
            role="listitem"
            class={[
                'flex items-center gap-2 rounded-xl p-1.5 transition',
                props.entry.you ? 'bg-neon/10' : 'hover:bg-white/5',
            ].join(' ')}
        >
            <span class="w-6 shrink-0 text-center text-sm font-bold text-muted">
                {props.entry.rank ?? props.index + 1}
            </span>
            <Avatar
                url={props.entry.avatar}
                name={props.entry.name}
                size={32}
                ring={props.entry.color ?? null}
            />
            <button
                type="button"
                class="relative min-w-0 flex-1 overflow-hidden rounded-lg text-start"
                disabled={!supabaseConfigured()}
                title={`${props.entry.name} — ${t('openPlayerCard')}`}
                onClick={() =>
                    openProfileCard({
                        name: props.entry.name,
                        avatar: props.entry.avatar,
                        you: props.entry.you,
                    })
                }
            >
                <span class="absolute inset-0 rounded-lg bg-white/5" />
                <span
                    class="absolute inset-y-0 start-0 rounded-lg bg-gradient-to-r from-neon/45 to-neon/10 transition-all duration-700"
                    style={{ width: width() }}
                />
                <span class="relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm">
                    <Show when={props.index < 3}>
                        <RankBadge rank={props.index + 1} />
                    </Show>
                    <span class="truncate font-semibold">{props.entry.name}</span>
                    <span class="text-muted">— {props.entry.score} pts</span>
                    <Show when={props.entry.multiplayer}>
                        <span class="text-muted" title={t('multiplayerScore')}>
                            <Users size={13} />
                        </span>
                    </Show>
                    <Show when={props.entry.you}>
                        <span class="text-neon">{t('you')}</span>
                    </Show>
                </span>
            </button>
            <Show when={canReport() || isAdmin()}>
                <button
                    type="button"
                    class="rounded-md p-1 text-muted hover:text-bad"
                    title={t('report')}
                    aria-label={t('report')}
                    onClick={() => openReportDialog(props.entry)}
                >
                    <Flag size={14} />
                </button>
            </Show>
        </div>
    );
};

export const ResultsScreen: Component = () => {
    const [challengeLink, setChallengeLink] = createSignal<string | null>(null);
    const [busy, setBusy] = createSignal(false);
    const verdict = createMemo(() => challengeVerdict());

    const shareChallenge = async (): Promise<void> => {
        const payload = buildChallengePayload(
            state.mode,
            settings().difficulty,
            settings().questions,
            state.score,
        );
        const url = buildChallengeUrl(payload);
        setChallengeLink(url);
        if (discordActivity.active) {
            const result = await discordActivity.shareLink(
                `${challengeMessage(state.score)}\n${url}`,
                payload,
            );
            if (result?.didSendMessage === true || result?.didCopyLink === true) return;
        }
        await copyToClipboard(url);
    };

    const shareCard = async (): Promise<void> => {
        setBusy(true);
        try {
            const card = await renderShareCard({
                heading: state.daily ? t('dailyChallenge') : modeLabel(state.mode),
                score: state.score,
                correct: state.correct,
                total: roundLength(),
                playerName: playerName(),
            });
            showShareCard(card);
        } finally {
            setBusy(false);
        }
    };

    const replay = (): void => {
        if (state.multiplayer) multiplayerPlayAgain();
        else if (state.daily) void startDailyChallenge();
        else if (state.practice) void startPractice();
        else void startGame();
    };

    const incorrect = createMemo(() => state.roundHistory.filter((item) => !item.correct));

    return (
        <section class="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-16 pt-4">
            <div class="rounded-2xl glass-panel p-5 text-center">
                <span class="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-gold/15 text-gold">
                    <Trophy size={28} />
                </span>

                <Show when={verdict()}>
                    {(result) => (
                        <div
                            role="status"
                            class={[
                                'mb-3 rounded-xl border px-3 py-2.5',
                                result().won
                                    ? 'border-good/45 bg-good/10'
                                    : 'border-bad/45 bg-bad/10',
                            ].join(' ')}
                        >
                            <p class="font-extrabold">
                                {result().won ? t('challengeWon') : t('challengeLost')}
                            </p>
                            <p class="mt-1 text-sm text-muted">
                                {t(result().won ? 'challengeWonSub' : 'challengeLostSub', {
                                    you: state.score,
                                    target: result().target,
                                })}
                            </p>
                        </div>
                    )}
                </Show>

                <Show when={!state.viewOnly}>
                    <h2 class="text-2xl font-extrabold" tabIndex={-1}>
                        {t('finalScore')}{' '}
                        <span class="neon-text">
                            <CountUp value={state.score} />
                        </span>
                    </h2>
                    <p class="text-sm text-muted">
                        {t('correctLabel')} {state.correct}/{roundLength()}
                    </p>

                    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <For
                            each={[
                                { label: t('statAccuracy'), value: roundStats().accuracy },
                                { label: t('statStreak'), value: roundStats().bestStreak },
                                { label: t('statAverage'), value: roundStats().average },
                                { label: t('statFastest'), value: roundStats().fastest },
                            ]}
                        >
                            {(cell) => (
                                <div class="rounded-xl bg-white/5 px-2 py-2">
                                    <strong class="block text-lg">{cell.value}</strong>
                                    <span class="text-[11px] text-muted">{cell.label}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>

                <Show when={roundBreakdown().length > 0 && !state.viewOnly}>
                    <div class="mt-4 text-start">
                        <p class="mb-1.5 text-sm font-bold">{t('breakdownTitle')}</p>
                        <div class="flex flex-col gap-1">
                            <For each={roundBreakdown()}>
                                {(row) => (
                                    <div class="flex items-center gap-2 text-xs">
                                        <span class="w-28 shrink-0 truncate text-muted">
                                            {row.label}
                                        </span>
                                        <span class="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                                            <span
                                                class={[
                                                    'absolute inset-y-0 start-0 rounded-full',
                                                    row.best
                                                        ? 'bg-good'
                                                        : row.worst
                                                          ? 'bg-bad'
                                                          : 'bg-neon',
                                                ].join(' ')}
                                                style={{ width: `${row.pct}%` }}
                                            />
                                        </span>
                                        <span class="w-10 text-end text-muted">
                                            {row.correct}/{row.total}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                <Show when={state.personalResult}>
                    {(text) => <p class="mt-3 text-sm text-neon">{text()}</p>}
                </Show>
            </div>

            <div class="rounded-2xl glass-panel p-4">
                <p class="mb-2 text-center text-sm font-bold">
                    {state.lbSubtitle || t('comparison')}
                </p>

                <Show when={supabaseConfigured() && !state.daily && !state.multiplayer}>
                    <div class="mb-2 flex justify-center gap-1" role="group">
                        <For each={['all', 'week'] as const}>
                            {(scope) => (
                                <button
                                    type="button"
                                    onClick={() => setLeaderboardScope(scope)}
                                    class={[
                                        'rounded-lg px-2.5 py-1 text-xs transition',
                                        state.lbScope === scope
                                            ? 'bg-neon text-[#04121f] font-bold'
                                            : 'glass-panel text-muted',
                                    ].join(' ')}
                                >
                                    {scope === 'all' ? t('scopeAllTime') : t('scopeWeek')}
                                </button>
                            )}
                        </For>
                    </div>
                </Show>

                <Show when={state.viewOnly && supabaseConfigured() && !state.daily}>
                    <div class="mb-2 flex items-center justify-center gap-2 text-xs text-muted">
                        <span>{t('leaderboardFor')}</span>
                        <Select
                            value={state.lbViewMode}
                            options={GAME_MODES.map((mode) => ({
                                value: mode,
                                label: modeLabel(mode),
                            }))}
                            onChange={(mode: GameMode) => setLeaderboardMode(mode)}
                        />
                    </div>
                </Show>

                <Show when={state.lbNote}>
                    {(note) => (
                        <p
                            role="status"
                            aria-live="polite"
                            class={[
                                'mb-2 text-center text-xs',
                                state.lbNoteKind === 'offline'
                                    ? 'text-bad'
                                    : state.lbNoteKind === 'online'
                                      ? 'text-neon-2'
                                      : 'text-muted',
                            ].join(' ')}
                        >
                            {note()}
                        </p>
                    )}
                </Show>

                <div role="list" class="flex flex-col gap-1">
                    <For each={state.lbEntries}>
                        {(entry, index) => <LeaderboardRow entry={entry} index={index()} />}
                    </For>
                </div>
            </div>

            <Show when={!state.viewOnly}>
                <details class="rounded-2xl glass-panel p-4">
                    <summary class="cursor-pointer text-sm font-bold">{t('reviewAnswers')}</summary>
                    <Show
                        when={incorrect().length > 0}
                        fallback={<p class="mt-2 text-sm text-muted">{t('noIncorrect')}</p>}
                    >
                        <div class="mt-2 flex flex-col gap-3">
                            <For each={incorrect()}>
                                {(item, index) => (
                                    <article class="rounded-xl bg-white/4 p-3">
                                        <h4 class="text-sm font-semibold" dir="auto">
                                            {index() + 1}. {item.prompt || item.panelText}
                                        </h4>
                                        <pre class="scrollbar-slim mt-1 overflow-x-auto rounded-lg bg-black/30 p-2 font-mono text-xs text-muted">
                                            {item.panelText || item.prompt}
                                        </pre>
                                        <p class="mt-1 text-xs">
                                            <span class="text-bad">
                                                {t('yourAnswer')}: {item.selectedAnswer || '—'}
                                            </span>
                                            {' · '}
                                            <span class="text-good">
                                                {t('correctAnswer')}: {item.correctAnswer}
                                            </span>
                                        </p>
                                        <p class="mt-1 text-xs text-muted" dir="auto">
                                            {item.explanation[locale()]}
                                        </p>
                                    </article>
                                )}
                            </For>
                        </div>
                    </Show>
                </details>
            </Show>

            <div class="flex flex-col gap-2">
                <Show when={!state.viewOnly && !state.multiplayer}>
                    <Button
                        variant="primary"
                        block
                        icon={<Link size={16} />}
                        onClick={() => void shareChallenge()}
                    >
                        {verdict() ? t('challengeBack') : t('challenge')}
                    </Button>
                    <Show when={challengeLink()}>
                        {(url) => (
                            <input
                                readOnly
                                value={url()}
                                aria-label={t('challenge')}
                                class="rounded-lg border border-white/12 bg-bg-1 px-2 py-1.5 text-xs text-muted"
                            />
                        )}
                    </Show>
                    <Button
                        block
                        icon={<Camera size={16} />}
                        disabled={busy()}
                        onClick={() => void shareCard()}
                    >
                        {t('shareResult')}
                    </Button>
                </Show>

                <Show when={!state.viewOnly}>
                    <Button variant="accent" block icon={<RotateCw size={16} />} onClick={replay}>
                        {state.multiplayer ? t('backToLobby') : t('replay')}
                    </Button>
                </Show>

                <Button
                    block
                    icon={state.multiplayer ? <ChevronLeft size={16} /> : <House size={16} />}
                    onClick={() => {
                        if (state.multiplayer) void leaveMultiplayer();
                        else showScreen('home');
                    }}
                >
                    {state.multiplayer ? t('leaveRoom') : t('backMenu')}
                </Button>
            </div>
        </section>
    );
};
