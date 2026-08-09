import {
    For,
    Show,
    createResource,
    createSignal,
    type Component,
    type JSX,
} from 'solid-js';
import { modeLabel, t } from '../../i18n';
import { safeDisplayName } from '../../lib/names';
import {
    adminApi,
    adminBanned,
    adminLive,
    adminReports,
    adminUsers,
    timeAgo,
} from '../../lib/admin';
import { closeDialog, isDialogOpen } from '../../state/ui';
import { Modal } from '../ui';
import { Flame } from '../icons';

type AdminTab = 'reports' | 'users' | 'live' | 'bans';

const TAB_LABELS: Readonly<Record<AdminTab, () => string>> = {
    reports: () => t('adminReports'),
    users: () => t('adminUsers'),
    live: () => t('adminLive'),
    bans: () => t('adminBans'),
};

/**
 * A destructive button that must be clicked twice: the first click arms it, the
 * second within 3.5s runs the action. Works everywhere, unlike window.confirm(),
 * which Discord's iframe can suppress.
 */
const ActionButton: Component<{
    readonly label: string;
    readonly danger?: boolean;
    readonly run: () => Promise<unknown>;
    readonly onDone: () => void;
}> = (props) => {
    const [armed, setArmed] = createSignal(false);
    const [busy, setBusy] = createSignal(false);
    const [text, setText] = createSignal<string | null>(null);

    const execute = async (): Promise<void> => {
        setBusy(true);
        try {
            await props.run();
            setText(t('adminDone'));
            setTimeout(props.onDone, 400);
        } catch {
            setText(t('adminError'));
            setBusy(false);
            setArmed(false);
        }
    };

    const click = (): void => {
        if (props.danger !== true) {
            void execute();
            return;
        }
        if (armed()) {
            void execute();
            return;
        }
        setArmed(true);
        setTimeout(() => setArmed(false), 3500);
    };

    return (
        <button
            type="button"
            disabled={busy()}
            onClick={click}
            class={[
                'rounded-md px-2 py-1 text-xs font-semibold transition disabled:opacity-50',
                props.danger === true
                    ? armed()
                        ? 'bg-bad text-white'
                        : 'bg-bad/20 text-bad hover:bg-bad/30'
                    : 'glass-panel text-muted hover:text-ink',
            ].join(' ')}
        >
            {text() ?? (armed() ? t('adminConfirm') : props.label)}
        </button>
    );
};

const Row: Component<{
    readonly title: JSX.Element;
    readonly subtitle: JSX.Element;
    readonly actions: JSX.Element;
}> = (props) => (
    <div class="flex items-center gap-2 rounded-xl bg-white/4 px-3 py-2">
        <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">{props.title}</div>
            <div class="truncate text-xs text-muted">{props.subtitle}</div>
        </div>
        <div class="flex shrink-0 flex-wrap justify-end gap-1">{props.actions}</div>
    </div>
);

const Empty: Component<{ readonly loading: boolean; readonly error: boolean }> = (props) => (
    <p class={['py-6 text-center text-sm', props.error ? 'text-bad' : 'text-muted'].join(' ')}>
        {props.error ? t('adminError') : props.loading ? t('adminLoading') : t('adminEmpty')}
    </p>
);

