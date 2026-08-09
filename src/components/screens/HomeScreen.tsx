import { For, Show, createMemo, type Component } from 'solid-js';
import { locale, modeDescription, modeLabel, setLocale, t } from '../../i18n';
import { GAME_MODES, type GameMode } from '../../types/models';
import {
    canPlay,
    discordProfile,
    isAdmin,
    isDiscordLinked,
    ownAvatarUrl,
    requiresDiscordLogin,
    startDiscordLogin,
} from '../../lib/identity';
import { discordActivity } from '../../lib/discord';
import { multiplayerAvailable } from '../../lib/multiplayer';
import { safeDisplayName } from '../../lib/names';
import {
    announce,
    currentHighScore,
    dailyAlreadyPlayed,
    dismissChallenge,
    hostRoomFlow,
    requireIdentity,
    selectMode,
    startDailyChallenge,
    startGame,
    startPractice,
    state,
    viewDailyResults,
    viewLeaderboard,
    enterDiscordLobby,
    setAuthError,
} from '../../state/game';
import { openProfileCard, showDialog } from '../../state/ui';
import { Avatar, Button } from '../ui';
import {
    CalendarDays,
    CircleAlert,
    GraduationCap,
    House,
    Info,
    Link,
    Lock,
    ModeIcon,
    Play,
    SettingsIcon,
    ShieldHalf,
    Trophy,
    Users,
    X,
} from '../icons';

const LanguageSwitch: Component = () => (
    <div class="flex gap-1">
        <For each={['en', 'ar'] as const}>
            {(code) => (
                <button
                    type="button"
                    onClick={() => setLocale(code)}
                    class={[
                        'rounded-md px-2 py-1 text-xs font-semibold transition',
                        locale() === code
                            ? 'bg-neon text-[#04121f]'
                            : 'glass-panel text-muted hover:text-ink',
                    ].join(' ')}
                >
                    {code === 'en' ? 'EN' : 'ع'}
                </button>
            )}
        </For>
    </div>
);

const ModeCard: Component<{ readonly mode: GameMode }> = (props) => {
    const selected = (): boolean => state.mode === props.mode;
    return (
        <button
            type="button"
            aria-pressed={selected()}
            onClick={() => void selectMode(props.mode)}
            class={[
                'flex h-full flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition',
                selected()
                    ? 'border border-neon/70 bg-neon/12 shadow-[0_0_0_1px_rgba(46,197,255,0.35),0_10px_30px_-12px_rgba(46,197,255,0.6)]'
                    : 'glass-panel hover:border-neon/40 hover:bg-white/6',
            ].join(' ')}
        >
            <span class={selected() ? 'text-neon' : 'text-muted'}>
                <ModeIcon mode={props.mode} size={26} />
            </span>
            <span class="text-[13px] font-bold text-ink">{modeLabel(props.mode)}</span>
            <span class="hidden text-[11px] leading-snug text-muted sm:block">
                {modeDescription(props.mode)}
            </span>
        </button>
    );
};

