import { Show, type Component } from 'solid-js';
import { isElectron } from '../lib/platform';
import { t } from '../i18n';
import { Minus, Monitor, X } from './icons';

/** Electron-only custom window chrome; hidden on web and inside Discord. */
export const TitleBar: Component = () => (
    <Show when={isElectron()}>
        <header
            dir="ltr"
            class="app-drag flex h-[38px] items-center justify-between border-b border-white/10 bg-[#06101bcc] px-3 backdrop-blur"
        >
            <div class="flex items-center gap-2">
                <span class="text-neon" aria-hidden="true">
                    <Monitor size={14} />
                </span>
                <span class="text-[13px] tracking-wide text-[#cdddf0]">{t('appTitle')}</span>
            </div>
            <div class="app-no-drag flex">
                <button
                    type="button"
                    class="grid h-[38px] w-11 place-items-center text-muted hover:bg-white/10"
                    title={t('minimize')}
                    aria-label={t('minimize')}
                    onClick={() => window.appWindow?.minimize()}
                >
                    <Minus size={14} />
                </button>
                <button
                    type="button"
                    class="grid h-[38px] w-11 place-items-center text-muted hover:bg-white/10"
                    title={t('maximize')}
                    aria-label={t('maximize')}
                    onClick={() => window.appWindow?.toggleMaximize()}
                >
                    <Monitor size={13} />
                </button>
                <button
                    type="button"
                    class="grid h-[38px] w-11 place-items-center text-muted hover:bg-bad hover:text-white"
                    title={t('windowClose')}
                    aria-label={t('windowClose')}
                    onClick={() => window.appWindow?.close()}
                >
                    <X size={14} />
                </button>
            </div>
        </header>
    </Show>
);
