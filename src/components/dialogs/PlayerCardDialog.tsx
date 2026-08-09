import { For, Show, createMemo, createResource, createSignal, type Component } from 'solid-js';
import { modeLabel, t } from '../../i18n';
import type { ModeRanking, PlayerAggregate, PlayerStatsRow, RoomPlayer } from '../../types/models';
import { safeDisplayName } from '../../lib/names';
import { isAdmin, participantAvatarUrl, ownAvatarUrl, playerName } from '../../lib/identity';
import { supabaseConfigured } from '../../lib/supabase';
import { discordActivity } from '../../lib/discord';
import { copyToClipboard } from '../../lib/platform';
import { adminApi } from '../../lib/admin';
import {
    fetchFollowedPlayers,
    fetchPlayerAggregate,
    fetchPlayerRankings,
    fetchPlayerStats,
    followPlayer,
    isFollowing,
    isRecentlyActive,
    loadFollows,
    unfollowPlayer,
    type FollowedPlayer,
} from '../../lib/profile';
import {
    ACHIEVEMENTS,
    formatNumber,
    levelFromXp,
    levelTitle,
    xpForLevel,
} from '../../lib/progression';
import { makeHost, mpIsHost, mpPlayerId, mpRoom } from '../../lib/multiplayer';
import { buildResultsLeaderboard, state } from '../../state/game';
import { closePlayerCard, openProfileCard, playerCard } from '../../state/ui';
import { AchievementIcon, Check, Crown, Medal, RankBadge, UserPlus } from '../icons';
import { Avatar, Button } from '../ui';

interface ProfileBundle {
    readonly aggregate: PlayerAggregate;
    readonly stats: PlayerStatsRow | null;
    readonly rankings: readonly ModeRanking[];
    readonly following: readonly FollowedPlayer[];
}

async function loadProfile(input: {
    readonly name: string;
    readonly you: boolean;
}): Promise<ProfileBundle> {
    const [aggregate, stats, rankings] = await Promise.all([
        fetchPlayerAggregate(input.name),
        fetchPlayerStats(input.name),
        fetchPlayerRankings(input.name),
    ]);
    const following = input.you ? await fetchFollowedPlayers(playerName()) : [];
    return { aggregate, stats, rankings, following };
}

const LevelBar: Component<{ readonly stats: PlayerStatsRow | null }> = (props) => {
    const xp = (): number => props.stats?.xp ?? 0;
    const level = (): number => props.stats?.level ?? levelFromXp(xp());
    const base = (): number => xpForLevel(level());
    const span = (): number => Math.max(1, xpForLevel(level() + 1) - base());
    const pct = (): number =>
        Math.max(0, Math.min(100, Math.round(((xp() - base()) / span()) * 100)));

    return (
        <div class="rounded-xl bg-white/5 p-3">
            <div class="flex items-center gap-2 text-sm">
                <span class="rounded-md bg-neon/20 px-2 py-0.5 font-bold text-neon">
                    {t('levelShort')} {level()}
                </span>
                <span class="text-muted">{levelTitle(level())}</span>
                <Show when={(props.stats?.day_streak ?? 0) >= 2}>
                    <span class="ms-auto text-gold" title={t('dayStreak')}>
                        {props.stats?.day_streak}
                    </span>
                </Show>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div class="h-full rounded-full bg-neon" style={{ width: `${pct()}%` }} />
            </div>
            <p class="mt-1 text-[11px] text-muted">
                {formatNumber(Math.max(0, xp() - base()))} / {formatNumber(span())} XP
            </p>
        </div>
    );
};

