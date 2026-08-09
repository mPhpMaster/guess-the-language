import { sbFetch, supabaseConfigured } from './supabase';
import { t, type TranslationKey } from '../i18n';

/* ============================================================
   XP, levels and achievements. The server (record_progress) is
   the source of truth for unlocks; this mirrors its curve.
   ============================================================ */

export function levelFromXp(xp: number): number {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 1000)) + 1);
}

export function xpForLevel(level: number): number {
    return (Math.max(1, level) - 1) ** 2 * 1000;
}

export function levelTitle(level: number): string {
    if (level >= 11) return t('titleGuru');
    if (level >= 9) return t('titleExpert');
    if (level >= 7) return t('titleHacker');
    if (level >= 5) return t('titleCoder');
    if (level >= 3) return t('titleApprentice');
    return t('titleNovice');
}

export interface AchievementDefinition {
    readonly id: string;
    /** Key into the icon registry in components/icons.tsx. */
    readonly iconKey: string;
    readonly labelKey: TranslationKey;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
    { id: 'rookie', iconKey: 'gamepad', labelKey: 'ach_rookie' },
    { id: 'dedicated', iconKey: 'repeat', labelKey: 'ach_dedicated' },
    { id: 'centurion', iconKey: 'hash', labelKey: 'ach_centurion' },
    { id: 'first_win', iconKey: 'medal', labelKey: 'ach_first_win' },
    { id: 'champion', iconKey: 'trophy', labelKey: 'ach_champion' },
    { id: 'perfect', iconKey: 'sparkle', labelKey: 'ach_perfect' },
    { id: 'flawless', iconKey: 'star', labelKey: 'ach_flawless' },
    { id: 'streak3', iconKey: 'flame', labelKey: 'ach_streak3' },
    { id: 'streak7', iconKey: 'zap', labelKey: 'ach_streak7' },
    { id: 'marathon', iconKey: 'timer', labelKey: 'ach_marathon' },
    { id: 'level5', iconKey: 'rocket', labelKey: 'ach_level5' },
    { id: 'level10', iconKey: 'crown', labelKey: 'ach_level10' },
];

interface RecordProgressResult {
    readonly new_achievements?: readonly string[] | null;
}

export interface RecordPlayInput {
    readonly player: string;
    readonly seconds: number;
    readonly multiplayer: boolean;
    readonly won: boolean;
    readonly xp: number;
    readonly perfect: boolean;
}

/**
 * Log a finished round: play time, games, XP, daily streak and achievement
 * unlocks, atomically. Returns the newly unlocked achievement ids (possibly
 * empty). Best-effort — a failure must never affect gameplay.
 */
export async function recordPlay(input: RecordPlayInput): Promise<readonly string[]> {
    if (!supabaseConfigured() || !input.player) return [];
    try {
        const result = await sbFetch<RecordProgressResult | readonly RecordProgressResult[]>(
            'rpc/record_progress',
            {
                method: 'POST',
                body: JSON.stringify({
                    p_player: input.player,
                    p_seconds: Math.max(0, Math.round(input.seconds)),
                    p_multiplayer: input.multiplayer,
                    p_won: input.won,
                    p_xp: Math.max(0, Math.round(input.xp)),
                    p_perfect: input.perfect,
                }),
            },
        );
        const info = Array.isArray(result) ? result[0] : result;
        return info?.new_achievements ?? [];
    } catch (err) {
        console.warn('record_progress failed:', err);
        return [];
    }
}

/** Compact thousands (35490 -> "35,490"). */
export function formatNumber(value: number): string {
    return (Number.isFinite(value) ? value : 0).toLocaleString('en-US');
}
