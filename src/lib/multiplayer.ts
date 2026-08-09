import { createSignal, type Accessor } from 'solid-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseClient, supabaseConfig, supabaseConfigured } from './supabase';
import { seededShuffle } from './round';
import { normalizeFillAnswer } from './names';
import { isChoiceQuestion, isLanguageQuestion } from '../types/models';
import type {
    AnswerKey,
    BankedQuestion,
    GameMode,
    JoinRoomResult,
    QuestionBank,
    Room,
    RoomAnswerRow,
    RoomPlayer,
    RoomSettings,
    RoundRef,
} from '../types/models';
import { removeKey, writeJson } from './storage';

/* ============================================================
   Multiplayer room client — Supabase Realtime + RPCs.
   ============================================================ */

const SESSION_KEY = 'gtl_mp_session';

const [room, setRoom] = createSignal<Room | null>(null);
const [players, setPlayers] = createSignal<readonly RoomPlayer[]>([]);
const [playerId, setPlayerId] = createSignal<string | null>(null);
const [isHost, setIsHost] = createSignal(false);

export const mpRoom: Accessor<Room | null> = room;
export const mpPlayers: Accessor<readonly RoomPlayer[]> = players;
export const mpPlayerId: Accessor<string | null> = playerId;
export const mpIsHost: Accessor<boolean> = isHost;

let roomId: string | null = null;
let roomChannel: RealtimeChannel | null = null;
let playersChannel: RealtimeChannel | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let lastSyncKey = '';
let beaconSent = false;
let claimingHost = false;

type UpdateHandler = (room: Room | null, players: readonly RoomPlayer[]) => void;
let onUpdate: UpdateHandler = () => undefined;
let onKicked: () => void = () => undefined;

export function setMultiplayerHandlers(update: UpdateHandler, kicked: () => void): void {
    onUpdate = update;
    onKicked = kicked;
}

export function multiplayerAvailable(): boolean {
    return supabaseConfigured();
}

