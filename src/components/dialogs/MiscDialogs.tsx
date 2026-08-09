import { For, Show, createResource, createSignal, type Component } from 'solid-js';
import { t } from '../../i18n';
import { REPORT_REASONS, type ReportReason } from '../../types/models';
import { APP_VERSION, apiPrefix, openExternalUrl } from '../../lib/platform';
import { discordActivity } from '../../lib/discord';
import { appSessionToken } from '../../lib/identity';
import { totalQuestionCount } from '../../lib/questions';
import { supabaseConfigured } from '../../lib/supabase';
import { normalizeCode } from '../../lib/multiplayer';
import {
    announce,
    endQuiz,
    joinRoomFlow,
    state,
} from '../../state/game';
import {
    closeDialog,
    hideShareCard,
    isDialogOpen,
    markOnboarded,
    reportTarget,
    shareCard,
} from '../../state/ui';
import { Button, Modal, Select, TextInput } from '../ui';
import {
    Copy,
    Download,
    ExternalLink,
    Gamepad2,
    Link,
    MessageCircle,
    Share2,
    SiDiscord,
    SiGithub,
    Trophy,
    UserRound,
} from '../icons';
import { copyImageToClipboard, downloadImage } from '../../lib/share';
import { copyToClipboard } from '../../lib/platform';

/* ---------------- About ---------------- */

const LINKS: readonly { readonly url: string; readonly label: string; readonly key: string }[] = [
    { url: 'https://github.com/mPhpMaster/guess-the-language', label: 'GitHub', key: 'github' },
    { url: 'https://discord.gg/BRgVPum', label: 'Discord', key: 'discord' },
    {
        url: 'https://www.linkedin.com/in/mohammad-al-safadi/',
        label: 'LinkedIn',
        key: 'linkedin',
    },
];

export const AboutDialog: Component = () => {
    const [count] = createResource(
        () => isDialogOpen('about'),
        async (open) => (open ? totalQuestionCount() : 0),
    );

    const open = (url: string): void => {
        openExternalUrl(url, (target) => discordActivity.openExternal(target));
    };

    return (
        <Modal open={isDialogOpen('about')} title={t('aboutTitle')} onClose={closeDialog}>
            <div class="flex flex-col items-center gap-2 text-center">
                <span class="grid h-14 w-14 place-items-center rounded-2xl bg-neon/15 text-neon">
                    <Gamepad2 size={28} />
                </span>
                <p class="font-bold">
                    {t('appTitle')} <span class="text-muted">v{APP_VERSION}</span>
                </p>
                <p class="text-sm text-muted">{t('aboutDesc')}</p>
                <p class="text-sm">
                    {t('aboutQuestions')} <strong>{count() ?? '…'}</strong>
                </p>
                <div class="mt-2 flex flex-wrap justify-center gap-2">
                    <For each={LINKS}>
                        {(link) => (
                            <Button
                                size="sm"
                                icon={
                                    link.key === 'github' ? (
                                        <SiGithub size={14} />
                                    ) : link.key === 'discord' ? (
                                        <SiDiscord size={14} />
                                    ) : (
                                        <UserRound size={14} />
                                    )
                                }
                                onClick={() => open(link.url)}
                            >
                                {link.label}
                            </Button>
                        )}
                    </For>
                </div>
                <div class="mt-1 flex gap-2 text-xs text-muted">
                    <button type="button" class="underline" onClick={() => open('/terms.html')}>
                        Terms of Service
                    </button>
                    <span>·</span>
                    <button type="button" class="underline" onClick={() => open('/privacy.html')}>
                        Privacy Policy
                    </button>
                </div>
                <Button variant="primary" size="sm" class="mt-2" onClick={closeDialog}>
                    {t('close')}
                </Button>
            </div>
        </Modal>
    );
};

/* ---------------- Join room ---------------- */

export const JoinRoomDialog: Component = () => {
    const [code, setCode] = createSignal('');
    const [error, setError] = createSignal<string | null>(null);
    const [busy, setBusy] = createSignal(false);

    const join = async (): Promise<void> => {
        if (code().length !== 4) {
            setError(t('roomCode'));
            return;
        }
        setBusy(true);
        setError(null);
        const failure = await joinRoomFlow(code());
        setBusy(false);
        if (failure) setError(failure);
        else closeDialog();
    };

    return (
        <Modal
            open={isDialogOpen('join')}
            title={t('joinRoom')}
            description={t('joinHint')}
            onClose={closeDialog}
        >
            <TextInput
                dir="ltr"
                maxLength={4}
                placeholder="A3K9"
                autocomplete="off"
                class="w-full text-center font-mono text-xl tracking-[0.4em]"
                value={code()}
                onInput={(event) => setCode(normalizeCode(event.currentTarget.value))}
            />
            <Show when={error()}>
                {(message) => <p class="mt-2 text-sm text-bad">{message()}</p>}
            </Show>
            <div class="mt-3 flex gap-2">
                <Button
                    variant="primary"
                    block
                    icon={<Link size={16} />}
                    disabled={busy()}
                    onClick={() => void join()}
                >
                    {busy() ? t('joining') : t('joinConfirm')}
                </Button>
                <Button block onClick={closeDialog}>
                    {t('close')}
                </Button>
            </div>
        </Modal>
    );
};

/* ---------------- End quiz confirmation ---------------- */

export const EndQuizDialog: Component = () => (
    <Modal
        open={isDialogOpen('endQuiz')}
        title={t('endConfirmTitle')}
        description={t('endConfirmDesc')}
        onClose={closeDialog}
    >
        <div class="flex gap-2">
            <Button
                variant="danger"
                block
                onClick={() => {
                    closeDialog();
                    endQuiz();
                }}
            >
                {t('endQuiz')}
            </Button>
            <Button block onClick={closeDialog}>
                {t('continueQuiz')}
            </Button>
        </div>
    </Modal>
);

