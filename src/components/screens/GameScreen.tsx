import { For, Show, createMemo, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import { difficultyLabel, t } from '../../i18n';
import { TOKEN_CLASS, tokenizeCode } from '../../lib/highlight';
import { OPTION_COLORS } from '../../lib/languages';
import { safeDisplayName } from '../../lib/names';
import { discordProfile, ownAvatarUrl } from '../../lib/identity';
import { amSpectator, mpIsHost, mpPlayers, mpRoom } from '../../lib/multiplayer';
import {
    advanceAfterFeedback,
    chooseAnswer,
    fiftyFiftyDisabled,
    leaveMultiplayer,
    roundLength,
    state,
    submitFillAnswer,
    useFiftyFifty,
} from '../../state/game';
import { showDialog } from '../../state/ui';
import { Avatar, Button } from '../ui';
import { Check, Flame, InfinityIcon, LanguageIcon, X } from '../icons';
import type { AnswerOption } from '../../types/models';

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const CodePanel: Component = () => {
    const question = (): (typeof state)['current'] => state.current;
    return (
        <div class="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#08131f]">
            <div class="flex items-center gap-1.5 border-b border-white/8 px-3 py-2">
                <span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span class="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span class="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <Show when={question()}>
                    {(current) => (
                        <span class="ms-auto rounded-md bg-white/8 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                            {difficultyLabel(current().difficulty)}
                        </span>
                    )}
                </Show>
            </div>
            <Show when={question()}>
                {(current) => (
                    <Show
                        when={current().panelIsCode}
                        fallback={
                            <p
                                dir="auto"
                                class="scrollbar-slim max-h-64 overflow-auto px-4 py-4 text-[15px] leading-relaxed text-ink"
                            >
                                {current().panelText}
                            </p>
                        }
                    >
                        <pre
                            dir="ltr"
                            class="scrollbar-slim max-h-64 overflow-auto px-4 py-4 font-mono text-[13.5px] leading-relaxed"
                        >
                            <code>
                                <For each={tokenizeCode(current().panelText)}>
                                    {(token) => <span class={TOKEN_CLASS[token.kind]}>{token.text}</span>}
                                </For>
                            </code>
                        </pre>
                    </Show>
                )}
            </Show>
        </div>
    );
};

const TimerRing: Component = () => {
    const fraction = (): number => {
        if (state.practice) return 1;
        const total = state.questionTime || 1;
        return Math.max(0, Math.min(1, state.timeLeft / total));
    };
    const stroke = (): string =>
        fraction() <= 0.2 ? '#ff5470' : fraction() <= 0.4 ? '#ffd874' : '#2ec5ff';

    return (
        <div class="relative h-24 w-24 shrink-0" role="timer" aria-label={t('settingTimer')}>
            <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="9" />
                <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={stroke()}
                    stroke-width="9"
                    stroke-linecap="round"
                    stroke-dasharray={String(RING_CIRCUMFERENCE)}
                    stroke-dashoffset={String(RING_CIRCUMFERENCE * (1 - fraction()))}
                    style={{ transition: 'stroke-dashoffset 0.3s linear' }}
                />
            </svg>
            <div class="absolute inset-0 grid place-items-center text-2xl font-extrabold" dir="ltr">
                <Show when={!state.practice} fallback={<InfinityIcon size={26} />}>
                    {Math.max(0, state.timeLeft)}
                </Show>
            </div>
        </div>
    );
};

const RevealChips: Component<{ readonly option: string }> = (props) => {
    const ids = (): readonly string[] => state.revealChips[props.option] ?? [];
    return (
        <Show when={ids().length > 0}>
            <div class="mt-1.5 flex flex-wrap gap-1">
                <For each={ids()}>
                    {(id) => {
                        const player = (): ReturnType<typeof mpPlayers>[number] | undefined =>
                            mpPlayers().find((p) => p.id === id);
                        return (
                            <Show when={player()}>
                                {(found) => (
                                    <span
                                        class="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]"
                                        style={{
                                            background: `${found().color ?? '#2ec5ff'}22`,
                                            'box-shadow': `inset 0 0 0 1px ${found().color ?? '#2ec5ff'}`,
                                            color: found().color ?? '#2ec5ff',
                                        }}
                                    >
                                        {safeDisplayName(found().name)}
                                    </span>
                                )}
                            </Show>
                        );
                    }}
                </For>
            </div>
        </Show>
    );
};

const OptionButton: Component<{ readonly option: AnswerOption; readonly index: number }> = (
    props,
) => {
    const question = (): (typeof state)['current'] => state.current;
    const eliminated = (): boolean => state.eliminated.includes(props.option.label);
    const isAnswer = (): boolean => question()?.answer === props.option.label;
    const chosen = (): boolean =>
        state.multiplayer
            ? state.mpChosen === props.option.label
            : state.selectedAnswer === props.option.label;

    const tone = (): string => {
        if (state.revealed && isAnswer()) return 'border-good bg-good/15 text-ink';
        if (state.revealed && chosen()) return 'border-bad bg-bad/15 text-ink animate-shake';
        if (chosen()) return 'border-neon bg-neon/12';
        if (eliminated()) return 'opacity-25';
        return 'glass-panel hover:border-neon/50 hover:bg-white/8';
    };

    const disabled = (): boolean =>
        eliminated() || state.revealed || state.spectator || (!state.multiplayer && state.answered);

    return (
        <button
            type="button"
            disabled={disabled()}
            onClick={() => chooseAnswer(props.option.label)}
            class={[
                'flex flex-col rounded-xl border border-white/10 p-2.5 text-start transition disabled:cursor-default',
                tone(),
            ].join(' ')}
        >
            <span class="flex items-center gap-2.5">
                <span
                    class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-[#04121f]"
                    style={{
                        background:
                            props.option.color ??
                            OPTION_COLORS[props.index % OPTION_COLORS.length] ??
                            '',
                    }}
                    aria-hidden="true"
                >
                    <Show
                        when={props.option.iconKey}
                        fallback={String.fromCharCode(65 + props.index)}
                    >
                        <LanguageIcon iconKey={props.option.iconKey} size={20} />
                    </Show>
                </span>
                <span class="min-w-0 flex-1 text-[13.5px] font-semibold">{props.option.label}</span>
                <span class="text-[10px] text-muted" aria-hidden="true">
                    {props.index + 1}
                </span>
            </span>
            <Show when={state.multiplayer && state.revealed}>
                <RevealChips option={props.option.label} />
            </Show>
        </button>
    );
};

const FillForm: Component = () => {
    const [value, setValue] = createSignal('');
    let input: HTMLInputElement | undefined;

    const question = (): (typeof state)['current'] => state.current;
    const locked = (): boolean => state.answered || state.revealed || state.spectator;

    const tone = (): string => {
        if (!state.revealed) return 'border-white/12';
        const current = question();
        if (!current) return 'border-white/12';
        const correct = state.roundHistory.at(-1)?.correct === true;
        return correct ? 'border-good bg-good/10' : 'border-bad bg-bad/10';
    };

    onMount(() => {
        queueMicrotask(() => input?.focus());
    });

    return (
        <form
            dir="ltr"
            autocomplete="off"
            class="mx-auto flex w-full max-w-xl gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                submitFillAnswer(value());
                setValue('');
            }}
        >
            <input
                ref={input}
                type="text"
                dir="ltr"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck={false}
                aria-label={t('fillSubmit')}
                placeholder={t('fillPlaceholder')}
                disabled={locked()}
                value={value()}
                onInput={(event) => setValue(event.currentTarget.value)}
                class={['flex-1 rounded-xl border bg-bg-1 px-3 py-2.5 font-mono text-ink', tone()].join(
                    ' ',
                )}
            />
            <Button variant="primary" type="submit" disabled={locked()}>
                {t('fillSubmit')}
            </Button>
        </form>
    );
};

