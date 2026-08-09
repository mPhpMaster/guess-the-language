import { supabaseConfig, supabaseConfigured } from './supabase';
import { avatarColorFor, initialsFor, ownAvatarUrl } from './identity';
import { safeDisplayName } from './names';
import { GAME_PUBLIC_URL } from './platform';

/* ============================================================
   Shareable result card: composited to a PNG, then uploaded so
   Discord (which blocks clipboard writes AND downloads inside
   the iframe) has a real https URL to hand around.
   ============================================================ */

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

/**
 * Load an image for canvas compositing. `crossOrigin` lets us read the pixels
 * back without tainting the canvas; resolves null on any failure.
 */
function loadCrossOriginImage(src: string | null): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        img.onload = (): void => resolve(img);
        img.onerror = (): void => resolve(null);
        img.src = src;
    });
}

export interface ShareCardInput {
    readonly heading: string;
    readonly score: number;
    readonly correct: number;
    readonly total: number;
    readonly playerName: string;
}

export interface ShareCard {
    readonly blob: Blob;
    readonly objectUrl: string;
    /** Public https URL when the upload succeeded, else null. */
    readonly publicUrl: string | null;
}

export async function renderShareCard(input: ShareCardInput): Promise<ShareCard | null> {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = CARD_WIDTH / 2;
    const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    gradient.addColorStop(0, '#0e2a44');
    gradient.addColorStop(1, '#081019');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    ctx.fillStyle = 'rgba(46,197,255,0.10)';
    ctx.beginPath();
    ctx.arc(CARD_WIDTH * 0.82, CARD_HEIGHT * 0.14, 340, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8ea6c0';
    ctx.font = `600 42px ${FONT}`;
    ctx.fillText('GUESS THE LANGUAGE', cx, 150);

    ctx.fillStyle = '#2ec5ff';
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText(input.heading, cx, 250);

    // The player's Discord avatar as a circular badge; falls back to an initials
    // disc when there is no avatar or it would taint the canvas.
    const radius = 108;
    const avatarY = 430;
    const avatar = await loadCrossOriginImage(ownAvatarUrl(256));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, avatarY, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#2ec5ff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, avatarY, radius, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) {
        ctx.drawImage(avatar, cx - radius, avatarY - radius, radius * 2, radius * 2);
    } else {
        ctx.fillStyle = avatarColorFor(input.playerName);
        ctx.fillRect(cx - radius, avatarY - radius, radius * 2, radius * 2);
        ctx.fillStyle = '#07111e';
        ctx.font = `800 96px ${FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(initialsFor(input.playerName), cx, avatarY);
        ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();

    ctx.fillStyle = '#eaf4ff';
    ctx.font = `900 200px ${FONT}`;
    ctx.fillText(String(input.score), cx, 720);

    ctx.fillStyle = '#8ea6c0';
    ctx.font = `600 44px ${FONT}`;
    ctx.fillText('SCORE', cx, 792);

    const total = input.total || 1;
    const accuracy = Math.round((input.correct / total) * 100);
    ctx.fillStyle = '#19f0c4';
    ctx.font = `800 62px ${FONT}`;
    ctx.fillText(`${accuracy}%   ·   ${input.correct}/${total}`, cx, 930);

    ctx.fillStyle = '#cfe0f4';
    ctx.font = `700 54px ${FONT}`;
    ctx.fillText(safeDisplayName(input.playerName) || 'Player', cx, 1130);

    ctx.fillStyle = '#5f7590';
    ctx.font = `500 38px ${FONT}`;
    ctx.fillText(GAME_PUBLIC_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), cx, 1275);

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) return null;

    let publicUrl: string | null = null;
    try {
        publicUrl = await uploadShareCard(blob);
    } catch {
        publicUrl = null;
    }

    return { blob, objectUrl: URL.createObjectURL(blob), publicUrl };
}

/**
 * Upload the PNG to the public `share-cards` bucket. Inside Discord the request
 * is proxied via the /supabase URL mapping, but the returned URL uses the real
 * host so it opens in a browser and embeds in a Discord message.
 */
async function uploadShareCard(blob: Blob): Promise<string | null> {
    const config = supabaseConfig();
    if (!supabaseConfigured() || !config) return null;
    const name = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const res = await fetch(`${config.url}/storage/v1/object/share-cards/${name}`, {
        method: 'POST',
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'image/png',
        },
        body: blob,
    });
    if (!res.ok) return null;
    return `${config.url}/storage/v1/object/public/share-cards/${name}`;
}

export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
    try {
        if (typeof ClipboardItem === 'undefined') return false;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
    } catch {
        return false;
    }
}

export function downloadImage(objectUrl: string): boolean {
    try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'guess-the-language.png';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return true;
    } catch {
        return false;
    }
}
