import { createSignal } from 'solid-js';
import type { LeaderboardEntry, RoomPlayer } from '../types/models';
import type { ShareCard } from '../lib/share';
import { readString, writeString } from '../lib/storage';

/* ============================================================
   Which overlay is open. Kept out of the game store so a dialog
   never re-renders the board.
   ============================================================ */

export type DialogName =
    | 'settings'
    | 'about'
    | 'join'
    | 'endQuiz'
    | 'report'
    | 'admin'
    | 'onboarding';

const [openDialog, setOpenDialog] = createSignal<DialogName | null>(null);
export { openDialog };

export function showDialog(name: DialogName): void {
    setOpenDialog(name);
}

export function closeDialog(): void {
    setOpenDialog(null);
}

export function isDialogOpen(name: DialogName): boolean {
    return openDialog() === name;
}

/* ---------------- Player card ---------------- */

export interface ProfileCardTarget {
    readonly kind: 'profile';
    readonly name: string;
    readonly avatar: string | null;
    readonly you: boolean;
}

export interface RoomCardTarget {
    readonly kind: 'room';
    readonly player: RoomPlayer;
}

export type PlayerCardTarget = ProfileCardTarget | RoomCardTarget;

const [playerCard, setPlayerCard] = createSignal<PlayerCardTarget | null>(null);
export { playerCard };

export function openRoomPlayerCard(player: RoomPlayer): void {
    setPlayerCard({ kind: 'room', player });
}

export function openProfileCard(entry: {
    readonly name: string;
    readonly avatar?: string | null;
    readonly you?: boolean;
}): void {
    setPlayerCard({
        kind: 'profile',
        name: entry.name,
        avatar: entry.avatar ?? null,
        you: entry.you === true,
    });
}

export function closePlayerCard(): void {
    setPlayerCard(null);
}

/* ---------------- Report target ---------------- */

const [reportTarget, setReportTarget] = createSignal<LeaderboardEntry | null>(null);
export { reportTarget };

export function openReportDialog(entry: LeaderboardEntry): void {
    setReportTarget(entry);
    showDialog('report');
}

/* ---------------- Share overlay ---------------- */

const [shareCard, setShareCard] = createSignal<ShareCard | null>(null);
export { shareCard };

export function showShareCard(card: ShareCard | null): void {
    setShareCard(card);
}

export function hideShareCard(): void {
    const card = shareCard();
    if (card) {
        const url = card.objectUrl;
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
    setShareCard(null);
}

/* ---------------- First-run onboarding ---------------- */

const ONBOARDED_KEY = 'gtl_onboarded';

export function shouldShowOnboarding(): boolean {
    return readString(ONBOARDED_KEY) !== '1';
}

export function markOnboarded(): void {
    writeString(ONBOARDED_KEY, '1');
    if (openDialog() === 'onboarding') closeDialog();
}