export const GameScreen: Component = () => {
    const question = (): (typeof state)['current'] => state.current;

    /** Desktop: answer with 1–4 or a–d while a choice question is open. */
    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            (target instanceof HTMLElement && target.isContentEditable)
        ) {
            return;
        }
        const current = question();
        if (!current || current.style === 'fill' || state.revealed) return;

        let index = -1;
        if (event.key >= '1' && event.key <= '9') index = Number(event.key) - 1;
        else if (/^[a-f]$/i.test(event.key)) index = event.key.toLowerCase().charCodeAt(0) - 97;
        if (index < 0) return;

        const options = current.options.filter((opt) => !state.eliminated.includes(opt.label));
        const option = options[index];
        if (option) {
            event.preventDefault();
            chooseAnswer(option.label);
        }
    };

    onMount(() => document.addEventListener('keydown', onKeyDown));
    onCleanup(() => document.removeEventListener('keydown', onKeyDown));

    const total = createMemo(() => roundLength());

    return (
        <section class="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 pb-16 pt-3">
            <h2 class="sr-only" tabIndex={-1}>
                {t('gameTitle')}
            </h2>

            <Show when={state.multiplayer && mpRoom()}>
                {(room) => (
                    <div class="flex items-center gap-2 overflow-x-auto rounded-xl glass-panel px-3 py-1.5">
                        <span class="rounded-md bg-neon/15 px-2 py-0.5 font-mono text-xs text-neon">
                            {room().code}
                        </span>
                        <For each={mpPlayers()}>
                            {(player) => (
                                <span class="flex shrink-0 items-center gap-1 text-xs text-muted">
                                    <Avatar
                                        url={null}
                                        name={player.name}
                                        size={20}
                                        ring={player.color}
                                    />
                                    {safeDisplayName(player.name)}
                                    <strong class="text-ink">{player.score}</strong>
                                </span>
                            )}
                        </For>
                    </div>
                )}
            </Show>

            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                    <Show when={discordProfile()}>
                        {(profile) => (
                            <span class="flex items-center gap-1.5 rounded-full glass-panel px-2 py-1 text-xs">
                                <Avatar url={ownAvatarUrl()} name={profile().name} size={20} />
                                {safeDisplayName(profile().name)}
                            </span>
                        )}
                    </Show>
                    <span class="rounded-full glass-panel px-3 py-1 text-sm">
                        {t('score')} <strong class="text-neon">{state.score}</strong>
                    </span>
                    <span class="flex items-center gap-1 rounded-full glass-panel px-3 py-1 text-sm">
                        <Check size={14} class="text-good" />
                        {state.correct}/{total()}
                    </span>
                    <Show when={state.streak >= 3}>
                        <span class="flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-sm text-gold">
                            <Flame size={14} />
                            {state.streak} ×1.5
                        </span>
                    </Show>
                </div>

                <div class="flex items-center gap-2">
                    <Show when={!state.multiplayer && question()?.style !== 'fill'}>
                        <Button
                            size="sm"
                            disabled={fiftyFiftyDisabled()}
                            onClick={useFiftyFifty}
                            title={t('lifelineFifty')}
                        >
                            50:50 · {state.lifelines}
                        </Button>
                    </Show>
                    <span class="rounded-full glass-panel px-3 py-1 text-sm">
                        {t('question')} {Math.min(state.index + 1, total() || 1)} / {total()}
                    </span>
                    <Show when={!state.multiplayer || mpIsHost()}>
                        <Button
                            size="sm"
                            variant="danger"
                            icon={<X size={14} />}
                            onClick={() => showDialog('endQuiz')}
                        >
                            {t('endQuiz')}
                        </Button>
                    </Show>
                    <Show when={state.multiplayer && amSpectator()}>
                        <Button size="sm" onClick={() => void leaveMultiplayer()}>
                            {t('leaveRoom')}
                        </Button>
                    </Show>
                </div>
            </div>

            <div class="flex items-start gap-4">
                <CodePanel />
                <TimerRing />
            </div>

            <Show when={state.feedback}>
                {(feedback) => (
                    <div
                        role="status"
                        aria-live="polite"
                        class={[
                            'rounded-xl border px-3 py-2.5',
                            feedback().kind === 'good'
                                ? 'border-good/40 bg-good/10'
                                : 'border-bad/40 bg-bad/10',
                        ].join(' ')}
                    >
                        <p class="text-sm font-bold">{feedback().headline}</p>
                        <Show when={feedback().explanation}>
                            <p class="mt-1 text-[13px] leading-relaxed text-muted">
                                {feedback().explanation}
                            </p>
                        </Show>
                        <Show when={state.showNextButton && !state.multiplayer}>
                            <Button
                                variant="primary"
                                size="sm"
                                class="mt-2"
                                onClick={advanceAfterFeedback}
                            >
                                {t('nextQuestion')}
                            </Button>
                        </Show>
                    </div>
                )}
            </Show>

            <Show when={question()?.questionText}>
                {(text) => (
                    <p dir="auto" class="text-center text-[15px] font-semibold text-ink">
                        {text()}
                    </p>
                )}
            </Show>

            <Show when={state.mpStatus}>
                {(status) => (
                    <p class="rounded-lg bg-white/6 px-3 py-1.5 text-center text-sm text-muted">
                        {status()}
                    </p>
                )}
            </Show>

            <Show when={question()}>
                {(current) => (
                    <Show when={current().style !== 'fill'} fallback={<FillForm />}>
                        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" dir="ltr">
                            <For each={current().options}>
                                {(option, index) => (
                                    <OptionButton option={option} index={index()} />
                                )}
                            </For>
                        </div>
                    </Show>
                )}
            </Show>
        </section>
    );
};