export function normalizeCode(code: string): string {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

async function rpc<T>(name: string, params: Readonly<Record<string, unknown>>): Promise<T> {
    const { data, error } = await supabaseClient().rpc(name, params);
    if (error) throw new Error(error.message);
    return data as T;
}

/* ---------------- Round construction (host side) ---------------- */

function timeForDifficulty(difficulty: string): number {
    return difficulty === 'hard' ? 12 : difficulty === 'medium' ? 14 : 15;
}

/**
 * The same fair-across-banks deal as the single-player builder: one slot per
 * bank before any bank repeats, so an "All" room isn't dominated by `languages`.
 */
function sampleAcrossBanks(
    pool: readonly BankedQuestion[],
    count: number,
    seed: number,
): readonly BankedQuestion[] {
    const byBank = new Map<QuestionBank, BankedQuestion[]>();
    for (const question of pool) {
        const bucket = byBank.get(question.bank);
        if (bucket) bucket.push(question);
        else byBank.set(question.bank, [question]);
    }
    if (byBank.size < 2) return seededShuffle(pool, seed).slice(0, count);

    const queues = seededShuffle([...byBank.values()], seed).map((bucket, index) =>
        seededShuffle(bucket, (seed ^ ((index + 1) * 0x9e37_79b9)) >>> 0),
    );
    const picked: BankedQuestion[] = [];
    for (let depth = 0; picked.length < count; depth += 1) {
        let dealt = false;
        for (const queue of queues) {
            const item = queue[depth];
            if (item === undefined) continue;
            picked.push(item);
            dealt = true;
            if (picked.length === count) break;
        }
        if (!dealt) break;
    }
    return seededShuffle(picked, (seed ^ 0x85eb_ca6b) >>> 0);
}

export interface BuiltRound {
    readonly roundRefs: readonly RoundRef[];
    readonly answerKeys: readonly AnswerKey[];
}

export function buildRoundForRoom(
    allQuestions: readonly BankedQuestion[],
    mode: GameMode,
    settings: RoomSettings,
): BuiltRound {
    let pool = allQuestions.slice();
    if (mode !== 'all') {
        const byMode = pool.filter((q) => q.bank === mode);
        if (byMode.length > 0) pool = byMode;
    }
    if (settings.difficulty !== 'all') {
        const byDifficulty = pool.filter((q) => q.difficulty === settings.difficulty);
        if (byDifficulty.length > 0) pool = byDifficulty;
    }
    if (pool.length === 0) pool = allQuestions.slice();

    const seed = (Date.now() & 0xffff_ffff) || 1;
    const round = sampleAcrossBanks(pool, Math.min(settings.questions, pool.length), seed);
    const fixedTimer = settings.timer === 'auto' ? null : settings.timer;

    const roundRefs: RoundRef[] = [];
    const answerKeys: AnswerKey[] = [];

    round.forEach((question, index) => {
        roundRefs.push({
            bank: question.bank,
            id: question.id,
            optionSeed: ((Date.now() + index * 9973) & 0xffff_ffff) || 1,
            duration: fixedTimer ?? timeForDifficulty(question.difficulty),
        });
        // Fill-in answers are normalised so the server's exact-match scoring lines
        // up with the client's normalised submit.
        const answer = isLanguageQuestion(question)
            ? question.correctLanguage
            : isChoiceQuestion(question)
              ? question.answer
              : normalizeFillAnswer(question.answer);
        answerKeys.push({ index, answer });
    });

    return { roundRefs, answerKeys };
}

export function resolveQuestion(
    ref: RoundRef,
    allQuestions: readonly BankedQuestion[],
): BankedQuestion | null {
    return allQuestions.find((q) => q.bank === ref.bank && q.id === ref.id) ?? null;
}

export function remainingSeconds(current: Room | null): number {
    if (!current?.question_ends_at) return 0;
    const ms = new Date(current.question_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
}

export function localRoomPlayer(): RoomPlayer | null {
    const id = playerId();
    return players().find((p) => p.id === id) ?? null;
}

/** True when the local player joined mid-game (server-flagged spectator). */
export function amSpectator(): boolean {
    return localRoomPlayer()?.spectator === true;
}

/* ---------------- Sync plumbing ---------------- */

function syncKey(current: Room | null): string {
    if (!current) return '';
    return [
        current.status,
        current.question_index,
        current.phase,
        current.question_ends_at,
        current.host_player_id,
    ].join('|');
}

async function fetchRoom(): Promise<void> {
    if (!roomId) return;
    const { data, error } = await supabaseClient()
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
    if (error) throw new Error(error.message);
    setRoom(data as Room);
}

async function fetchPlayers(): Promise<void> {
    if (!roomId) return;
    const { data, error } = await supabaseClient()
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as readonly RoomPlayer[];
    setPlayers(rows);
    const id = playerId();
    if (id && !rows.some((p) => p.id === id)) onKicked();
}

/**
 * If the room has no valid host (they left / were cleaned up), the
 * earliest-joined present player claims it. Deterministic, so only one client
 * actually triggers the RPC.
 */
async function maybeClaimHost(): Promise<void> {
    const current = room();
    const roster = players();
    if (claimingHost || !roomId || !current || roster.length === 0) return;
    const host = current.host_player_id;
    if (host && roster.some((p) => p.id === host)) return;
    const eligible = roster
        .filter((p) => !p.spectator)
        .slice()
        .sort(
            (a, b) =>
                new Date(a.joined_at ?? 0).getTime() - new Date(b.joined_at ?? 0).getTime(),
        );
    const first = eligible[0] ?? roster[0];
    if (!first || first.id !== playerId()) return;
    claimingHost = true;
    try {
        await rpc('claim_host', { p_room_id: roomId });
    } catch {
        /* realtime will retry */
    } finally {
        claimingHost = false;
    }
}

function emitUpdate(): void {
    // The host can migrate at any time, so recompute it from the live room on
    // every update rather than only at join time.
    const current = room();
    const id = playerId();
    setIsHost(Boolean(current && id && current.host_player_id === id));
    void maybeClaimHost();
    onUpdate(current, players());
}

function stopTick(): void {
    if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
    }
}

function startTick(): void {
    stopTick();
    tickTimer = setInterval(() => {
        void (async (): Promise<void> => {
            const current = room();
            if (!roomId || !current || current.status !== 'playing') return;
            const endsAt = current.question_ends_at
                ? new Date(current.question_ends_at).getTime()
                : 0;
            if (!endsAt || Date.now() < endsAt - 50) return;
            try {
                const updated = await rpc<Room>('tick_room', { p_room_id: roomId });
                setRoom(updated);
                const key = syncKey(updated);
                if (key !== lastSyncKey) {
                    lastSyncKey = key;
                    await fetchPlayers();
                    emitUpdate();
                }
            } catch (err) {
                console.error('tick_room error:', err);
            }
        })();
    }, 250);
}

function unsubscribeChannels(): void {
    const client = supabaseConfigured() ? supabaseClient() : null;
    if (roomChannel && client) void client.removeChannel(roomChannel);
    if (playersChannel && client) void client.removeChannel(playersChannel);
    roomChannel = null;
    playersChannel = null;
    stopTick();
}

async function refresh(): Promise<void> {
    await fetchRoom();
    await fetchPlayers();
    lastSyncKey = syncKey(room());
    emitUpdate();
}

async function subscribe(): Promise<void> {
    unsubscribeChannels();
    const client = supabaseClient();

    roomChannel = client
        .channel(`room:${String(roomId)}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${String(roomId)}` },
            (payload) => {
                void (async (): Promise<void> => {
                    // Room deleted (host ended it, or zombie cleanup). Keep the cached
                    // player scores so clients can still render results.
                    if (payload.eventType === 'DELETE') {
                        const wasLobby = (room()?.status ?? 'lobby') === 'lobby';
                        stopTick();
                        setRoom({
                            ...(room() ?? ({} as Room)),
                            id: String(roomId),
                            status: wasLobby ? 'closed' : 'finished',
                        });
                        lastSyncKey = `deleted:${wasLobby ? 'closed' : 'finished'}`;
                        emitUpdate();
                        return;
                    }
                    const next = (payload.new as Room | undefined) ?? room();
                    setRoom(next);
                    const key = syncKey(next);
                    if (key !== lastSyncKey) {
                        lastSyncKey = key;
                        await fetchPlayers();
                    }
                    // Emit on every room change (including settings edits, which don't
                    // alter the sync key) so the lobby reflects them for every client.
                    emitUpdate();
                    if (next?.status === 'playing') startTick();
                    if (next?.status === 'finished') stopTick();
                })();
            },
        )
        .subscribe();

    playersChannel = client
        .channel(`room_players:${String(roomId)}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'room_players',
                filter: `room_id=eq.${String(roomId)}`,
            },
            () => {
                void (async (): Promise<void> => {
                    await fetchPlayers();
                    emitUpdate();
                })();
            },
        )
        .subscribe();

    await refresh();
    if (room()?.status === 'playing') startTick();
}

function adoptSession(result: JoinRoomResult, host: boolean): void {
    roomId = result.roomId;
    setPlayerId(result.playerId);
    setIsHost(host);
    writeJson(SESSION_KEY, {
        roomId: result.roomId,
        playerId: result.playerId,
        code: result.code,
        isHost: host,
    });
}

/* ---------------- Public commands ---------------- */

export async function hostRoom(
    mode: GameMode,
    settings: RoomSettings,
    hostName: string,
): Promise<void> {
    const result = await rpc<JoinRoomResult>('create_room', {
        p_mode: mode,
        p_settings: settings,
        p_host_name: hostName,
    });
    adoptSession(result, true);
    await subscribe();
}

export async function joinRoom(code: string, name: string): Promise<void> {
    const result = await rpc<JoinRoomResult>('join_room', {
        p_code: normalizeCode(code),
        p_name: name,
    });
    adoptSession(result, false);
    await subscribe();
}

export async function joinDiscordRoom(
    instanceId: string,
    mode: GameMode,
    settings: RoomSettings,
    name: string,
    discordUserId: string,
): Promise<void> {
    const result = await rpc<JoinRoomResult>('join_discord_room', {
        p_instance_id: instanceId,
        p_mode: mode,
        p_settings: settings,
        p_player_name: name,
        p_discord_user_id: discordUserId,
    });
    adoptSession(result, result.isHost === true);
    await subscribe();
}

function requireHost(): void {
    if (!isHost()) throw new Error('Admin access required');
}

export async function startRoom(
    roundRefs: readonly RoundRef[],
    answerKeys: readonly AnswerKey[],
): Promise<void> {
    requireHost();
    const updated = await rpc<Room>('start_room', {
        p_room_id: roomId,
        p_player_id: playerId(),
        p_round_refs: roundRefs,
        p_answer_keys: answerKeys,
    });
    setRoom(updated);
    lastSyncKey = syncKey(updated);
    startTick();
    emitUpdate();
}

export async function submitAnswer(answer: string, timeLeft: number): Promise<void> {
    await rpc<unknown>('submit_answer', {
        p_room_id: roomId,
        p_player_id: playerId(),
        p_answer: answer,
        p_time_left: Math.max(0, timeLeft),
    });
}

export async function endRoom(): Promise<void> {
    requireHost();
    // The room is kept (status -> finished) so "Play again" can reuse it.
    const updated = await rpc<Room>('end_room', {
        p_room_id: roomId,
        p_player_id: playerId(),
    });
    stopTick();
    setRoom(updated);
    lastSyncKey = syncKey(updated);
    await fetchPlayers();
    emitUpdate();
}

export async function restartRoom(): Promise<void> {
    requireHost();
    const updated = await rpc<Room>('restart_room', {
        p_room_id: roomId,
        p_player_id: playerId(),
    });
    setRoom(updated);
    lastSyncKey = syncKey(updated);
    await fetchPlayers();
    emitUpdate();
}

export async function updateRoomSettings(mode: GameMode, settings: RoomSettings): Promise<void> {
    requireHost();
    const updated = await rpc<Room>('update_room_settings', {
        p_room_id: roomId,
        p_player_id: playerId(),
        p_mode: mode,
        p_settings: settings,
    });
    setRoom(updated);
    emitUpdate();
}

/** Every player's submitted answer for a question (used at reveal time). */
export async function fetchAnswers(questionIndex: number): Promise<readonly RoomAnswerRow[]> {
    if (!roomId) return [];
    const { data, error } = await supabaseClient()
        .from('room_answers')
        .select('player_id,answer')
        .eq('room_id', roomId)
        .eq('question_index', questionIndex);
    if (error) throw new Error(error.message);
    return (data ?? []) as readonly RoomAnswerRow[];
}

export async function kickPlayer(targetPlayerId: string): Promise<void> {
    requireHost();
    await rpc<unknown>('kick_player', {
        p_room_id: roomId,
        p_admin_player_id: playerId(),
        p_target_player_id: targetPlayerId,
    });
    await refresh();
}

export async function makeHost(targetPlayerId: string): Promise<void> {
    requireHost();
    await rpc<unknown>('make_host', {
        p_room_id: roomId,
        p_player_id: playerId(),
        p_target_player_id: targetPlayerId,
    });
    await refresh();
}

export function teardown(): void {
    unsubscribeChannels();
    beaconSent = false;
    roomId = null;
    lastSyncKey = '';
    setPlayerId(null);
    setIsHost(false);
    setRoom(null);
    setPlayers([]);
    removeKey(SESSION_KEY);
}

export async function leaveRoom(): Promise<void> {
    const id = playerId();
    if (roomId && id) {
        try {
            await rpc<unknown>('leave_room', { p_room_id: roomId, p_player_id: id });
        } catch (err) {
            console.warn('leave_room:', err);
        }
    }
    teardown();
}

/**
 * Best-effort leave for page close / refresh. Async RPCs are killed when the
 * renderer unloads, so POST straight to PostgREST with keepalive, which the
 * browser flushes during unload.
 */
export function leaveBeacon(): void {
    const id = playerId();
    const config = supabaseConfig();
    if (beaconSent || !config || !roomId || !id) return;
    beaconSent = true;
    try {
        void fetch(`${config.url.replace(/\/+$/, '')}/rest/v1/rpc/leave_room`, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                apikey: config.anonKey,
                Authorization: `Bearer ${config.anonKey}`,
            },
            body: JSON.stringify({ p_room_id: roomId, p_player_id: id }),
        }).catch(() => undefined);
    } catch {
        /* the page is unloading; nothing more we can do */
    }
}