export const PlayerCardDialog: Component = () => {
    const [error, setError] = createSignal<string | null>(null);
    const [followTick, setFollowTick] = createSignal(0);

    const target = (): ReturnType<typeof playerCard> => playerCard();

    const name = createMemo(() => {
        const card = target();
        if (!card) return '';
        return card.kind === 'room' ? card.player.name : card.name;
    });

    const isYou = createMemo(() => {
        const card = target();
        if (!card) return false;
        return card.kind === 'room' ? card.player.id === mpPlayerId() : card.you;
    });

    /** The room row is re-read from the live roster so scores stay current. */
    const roomPlayer = createMemo<RoomPlayer | null>(() => {
        const card = target();
        return card?.kind === 'room' ? card.player : null;
    });

    const avatarUrl = createMemo(() => {
        const card = target();
        if (!card) return null;
        if (card.kind === 'room') return participantAvatarUrl(card.player.discord_user_id);
        return card.avatar ?? (card.you ? ownAvatarUrl() : null);
    });

    const [profile] = createResource(
        () =>
            target() && supabaseConfigured()
                ? ({ name: safeDisplayName(name()), you: isYou() } as const)
                : undefined,
        loadProfile,
    );

    void loadFollows(playerName());

    const toggleFollow = async (): Promise<void> => {
        const me = playerName();
        if (isFollowing(name())) await unfollowPlayer(me, name());
        else await followPlayer(me, name());
        setFollowTick((value) => value + 1);
    };

    const canPromote = createMemo(() => {
        const player = roomPlayer();
        return (
            player !== null &&
            mpIsHost() &&
            !isYou() &&
            !player.is_host &&
            !player.spectator &&
            mpRoom()?.status === 'lobby'
        );
    });

    const roundInfo = createMemo(() => {
        const room = mpRoom();
        const total = (room?.round_refs ?? []).length;
        if (!room || total === 0 || room.status === 'lobby') return '—';
        const current = Math.min((room.question_index ?? 0) + 1, total);
        return `${room.status === 'finished' ? total : current} / ${total}`;
    });

    const statusLabel = (player: RoomPlayer): string => {
        const room = mpRoom();
        if (room?.status === 'finished') return t('statusFinished');
        if (player.spectator) return t('statusSpectating');
        if (room?.status === 'playing') return t('statusPlaying');
        return t('statusLobby');
    };

    const invite = async (): Promise<void> => {
        if (discordActivity.active) {
            try {
                await discordActivity.openInviteDialog();
            } catch {
                setError(t('inviteFailed'));
            }
            return;
        }
        const code = mpRoom()?.code;
        if (code) await copyToClipboard(code);
    };

    const runAdmin = async (action: 'ban' | 'reset_profile'): Promise<void> => {
        try {
            await adminApi(action, { player: name(), reason: 'admin' });
            closePlayerCard();
            if (state.screen === 'results') void buildResultsLeaderboard();
        } catch {
            setError(t('adminError'));
        }
    };

    return (
        <Show when={target()}>
            {(card) => (
                <div
                    class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closePlayerCard();
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={card().kind === 'room' ? t('playerCardTitle') : t('profileTitle')}
                        class="scrollbar-slim my-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-panel/95 p-5"
                    >
                        <div class="flex items-center gap-3">
                            <Avatar
                                url={avatarUrl()}
                                name={name()}
                                size={52}
                                ring={roomPlayer()?.color ?? null}
                            />
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-lg font-bold">
                                    {safeDisplayName(name())}
                                    <Show when={isYou()}>
                                        <span class="ms-1 text-sm text-muted">{t('you')}</span>
                                    </Show>
                                </p>
                                <p class="text-xs text-muted">
                                    {card().kind === 'room' ? t('playerCardHint') : t('profileHint')}
                                </p>
                            </div>
                            <Show when={roomPlayer()?.is_host}>
                                <span class="text-gold" title={t('adminBadge')}>
                                    <Crown size={18} />
                                </span>
                            </Show>
                        </div>

                        <Show when={roomPlayer()}>
                            {(player) => (
                                <dl class="mt-3 grid grid-cols-2 gap-1.5 text-sm">
                                    <For
                                        each={[
                                            {
                                                label: t('playerCardMode'),
                                                value: modeLabel(mpRoom()?.mode ?? state.mode),
                                            },
                                            { label: t('playerCardRound'), value: roundInfo() },
                                            {
                                                label: t('playerCardScore'),
                                                value: String(player().score),
                                            },
                                            {
                                                label: t('playerCardCorrect'),
                                                value: String(player().correct),
                                            },
                                            {
                                                label: t('playerCardStreak'),
                                                value: String(player().streak),
                                            },
                                            {
                                                label: t('playerCardStatus'),
                                                value: statusLabel(player()),
                                            },
                                        ]}
                                    >
                                        {(cell) => (
                                            <div class="rounded-lg bg-white/5 px-2 py-1.5">
                                                <dt class="text-[11px] text-muted">{cell.label}</dt>
                                                <dd class="font-semibold">{cell.value}</dd>
                                            </div>
                                        )}
                                    </For>
                                </dl>
                            )}
                        </Show>

                        <Show when={profile()}>
                            {(bundle) => (
                                <>
                                    <div class="mt-3">
                                        <LevelBar stats={bundle().stats} />
                                    </div>

                                    <Show when={bundle().stats?.last_seen}>
                                        {(seen) => (
                                            <p
                                                class={[
                                                    'mt-2 text-xs',
                                                    isRecentlyActive(seen())
                                                        ? 'text-good'
                                                        : 'text-muted',
                                                ].join(' ')}
                                            >
                                                {isRecentlyActive(seen())
                                                    ? t('online')
                                                    : `${t('lastSeen')}: ${new Date(seen()).toLocaleString()}`}
                                            </p>
                                        )}
                                    </Show>

                                    <div class="mt-3 grid grid-cols-4 gap-1.5 text-center">
                                        <For
                                            each={[
                                                {
                                                    label: t('statBest'),
                                                    value: formatNumber(bundle().aggregate.best),
                                                },
                                                {
                                                    label: t('statGames'),
                                                    value: formatNumber(bundle().aggregate.games),
                                                },
                                                {
                                                    label: t('statWinRate'),
                                                    value:
                                                        (bundle().stats?.mp_games ?? 0) > 0
                                                            ? `${Math.round(
                                                                  ((bundle().stats?.wins ?? 0) /
                                                                      (bundle().stats?.mp_games ??
                                                                          1)) *
                                                                      100,
                                                              )}%`
                                                            : '—',
                                                },
                                                {
                                                    label: t('statHours'),
                                                    value: `${((bundle().stats?.seconds ?? 0) / 3600).toFixed(1)}h`,
                                                },
                                                {
                                                    label: t('statAvg'),
                                                    value: formatNumber(bundle().aggregate.avg),
                                                },
                                                {
                                                    label: t('statMp'),
                                                    value: formatNumber(
                                                        bundle().stats?.mp_games ??
                                                            bundle().aggregate.mp,
                                                    ),
                                                },
                                                {
                                                    label: t('statPerfect'),
                                                    value: formatNumber(
                                                        bundle().stats?.perfect_games ?? 0,
                                                    ),
                                                },
                                                {
                                                    label: t('statTotal'),
                                                    value: formatNumber(bundle().aggregate.total),
                                                },
                                            ]}
                                        >
                                            {(cell) => (
                                                <div class="rounded-lg bg-white/5 px-1 py-1.5">
                                                    <strong class="block text-sm">
                                                        {cell.value}
                                                    </strong>
                                                    <span class="text-[10px] text-muted">
                                                        {cell.label}
                                                    </span>
                                                </div>
                                            )}
                                        </For>
                                    </div>

                                    <div class="mt-3">
                                        <p class="mb-1.5 text-sm font-bold">
                                            {t('achievementsTitle')} ·{' '}
                                            {(bundle().stats?.achievements ?? []).length}/
                                            {ACHIEVEMENTS.length}
                                        </p>
                                        <div class="grid grid-cols-6 gap-1.5">
                                            <For each={ACHIEVEMENTS}>
                                                {(achievement) => {
                                                    const earned = (): boolean =>
                                                        (
                                                            bundle().stats?.achievements ?? []
                                                        ).includes(achievement.id);
                                                    return (
                                                        <div
                                                            title={t(achievement.labelKey)}
                                                            class={[
                                                                'grid aspect-square place-items-center rounded-lg',
                                                                earned()
                                                                    ? 'bg-gold/20 text-gold'
                                                                    : 'bg-white/5 text-muted/40',
                                                            ].join(' ')}
                                                        >
                                                            <AchievementIcon
                                                                iconKey={achievement.iconKey}
                                                                size={18}
                                                            />
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>

                                    <div class="mt-3">
                                        <p class="mb-1.5 text-sm font-bold">{t('rankingsTitle')}</p>
                                        <Show
                                            when={bundle().rankings.some((r) => r.best !== null)}
                                            fallback={
                                                <p class="text-xs text-muted">{t('noRankings')}</p>
                                            }
                                        >
                                            <div class="flex flex-col gap-1">
                                                <For
                                                    each={bundle().rankings.filter(
                                                        (r) => r.best !== null,
                                                    )}
                                                >
                                                    {(ranking) => (
                                                        <div class="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-xs">
                                                            <span class="flex-1 truncate">
                                                                {modeLabel(ranking.mode)}
                                                            </span>
                                                            <Show
                                                                when={
                                                                    ranking.rank !== null &&
                                                                    ranking.rank <= 3
                                                                }
                                                            >
                                                                <RankBadge rank={ranking.rank ?? 1} />
                                                            </Show>
                                                            <span class="text-neon">
                                                                {ranking.rank
                                                                    ? `#${ranking.rank}`
                                                                    : '—'}
                                                            </span>
                                                            <span class="text-muted">
                                                                {ranking.best} pts
                                                            </span>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </div>

                                    <Show when={isYou() && bundle().following.length > 0}>
                                        <div class="mt-3">
                                            <p class="mb-1.5 text-sm font-bold">
                                                {t('followingTitle')} · {bundle().following.length}
                                            </p>
                                            <div class="flex flex-col gap-1">
                                                <For each={bundle().following}>
                                                    {(friend) => (
                                                        <button
                                                            type="button"
                                                            class="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                                                            onClick={() =>
                                                                openProfileCard({
                                                                    name: friend.name,
                                                                    avatar: friend.avatar,
                                                                })
                                                            }
                                                        >
                                                            <Avatar
                                                                url={friend.avatar}
                                                                name={friend.name}
                                                                size={22}
                                                            />
                                                            <span class="flex-1 truncate text-start">
                                                                {safeDisplayName(friend.name)}
                                                            </span>
                                                            <span class="text-muted">
                                                                {formatNumber(friend.score)}
                                                            </span>
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </Show>
                                </>
                            )}
                        </Show>

                        <Show when={error()}>
                            {(message) => (
                                <p role="alert" class="mt-2 text-sm text-bad">
                                    {message()}
                                </p>
                            )}
                        </Show>

                        <Show when={isAdmin() && !isYou() && name()}>
                            <div class="mt-3 flex items-center gap-2 rounded-xl border border-bad/30 bg-bad/10 p-2">
                                <span class="text-xs font-bold text-bad">{t('adminButton')}</span>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => void runAdmin('ban')}
                                >
                                    {t('adminBan')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => void runAdmin('reset_profile')}
                                >
                                    {t('adminReset')}
                                </Button>
                            </div>
                        </Show>

                        <div class="mt-4 flex flex-wrap gap-2">
                            <Show when={supabaseConfigured() && !isYou() && card().kind === 'profile'}>
                                <Button
                                    size="sm"
                                    icon={
                                        isFollowing(name()) && followTick() >= 0 ? (
                                            <Check size={14} />
                                        ) : (
                                            <UserPlus size={14} />
                                        )
                                    }
                                    onClick={() => void toggleFollow()}
                                >
                                    {isFollowing(name()) ? t('following') : t('follow')}
                                </Button>
                            </Show>
                            <Show when={canPromote()}>
                                <Button
                                    size="sm"
                                    icon={<Medal size={14} />}
                                    onClick={() => {
                                        const player = roomPlayer();
                                        if (!player) return;
                                        void makeHost(player.id)
                                            .then(closePlayerCard)
                                            .catch((err: unknown) =>
                                                setError(
                                                    err instanceof Error ? err.message : 'error',
                                                ),
                                            );
                                    }}
                                >
                                    {t('makeHost')}
                                </Button>
                            </Show>
                            <Show when={card().kind === 'room'}>
                                <Button size="sm" variant="primary" onClick={() => void invite()}>
                                    {discordActivity.active ? t('inviteToRoom') : t('copyCode')}
                                </Button>
                            </Show>
                            <Button size="sm" class="ms-auto" onClick={closePlayerCard}>
                                {t('close')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Show>
    );
};