export const HomeScreen: Component = () => {
    const inDiscord = createMemo(() => discordActivity.active);
    const authLocked = createMemo(() => requiresDiscordLogin() && !isDiscordLinked());
    const mpReady = createMemo(() => multiplayerAvailable() && (canPlay() || authLocked()));

    const guarded = (run: () => void | Promise<unknown>): void => {
        setAuthError(null);
        if (!requireIdentity(() => showDialog('settings'))) return;
        void run();
    };

    const play = (): void => {
        guarded(async () => {
            const check = await startGame();
            if (!check.valid && check.message) {
                announce(check.message);
                setAuthError(check.message);
                showDialog('settings');
            }
        });
    };

    return (
        <section class="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-16 pt-4">
            <div class="mb-2 flex w-full items-center justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    icon={<Info size={15} />}
                    onClick={() => showDialog('about')}
                >
                    {t('aboutTitle')}
                </Button>
                <LanguageSwitch />
            </div>

            <h1 class="neon-text text-center text-3xl font-extrabold" tabIndex={-1}>
                {t('appTitle')}
            </h1>
            <p class="mb-3 text-sm text-muted">{t('homeSub')}</p>

            <Show when={state.challengeBanner}>
                {(info) => (
                    <div class="mb-3 flex w-full max-w-xl items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
                        <span class="flex-1">
                            {t('challengeBanner', {
                                score: info().score ?? 0,
                                mode: modeLabel(info().mode ?? state.mode),
                            })}
                        </span>
                        <button
                            type="button"
                            class="rounded p-1 hover:bg-white/10"
                            aria-label={t('challengeDismiss')}
                            title={t('challengeDismiss')}
                            onClick={dismissChallenge}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </Show>

            <Show when={discordProfile()}>
                {(profile) => (
                    <button
                        type="button"
                        class="mb-3 flex items-center gap-2 rounded-full glass-panel px-3 py-1.5 transition hover:border-neon/50"
                        onClick={() =>
                            openProfileCard({
                                name: profile().name,
                                avatar: ownAvatarUrl(),
                                you: true,
                            })
                        }
                    >
                        <Avatar url={ownAvatarUrl()} name={profile().name} size={28} />
                        <span class="text-sm font-semibold">{safeDisplayName(profile().name)}</span>
                    </button>
                )}
            </Show>

            <Show when={authLocked()}>
                <p class="mb-3 max-w-md text-center text-xs text-muted">{t('webAuthHint')}</p>
            </Show>

            <Show when={state.authError}>
                {(message) => (
                    <div
                        role="alert"
                        class="mb-3 flex items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad"
                    >
                        <CircleAlert size={16} />
                        <span>{message()}</span>
                        <button
                            type="button"
                            class="underline"
                            onClick={() => startDiscordLogin()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                )}
            </Show>

            <div
                class="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
                role="group"
                aria-label={t('modeSelectTitle')}
            >
                <For each={GAME_MODES}>{(mode) => <ModeCard mode={mode} />}</For>
            </div>

            <div class="mt-5 flex w-full max-w-md flex-col items-center gap-2.5">
                <Button
                    variant="primary"
                    size="lg"
                    block
                    icon={authLocked() ? <Lock size={18} /> : <Play size={18} />}
                    disabled={!authLocked() && (state.questionsLoading || state.allQuestions.length === 0)}
                    onClick={() => (authLocked() ? startDiscordLogin() : play())}
                >
                    {authLocked()
                        ? t('loginDiscordToPlay')
                        : state.questionsLoading
                          ? t('loading')
                          : state.questionsFailed
                            ? t('loadFail')
                            : t('start')}
                </Button>

                <Button
                    variant="daily"
                    block
                    icon={<CalendarDays size={17} />}
                    onClick={() =>
                        guarded(() =>
                            dailyAlreadyPlayed() ? viewDailyResults() : startDailyChallenge(),
                        )
                    }
                >
                    {dailyAlreadyPlayed() ? t('dailyPlayed') : t('dailyChallenge')}
                </Button>

                <Show
                    when={!inDiscord()}
                    fallback={
                        <>
                            <p class="text-center text-xs text-muted">
                                {multiplayerAvailable()
                                    ? t('discordCreateHint')
                                    : t('discordMpUnavailable')}
                            </p>
                            <Show when={multiplayerAvailable()}>
                                <Button
                                    variant="primary"
                                    block
                                    icon={<Link size={17} />}
                                    disabled={!canPlay()}
                                    onClick={() => guarded(() => enterDiscordLobby())}
                                >
                                    {t('joinRoom')}
                                </Button>
                            </Show>
                        </>
                    }
                >
                    <div class="flex w-full gap-2">
                        <Button
                            block
                            icon={<House size={16} />}
                            disabled={!mpReady()}
                            title={mpReady() ? undefined : t('mpNeedOnline')}
                            onClick={() =>
                                guarded(async () => {
                                    const error = await hostRoomFlow();
                                    if (error) setAuthError(error);
                                })
                            }
                        >
                            {t('hostRoom')}
                        </Button>
                        <Button
                            block
                            icon={<Link size={16} />}
                            disabled={!mpReady()}
                            title={mpReady() ? undefined : t('mpNeedOnline')}
                            onClick={() => guarded(() => showDialog('join'))}
                        >
                            {t('joinRoom')}
                        </Button>
                    </div>
                </Show>

                <div class="flex w-full flex-wrap justify-center gap-2">
                    <Button
                        size="sm"
                        icon={<GraduationCap size={15} />}
                        onClick={() => guarded(() => startPractice())}
                    >
                        {t('practiceMode')}
                    </Button>
                    <Button size="sm" icon={<Trophy size={15} />} onClick={viewLeaderboard}>
                        {t('globalLeaderboard')}
                    </Button>
                    <Button
                        size="sm"
                        icon={<SettingsIcon size={15} />}
                        onClick={() => showDialog('settings')}
                    >
                        {t('settings')}
                    </Button>
                    <Show when={isAdmin()}>
                        <Button
                            size="sm"
                            variant="danger"
                            icon={<ShieldHalf size={15} />}
                            onClick={() => showDialog('admin')}
                        >
                            {t('adminButton')}
                        </Button>
                    </Show>
                </div>
            </div>

            <p class="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <Users size={13} />
                {t('bestScore')} <strong class="text-ink">{currentHighScore()}</strong>
            </p>
        </section>
    );
};
