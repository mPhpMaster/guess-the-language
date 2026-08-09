import {
    createEffect,
    createMemo,
    Show,
    splitProps,
    type Component,
    type JSX,
    type ParentComponent,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { X } from './icons';
import { avatarColorFor, initialsFor } from '../lib/identity';

/* ============================================================
   Presentation primitives shared by every screen.
   ============================================================ */

export type ButtonVariant = 'primary' | 'ghost' | 'accent' | 'discord' | 'danger' | 'daily';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
    primary:
        'bg-gradient-to-br from-neon to-[#1d7fc0] text-[#04121f] font-bold shadow-[0_8px_24px_-8px_rgba(46,197,255,0.6)] hover:brightness-110',
    accent: 'bg-gradient-to-br from-neon-2 to-[#12a988] text-[#04121f] font-bold hover:brightness-110',
    ghost: 'glass-panel text-ink hover:border-neon/50 hover:bg-white/8',
    discord: 'bg-discord text-white font-semibold hover:brightness-110',
    danger: 'bg-bad/90 text-white font-semibold hover:bg-bad',
    daily: 'bg-gradient-to-br from-gold to-gold-deep text-[#241a02] font-bold hover:brightness-110',
};

const SIZE_CLASS: Readonly<Record<ButtonSize, string>> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-[15px] rounded-xl gap-2',
    lg: 'px-6 py-3.5 text-lg rounded-2xl gap-2.5',
};

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    readonly variant?: ButtonVariant;
    readonly size?: ButtonSize;
    readonly icon?: JSX.Element;
    readonly block?: boolean;
}

export const Button: Component<ButtonProps> = (props) => {
    const [local, rest] = splitProps(props, [
        'variant',
        'size',
        'icon',
        'block',
        'class',
        'children',
    ]);
    return (
        <button
            type="button"
            {...rest}
            class={[
                'inline-flex items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-45',
                SIZE_CLASS[local.size ?? 'md'],
                VARIANT_CLASS[local.variant ?? 'ghost'],
                local.block === true ? 'w-full' : '',
                local.class ?? '',
            ].join(' ')}
        >
            <Show when={local.icon}>
                <span class="shrink-0">{local.icon}</span>
            </Show>
            <span>{local.children}</span>
        </button>
    );
};

export interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    readonly label: string;
}

export const IconButton: Component<IconButtonProps> = (props) => {
    const [local, rest] = splitProps(props, ['label', 'class', 'children']);
    return (
        <button
            type="button"
            aria-label={local.label}
            title={local.label}
            {...rest}
            class={[
                'grid h-9 w-9 place-items-center rounded-lg glass-panel text-muted transition hover:text-neon hover:border-neon/50',
                local.class ?? '',
            ].join(' ')}
        >
            {local.children}
        </button>
    );
};

/* ---------------- Modal ---------------- */

export interface ModalProps {
    readonly open: boolean;
    readonly title: string;
    readonly description?: string;
    readonly onClose: () => void;
    readonly wide?: boolean;
}

export const Modal: ParentComponent<ModalProps> = (props) => {
    let dialog: HTMLDivElement | undefined;

    createEffect(() => {
        if (props.open) queueMicrotask(() => dialog?.focus());
    });

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
        }
    };

    return (
        <Show when={props.open}>
            <Portal>
                <div
                    class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) props.onClose();
                    }}
                >
                    <div
                        ref={dialog}
                        role="dialog"
                        aria-modal="true"
                        aria-label={props.title}
                        tabIndex={-1}
                        onKeyDown={onKeyDown}
                        class={[
                            'scrollbar-slim my-auto max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-panel/95 p-5 shadow-2xl outline-none',
                            props.wide === true ? 'max-w-3xl' : 'max-w-md',
                        ].join(' ')}
                    >
                        <div class="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h3 class="text-lg font-bold text-ink">{props.title}</h3>
                                <Show when={props.description}>
                                    <p class="mt-1 text-sm text-muted">{props.description}</p>
                                </Show>
                            </div>
                            <IconButton label="Close" onClick={() => props.onClose()}>
                                <X size={16} />
                            </IconButton>
                        </div>
                        {props.children}
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