/* ---------------- Report a leaderboard entry ---------------- */

const REASON_LABELS: Readonly<Record<ReportReason, () => string>> = {
    offensive_name: () => t('reportOffensive'),
    impersonation: () => t('reportImpersonation'),
    spam_other: () => t('reportSpam'),
};

export const ReportDialog: Component = () => {
    const [reason, setReason] = createSignal<ReportReason>('offensive_name');
    const [details, setDetails] = createSignal('');
    const [error, setError] = createSignal<string | null>(null);
    const [busy, setBusy] = createSignal(false);

    const submit = async (): Promise<void> => {
        const target = reportTarget();
        const token = appSessionToken();
        if (!target || !token || !supabaseConfigured()) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`${apiPrefix()}/api/report`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    score_id: target.id,
                    reason: reason(),
                    details: details().trim().slice(0, 250) || null,
                }),
            });
            if (!res.ok) throw new Error(`Report ${res.status}: ${await res.text()}`);
            closeDialog();
            announce(t('reportSuccess'));
        } catch (err) {
            const duplicate = /409|23505|duplicate/i.test(String(err));
            const message = duplicate ? t('reportDuplicate') : t('reportFailed');
            setError(message);
            announce(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={isDialogOpen('report')}
            title={t('reportTitle')}
            description={t('reportDesc')}
            onClose={closeDialog}
        >
            <div class="flex flex-col gap-2">
                <Select<ReportReason>
                    value={reason()}
                    options={REPORT_REASONS.map((value) => ({
                        value,
                        label: REASON_LABELS[value](),
                    }))}
                    onChange={setReason}
                />
                <label class="text-sm text-muted" for="report-details">
                    {t('reportDetails')}
                </label>
                <textarea
                    id="report-details"
                    rows={4}
                    maxLength={250}
                    class="rounded-lg border border-white/12 bg-bg-1 p-2 text-sm"
                    value={details()}
                    onInput={(event) => setDetails(event.currentTarget.value)}
                />
                <Show when={error()}>
                    {(message) => (
                        <p role="alert" class="text-sm text-bad">
                            {message()}
                        </p>
                    )}
                </Show>
                <div class="flex gap-2">
                    <Button variant="primary" block disabled={busy()} onClick={() => void submit()}>
                        {t('reportSubmit')}
                    </Button>
                    <Button block onClick={closeDialog}>
                        {t('close')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

/* ---------------- First-run onboarding ---------------- */

export const OnboardingDialog: Component = () => (
    <Modal open={isDialogOpen('onboarding')} title={t('onboardTitle')} onClose={markOnboarded}>
        <span class="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-neon/15 text-neon">
            <Trophy size={28} />
        </span>
        <ul class="flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted">
            <li>{t('onboardTip1')}</li>
            <li>{t('onboardTip2')}</li>
            <li>{t('onboardTip3')}</li>
            <li>{t('onboardTip4')}</li>
        </ul>
        <Button variant="primary" block class="mt-4" onClick={markOnboarded}>
            {t('onboardGotIt')}
        </Button>
    </Modal>
);

/* ---------------- Share overlay ---------------- */

export const ShareOverlay: Component = () => {
    const [hint, setHint] = createSignal('');

    return (
        <Show when={shareCard()}>
            {(card) => (
                <div
                    class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) hideShareCard();
                    }}
                >
                    <div class="flex max-w-sm flex-col items-center gap-3">
                        <img
                            src={card().objectUrl}
                            alt=""
                            class="max-h-[62vh] rounded-2xl border border-white/12"
                        />
                        <div class="flex flex-wrap justify-center gap-2">
                            <Show
                                when={discordActivity.active && card().publicUrl}
                                fallback={
                                    <>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon={<Copy size={14} />}
                                            onClick={() => {
                                                void copyImageToClipboard(card().blob).then((ok) =>
                                                    setHint(ok ? t('copied') : t('copyFailed')),
                                                );
                                            }}
                                        >
                                            {t('copyImage')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            icon={<Download size={14} />}
                                            onClick={() =>
                                                setHint(
                                                    downloadImage(card().objectUrl)
                                                        ? t('downloadStarted')
                                                        : t('downloadBlocked'),
                                                )
                                            }
                                        >
                                            {t('download')}
                                        </Button>
                                    </>
                                }
                            >
                                {(url) => (
                                    <>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon={<ExternalLink size={14} />}
                                            onClick={() => discordActivity.openExternal(url())}
                                        >
                                            {t('shareOpenImage')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            icon={<Share2 size={14} />}
                                            onClick={() => {
                                                void discordActivity
                                                    .shareLink(
                                                        `${state.score} pts • ${url()}`,
                                                        null,
                                                    )
                                                    .catch(() =>
                                                        discordActivity.openExternal(url()),
                                                    );
                                            }}
                                        >
                                            {t('shareToDiscord')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            icon={<MessageCircle size={14} />}
                                            onClick={() => {
                                                void copyToClipboard(url()).then((ok) =>
                                                    setHint(ok ? t('shareLinkCopied2') : url()),
                                                );
                                            }}
                                        >
                                            {t('shareCopyLink')}
                                        </Button>
                                    </>
                                )}
                            </Show>
                            <Button size="sm" onClick={hideShareCard}>
                                {t('close')}
                            </Button>
                        </div>
                        <p class="text-center text-xs text-muted">
                            {hint() ||
                                (discordActivity.active ? t('shareDiscordHint') : t('shareHint'))}
                        </p>
                    </div>
                </div>
            )}
        </Show>
    );
};
