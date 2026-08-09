declare global {
    /** Injected by Vite's `define` from package.json. */
    const __APP_VERSION__: string;

    interface SupabaseRuntimeConfig {
        readonly url: string;
        readonly anonKey: string;
    }

    interface DiscordRuntimeConfig {
        readonly clientId?: string;
        readonly maxParticipants?: number;
        readonly presenceImage?: string;
    }

    /** Exposed by the Electron preload bridge (absent in the browser). */
    interface AppWindowBridge {
        minimize(): void;
        toggleMaximize(): void;
        close(): void;
        openExternal(url: string): void;
        getVersion(): Promise<string>;
    }

    interface Window {
        SUPABASE_CONFIG?: SupabaseRuntimeConfig;
        DISCORD_CONFIG?: DiscordRuntimeConfig;
        appWindow?: AppWindowBridge;
        /** Headless-test seam: forces a fixed question duration. */
        __GTL_QTIME?: number;
        /** Headless-test seam: forces the post-answer review delay in ms. */
        __GTL_FEEDBACK_MS?: number;
        webkitAudioContext?: typeof AudioContext;
    }
}

export {};