export const AdminPanel: Component = () => {
    const [tab, setTab] = createSignal<AdminTab>('reports');
    const [search, setSearch] = createSignal('');
    const [nonce, setNonce] = createSignal(0);
    const reload = (): void => {
        setNonce((value) => value + 1);
    };

    const [reports] = createResource(
        () => (isDialogOpen('admin') && tab() === 'reports' ? nonce() : undefined),
        adminReports,
    );
    const [users] = createResource(
        () =>
            isDialogOpen('admin') && tab() === 'users'
                ? ({ search: search(), nonce: nonce() } as const)
                : undefined,
        (key) => adminUsers(key.search),
    );
    const [live] = createResource(
        () => (isDialogOpen('admin') && tab() === 'live' ? nonce() : undefined),
        adminLive,
    );
    const [bans] = createResource(
        () => (isDialogOpen('admin') && tab() === 'bans' ? nonce() : undefined),
        adminBanned,
    );

    const ACTIVITY_LABELS: Readonly<Record<string, () => string>> = {
        home: () => t('adminActivityHome'),
        lobby: () => t('adminActivityLobby'),
        playing: () => t('adminActivityPlaying'),
    };

    return (
        <Modal open={isDialogOpen('admin')} title={t('adminTitle')} onClose={closeDialog} wide>
            <div class="mb-3 flex gap-1">
                <For each={Object.keys(TAB_LABELS) as readonly AdminTab[]}>
                    {(key) => (
                        <button
                            type="button"
                            onClick={() => setTab(key)}
                            class={[
                                'rounded-lg px-3 py-1.5 text-sm transition',
                                tab() === key
                                    ? 'bg-neon text-[#04121f] font-bold'
                                    : 'glass-panel text-muted',
                            ].join(' ')}
                        >
                            {TAB_LABELS[key]()}
                        </button>
                    )}
                </For>
            </div>

            <div class="scrollbar-slim flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
                <Show when={tab() === 'reports'}>
                    <Show
                        when={(reports()?.length ?? 0) > 0}
                        fallback={
                            <Empty loading={reports.loading} error={reports.error !== undefined} />
                        }
                    >
                        <For each={reports()}>
                            {(report) => (
                                <Row
                                    title={
                                        <>
                                            {report.score
                                                ? safeDisplayName(report.score.player)
                                                : `#${report.score_id}`}{' '}
                                            <span class="rounded bg-white/10 px-1.5 text-[10px] uppercase">
                                                {report.status ?? 'open'}
                                            </span>
                                        </>
                                    }
                                    subtitle={
                                        <>
                                            {report.score
                                                ? `${report.score.score} · ${modeLabel(report.score.mode ?? 'all')}`
                                                : ''}{' '}
                                            · {report.reason}
                                            {report.details ? ` — ${report.details}` : ''}
                                        </>
                                    }
                                    actions={
                                        <>
                                            <Show when={report.score}>
                                                {(score) => (
                                                    <>
                                                        <ActionButton
                                                            danger
                                                            label={t('adminDeleteScore')}
                                                            onDone={reload}
                                                            run={() =>
                                                                adminApi('delete_score', {
                                                                    id: report.score_id,
                                                                })
                                                            }
                                                        />
                                                        <ActionButton
                                                            danger
                                                            label={t('adminBan')}
                                                            onDone={reload}
                                                            run={() =>
                                                                adminApi('ban', {
                                                                    player: score().player,
                                                                    reason: report.reason,
                                                                })
                                                            }
                                                        />
                                                    </>
                                                )}
                                            </Show>
                                            <Show when={(report.status ?? 'open') === 'open'}>
                                                <ActionButton
                                                    label={t('adminResolve')}
                                                    onDone={reload}
                                                    run={() =>
                                                        adminApi('resolve_report', {
                                                            id: report.id,
                                                            status: 'resolved',
                                                        })
                                                    }
                                                />
                                                <ActionButton
                                                    label={t('adminDismiss')}
                                                    onDone={reload}
                                                    run={() =>
                                                        adminApi('resolve_report', {
                                                            id: report.id,
                                                            status: 'dismissed',
                                                        })
                                                    }
                                                />
                                            </Show>
                                        </>
                                    }
                                />
                            )}
                        </For>
                    </Show>
                </Show>

                <Show when={tab() === 'users'}>
                    <input
                        type="text"
                        placeholder={t('adminSearch')}
                        class="mb-1 rounded-lg border border-white/12 bg-bg-1 px-2.5 py-1.5 text-sm"
                        value={search()}
                        onInput={(event) => setSearch(event.currentTarget.value)}
                    />
                    <Show
                        when={(users()?.length ?? 0) > 0}
                        fallback={<Empty loading={users.loading} error={users.error !== undefined} />}
                    >
                        <For each={users()}>
                            {(user) => (
                                <Row
                                    title={
                                        <>
                                            {safeDisplayName(user.player)}
                                            <Show when={user.banned}>
                                                <span class="ms-1 rounded bg-bad/25 px-1.5 text-[10px] text-bad">
                                                    ban
                                                </span>
                                            </Show>
                                        </>
                                    }
                                    subtitle={
                                        <span class="inline-flex items-center gap-1">
                                            Lv {user.level ?? 1} · {user.games ?? 0}{' '}
                                            {t('adminGames')} ·
                                            <Flame size={11} />
                                            {user.day_streak ?? 0} · {timeAgo(user.last_seen)}
                                        </span>
                                    }
                                    actions={
                                        <>
                                            <ActionButton
                                                danger
                                                label={t('adminReset')}
                                                onDone={reload}
                                                run={() =>
                                                    adminApi('reset_profile', {
                                                        player: user.player,
                                                    })
                                                }
                                            />
                                            <Show
                                                when={user.banned}
                                                fallback={
                                                    <ActionButton
                                                        danger
                                                        label={t('adminBan')}
                                                        onDone={reload}
                                                        run={() =>
                                                            adminApi('ban', {
                                                                player: user.player,
                                                                reason: 'admin',
                                                            })
                                                        }
                                                    />
                                                }
                                            >
                                                <ActionButton
                                                    label={t('adminUnban')}
                                                    onDone={reload}
                                                    run={() =>
                                                        adminApi('unban', { player: user.player })
                                                    }
                                                />
                                            </Show>
                                        </>
                                    }
                                />
                            )}
                        </For>
                    </Show>
                </Show>

                <Show when={tab() === 'live'}>
                    <Show
                        when={(live()?.length ?? 0) > 0}
                        fallback={<Empty loading={live.loading} error={live.error !== undefined} />}
                    >
                        <For each={live()}>
                            {(entry) => (
                                <Row
                                    title={
                                        <>
                                            {safeDisplayName(entry.player)}{' '}
                                            <span class="rounded bg-neon/20 px-1.5 text-[10px] text-neon">
                                                {ACTIVITY_LABELS[entry.activity ?? 'home']?.() ??
                                                    entry.activity}
                                            </span>
                                        </>
                                    }
                                    subtitle={
                                        <>
                                            {modeLabel(entry.mode ?? 'all')} · {entry.platform} ·{' '}
                                            {entry.guild_id
                                                ? `${t('adminServer')}: ${entry.guild_id}`
                                                : t('adminNoServer')}{' '}
                                            · {timeAgo(entry.updated_at)}
                                        </>
                                    }
                                    actions={
                                        <ActionButton
                                            danger
                                            label={t('adminBan')}
                                            onDone={reload}
                                            run={() =>
                                                adminApi('ban', {
                                                    player: entry.player,
                                                    reason: 'admin',
                                                })
                                            }
                                        />
                                    }
                                />
                            )}
                        </For>
                    </Show>
                </Show>

                <Show when={tab() === 'bans'}>
                    <Show
                        when={(bans()?.length ?? 0) > 0}
                        fallback={<Empty loading={bans.loading} error={bans.error !== undefined} />}
                    >
                        <For each={bans()}>
                            {(ban) => (
                                <Row
                                    title={ban.player}
                                    subtitle={
                                        <>
                                            {ban.reason} · {t('adminBannedBy')} {ban.banned_by} ·{' '}
                                            {timeAgo(ban.created_at)}
                                        </>
                                    }
                                    actions={
                                        <ActionButton
                                            label={t('adminUnban')}
                                            onDone={reload}
                                            run={() => adminApi('unban', { player: ban.player })}
                                        />
                                    }
                                />
                            )}
                        </For>
                    </Show>
                </Show>
            </div>
        </Modal>
    );
};