/* ---------------- Form rows ---------------- */

export const SettingRow: ParentComponent<{ readonly label: string; readonly for?: string }> = (
    props,
) => (
    <div class="flex items-center justify-between gap-3 border-b border-white/6 py-2.5 last:border-0">
        <label class="text-sm text-muted" for={props.for}>
            {props.label}
        </label>
        <div class="flex items-center gap-2">{props.children}</div>
    </div>
);

export interface SelectOption<T extends string> {
    readonly value: T;
    readonly label: string;
}

export interface SelectProps<T extends string> {
    readonly id?: string;
    readonly value: T;
    readonly options: readonly SelectOption<T>[];
    readonly onChange: (value: T) => void;
    readonly disabled?: boolean;
}

export function Select<T extends string>(props: SelectProps<T>): JSX.Element {
    return (
        <select
            id={props.id}
            disabled={props.disabled === true}
            class="min-w-32 rounded-lg border border-white/12 bg-bg-1 px-2.5 py-1.5 text-sm text-ink disabled:opacity-50"
            value={props.value}
            onChange={(event) => props.onChange(event.currentTarget.value as T)}
        >
            {props.options.map((option) => (
                <option value={option.value}>{option.label}</option>
            ))}
        </select>
    );
}

export const Toggle: Component<{
    readonly id?: string;
    readonly checked: boolean;
    readonly onChange: (value: boolean) => void;
    readonly label: string;
}> = (props) => (
    <button
        type="button"
        id={props.id}
        role="switch"
        aria-checked={props.checked}
        aria-label={props.label}
        onClick={() => props.onChange(!props.checked)}
        class={[
            'relative h-6 w-11 rounded-full transition',
            props.checked ? 'bg-neon' : 'bg-white/15',
        ].join(' ')}
    >
        <span
            class={[
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                props.checked ? 'left-[22px]' : 'left-0.5',
            ].join(' ')}
        />
    </button>
);

export const TextInput: Component<JSX.InputHTMLAttributes<HTMLInputElement>> = (props) => {
    const [local, rest] = splitProps(props, ['class']);
    return (
        <input
            {...rest}
            class={[
                'rounded-lg border border-white/12 bg-bg-1 px-2.5 py-1.5 text-sm text-ink placeholder:text-muted/60 disabled:opacity-60',
                local.class ?? '',
            ].join(' ')}
        />
    );
};

/* ---------------- Avatar ---------------- */

export interface AvatarProps {
    readonly url: string | null;
    readonly name: string;
    readonly size?: number;
    readonly ring?: string | null;
}

/** A real Discord photo when available, else a generated initials disc. */
export const Avatar: Component<AvatarProps> = (props) => {
    const size = (): number => props.size ?? 36;
    const color = createMemo(() => props.ring ?? avatarColorFor(props.name));
    return (
        <Show
            when={props.url}
            fallback={
                <span
                    class="grid shrink-0 place-items-center rounded-full font-bold text-[#04121f]"
                    style={{
                        width: `${size()}px`,
                        height: `${size()}px`,
                        background: color(),
                        'font-size': `${Math.round(size() * 0.4)}px`,
                    }}
                    aria-hidden="true"
                >
                    {initialsFor(props.name)}
                </span>
            }
        >
            {(url) => (
                <img
                    src={url()}
                    alt=""
                    referrerPolicy="no-referrer"
                    class="shrink-0 rounded-full object-cover"
                    style={{
                        width: `${size()}px`,
                        height: `${size()}px`,
                        'box-shadow': `inset 0 0 0 2px ${color()}`,
                    }}
                />
            )}
        </Show>
    );
};

export const Spinner: Component<{ readonly size?: number }> = (props) => (
    <span
        class="inline-block animate-spin rounded-full border-2 border-white/20 border-t-neon"
        style={{ width: `${props.size ?? 20}px`, height: `${props.size ?? 20}px` }}
        aria-hidden="true"
    />
);
