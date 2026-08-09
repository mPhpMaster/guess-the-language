import { For, Show, createMemo, createSignal, type Component } from 'solid-js';
import { difficultyLabel, modeLabel, t } from '../../i18n';
import { GAME_MODES, type GameMode, type RoomSettings } from '../../types/models';
import { discordActivity } from '../../lib/discord';
import { copyToClipboard } from '../../lib/platform';
import { safeDisplayName } from '../../lib/names';
import {
    kickPlayer,
    leaveRoom,
    mpIsHost,
    mpPlayerId,
    mpPlayers,
    mpRoom,
    updateRoomSettings,
} from '../../lib/multiplayer';
import {
    DIFFICULTY_FILTERS,
    FEEDBACK_DELAYS,
    QUESTION_COUNTS,
    TIMER_CHOICES,
    settings,
    updateSettings,
} from '../../lib/settings';
import {
    announce,
    endQuiz,
    leaveMultiplayer,
    returnHome,
    roomSettings,
    startRoomGame,
    state,
} from '../../state/game';
import { openRoomPlayerCard } from '../../state/ui';
import { Avatar, Button, Select, SettingRow, Toggle } from '../ui';
import { Copy, Crown, Play, UserPlus, UserX } from '../icons';

export const LobbyScreen: Component = () => {
    const [inviteNote, setInviteNote] = createSignal<string | null>(null);
    const room = (): ReturnType<typeof mpRoom> => mpRoom();
    const inDiscord = createMemo(() => discordActivity.active);

    const effective = createMemo<RoomSettings>(() => ({
        ...roomSettings(),
        ...(room()?.settings ?? {}),
    }));

    const push = (patch: Partial<RoomSettings>): void => {
        const next: RoomSettings = { ...effective(), ...patch };
        void updateRoomSettings(room()?.mode ?? state.mode, next).catch((err: unknown) => {
            announce(err instanceof Error ? err.message : String(err));
        });
    };

    const pushMode = (mode: GameMode): void => {
        void updateRoomSettings(mode, effective()).catch((err: unknown) => {
            announce(err instanceof Error ? err.message : String(err));
        });
    };

    const difficultySummary = (): string => {
        const difficulty = effective().difficulty;
        return difficulty === 'all' ? t('diffAll') : difficultyLabel(difficulty);
    };

    const timerSummary = (): string => {
        const timer = effective().timer;
        return timer === 'auto' ? t('timerAuto') : `${timer}s`;
    };

    const activeCount = (): number => mpPlayers().filter((player) => !player.spectator).length;
    const canStart = (): boolean =>
        mpIsHost() && room()?.status === 'lobby' && activeCount() >= (inDiscord() ? 1 : 2);

    const invite = async (): Promise<void> => {
        if (inDiscord()) {
            try {
                await discordActivity.openInviteDialog();
            } catch (err) {
                console.error('openInviteDialog failed:', err);
                setInviteNote(t('inviteFailed'));
            }
            return;
        }
        const code = room()?.code;
        if (!code) return;
        setInviteNote((await copyToClipboard(code)) ? t('inviteShareCode') : code);
    };

    return (
        <section class="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-16 pt-4">
            <h2 class="sr-only" tabIndex={-1}>
                {t('lobbyTitle')}
            </h2>

            <div class="rounded-2xl glass-panel p-5">
                <p class="text-center text-xs uppercase tracking-widest text-muted">
                    {inDiscord() ? t('discordVoiceRoom') : t('roomCode')}
                </p>
                <div class="mt-1 flex items-center justify-center gap-2">
                    <span class="font-mono text-3xl font-extrabold tracking-[0.35em] text-neon">
                        {inDiscord() ? t('discordVoiceRoomHint') : (room()?.code ?? '----')}
                    </span>
                    <Show when={!inDiscord() && room()?.code}>
                        <Button
                            size="sm"
                            icon={<Copy size={14} />}
                            onClick={() => {
                                void copyToClipboard(room()?.code ?? '').then((ok) => {
                                    if (ok) setInviteNote(t('codeCopied'));
                                });
                            }}
                        >
                            {t('copyCode')}
                        </Button>
                    </Show>
                </div>
                <p class="mt-2 text-center text-sm text-muted">
                    {modeLabel(room()?.mode ?? state.mode)} · {difficultySummary()} ·{' '}
                    {effective().questions} Q · {timerSummary()}
                </p>
            </div>

            <Show when={mpIsHost() && room()?.status === 'lobby'}>
                <div class="rounded-2xl glass-panel p-4">
                    <h4 class="mb-1 text-sm font-bold">{t('lobbySettings')}</h4>
                    <SettingRow label={t('changeMode')}>
                        <Select
                            value={room()?.mode ?? state.mode}
                            options={GAME_MODES.map((mode) => ({
                                value: mode,
                                label: modeLabel(mode),
                            }))}
                            onChange={pushMode}
                        />
                    </SettingRow>
                    <SettingRow label={t('settingQuestions')}>
                        <Select
                            value={String(effective().questions)}
                            options={QUESTION_COUNTS.map((count) => ({
                                value: String(count),
                                label: String(count),
                            }))}
                            onChange={(value) => {
                                const parsed = QUESTION_COUNTS.find((c) => String(c) === value);
                                if (parsed) push({ questions: parsed });
                            }}
                        />
                    </SettingRow>
                    <SettingRow label={t('settingDifficulty')}>
                        <Select
                            value={effective().difficulty}
                            options={DIFFICULTY_FILTERS.map((value) => ({
                                value,
                                label: value === 'all' ? t('diffAll') : difficultyLabel(value),
                            }))}
                            onChange={(value) => push({ difficulty: value })}
                        />
                    </SettingRow>
                    <SettingRow label={t('settingTimer')}>
                        <Select
                            value={String(effective().timer)}
                            options={TIMER_CHOICES.map((choice) => ({
                                value: String(choice),
                                label: choice === 'auto' ? t('timerAuto') : `${choice}s`,
                            }))}
                            onChange={(value) => {
                                const parsed = TIMER_CHOICES.find((c) => String(c) === value);
                                if (parsed !== undefined) push({ timer: parsed });
                            }}
                        />
                    </SettingRow>
                    <SettingRow label={t('settingFeedbackDelay')}>
                        <Select
                            value={String(effective().feedbackDelay)}
                            options={FEEDBACK_DELAYS.map((delay) => ({
                                value: String(delay),
                                label:
                                    delay === 'manual'
                                        ? t('feedbackManual')
                                        : delay === 2
                                          ? t('feedback2')
                                          : delay === 4
                                            ? t('feedback4')
                                            : t('feedback6'),
                            }))}
                            onChange={(value) => {
                                const parsed = FEEDBACK_DELAYS.find((d) => String(d) === value);
                                if (parsed !== undefined) push({ feedbackDelay: parsed });
                            }}
                        />
                    </SettingRow>
                    <SettingRow label={t('settingSound')}>
                        <Toggle
                            label={t('settingSound')}
                            checked={settings().sound}
                            onChange={(sound) => updateSettings({ sound })}
                        />
                    </SettingRow>
                </div>
            </Show>

            <div class="rounded-2xl glass-panel p-4">
                <h3 class="mb-2 text-sm font-bold">{t('playersTitle')}</h3>
                <div class="flex flex-col gap-1.5">
                    <For each={mpPlayers()}>
                        {(player) => (
                            <div
                                class={[
                                    'flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition',
                                    player.id === mpPlayerId()
                                        ? 'bg-neon/10'
                                        : 'hover:bg-white/6',
                                ].join(' ')}
                            >
                                <button
                                    type="button"
                                    class="flex min-w-0 flex-1 items-center gap-2 text-start"
                                    title={`${safeDisplayName(player.name)} — ${t('openPlayerCard')}`}
                                    onClick={() => openRoomPlayerCard(player)}
                                >
                                    <Avatar
                                        url={null}
                                        name={player.name}
                                        size={30}
                                        ring={player.color}
                                    />
                                    <span class="truncate text-sm">
                                        {safeDisplayName(player.name)}
                                        <Show when={player.id === mpPlayerId()}>
                                            {' '}
                                            <span class="text-muted">{t('you')}</span>
                                        </Show>
                                    </span>
                                    <Show when={player.is_host}>
                                        <span class="text-gold" title={t('adminBadge')}>
                                            <Crown size={14} />
                                        </span>
                                    </Show>
                                </button>
                                <span class="text-sm font-bold text-ink">{player.score}</span>
                                <Show when={mpIsHost() && !player.is_host && room()?.status === 'lobby'}>
                                    <button
                                        type="button"
                                        class="rounded-md p-1 text-muted hover:bg-bad/20 hover:text-bad"
                                        title={t('kickPlayer')}
                                        aria-label={t('kickPlayer')}
                                        onClick={() => {
                                            void kickPlayer(player.id).catch((err: unknown) =>
                                                console.error(err),
                                            );
                                        }}
                                    >
                                        <UserX size={15} />
                                    </button>
                                </Show>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            <Show when={!mpIsHost()}>
                <p class="text-center text-sm text-muted">{t('waitingHost')}</p>
            </Show>

            <div class="flex flex-col gap-2">
                <Show when={mpIsHost()}>
                    <Button
                        variant="primary"
                        block
                        icon={<Play size={17} />}
                        disabled={!canStart()}
                        onClick={() => void startRoomGame()}
                    >
                        {t('startGame')}
                    </Button>
                    <Button
                        block
                        onClick={() => {
                            if (room()?.status === 'lobby') void leaveMultiplayer();
                            else endQuiz();
                        }}
                    >
                        {t('endRoom')}
                    </Button>
                </Show>

                <Button block icon={<UserPlus size={16} />} onClick={() => void invite()}>
                    {inDiscord() ? t('inviteToRoom') : t('copyCode')}
                </Button>
                <Show when={inviteNote()}>
                    {(note) => <p class="text-center text-xs text-muted">{note()}</p>}
                </Show>

                <Button
                    block
                    onClick={() => {
                        void leaveRoom().then(returnHome);
                    }}
                >
                    {t('leaveRoom')}
                </Button>
            </div>
        </section>
    );
};
