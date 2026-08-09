/// <reference types="svelte" />
/// <reference types="vite/client" />

/** Injected by Vite's `define` from package.json. */
declare const __GTL_VERSION__: string;

interface DiscordActivityBridge {
  readonly active: boolean;
  readonly user: { id: string; username: string; global_name?: string; avatar?: string | null } | null;
  readonly guildId: string | null;
  readonly channelId: string | null;
  readonly instanceId: string | null;
  openExternal?(url: string): void;
  shareLink?(message: string, link: string | null): Promise<unknown>;
}

interface Window {
  SUPABASE_CONFIG?: { url?: string; anonKey?: string };
  DISCORD_CONFIG?: { clientId?: string; maxParticipants?: number; presenceImage?: string };
  DISCORD_ACTIVITY?: DiscordActivityBridge;
  GTL_LOG_ERROR?: (message: unknown, extra?: Record<string, unknown>) => void;
  /** Electron preload bridge; absent on web. */
  appWindow?: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    openExternal(url: string): void;
    getVersion(): Promise<string>;
  };
}
