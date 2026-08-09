import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ModeId } from '$lib/game/types';
import { supabaseConfig } from '$lib/services/supabase';
import { normalizeCode } from './round';
import type {
  AnswerKey,
  JoinResult,
  LeaderboardEntry,
  Room,
  RoomAnswerRow,
  RoomPlayer,
  RoomSettings,
  RoundRef
} from './types';

const STORAGE_KEY = 'gtl_mp_session';
/** How often to check whether the current question's server deadline passed. */
const TICK_MS = 250;

/**
 * Multiplayer room client — Supabase Realtime + RPCs.
 *
 * The room is server-authoritative: the server owns the clock
 * (`question_ends_at`), the scoring and the phase. Clients only mirror it, which
 * is why this store never advances a question on its own — it calls `tick_room`
 * and waits to be told.
 */
class RoomStore {
  // ---- reactive room state ----
  roomId = $state<string | null>(null);
  playerId = $state<string | null>(null);
  code = $state<string | null>(null);
  isHost = $state(false);
  room = $state<Room | null>(null);
  players = $state<RoomPlayer[]>([]);
  /** Set when the player is removed from the room by a host or cleanup. */
  kicked = $state(false);
  lastError = $state<string | null>(null);

  // ---- internals ----
  #client: SupabaseClient | null = null;
  #roomChannel: RealtimeChannel | null = null;
  #playersChannel: RealtimeChannel | null = null;
  #tickTimer: ReturnType<typeof setInterval> | null = null;
  #lastSyncKey = '';
  #claimingHost = false;
  #beaconSent = false;

  // ---- derived ----
  online = $derived(this.roomId !== null && this.room !== null);
  me = $derived(this.players.find((p) => p.id === this.playerId) ?? null);
  amSpectator = $derived(!!this.me?.spectator);
  status = $derived(this.room?.status ?? 'lobby');
  phase = $derived(this.room?.phase ?? null);
  questionIndex = $derived(this.room?.question_index ?? 0);
  roundRefs = $derived<RoundRef[]>(this.room?.round_refs ?? []);
  activePlayers = $derived(this.players.filter((p) => !p.spectator));

  configured(): boolean {
    return supabaseConfig() !== null;
  }

  /**
   * The Supabase SDK is ~400 kB and is only needed for Realtime rooms, so it is
   * imported on demand — a solo player never downloads it. Everything that
   * touches it is already async, so awaiting the import costs nothing extra.
   */
  async #sb(): Promise<SupabaseClient> {
    const cfg = supabaseConfig();
    if (!cfg) throw new Error('Supabase not configured');
    if (!this.#client) {
      const { createClient } = await import('@supabase/supabase-js');
      this.#client ??= createClient(cfg.url, cfg.anonKey);
    }
    return this.#client;
  }

  /** Only valid after `#sb()` has resolved once; used by teardown paths. */
  #clientOrNull(): SupabaseClient | null {
    return this.#client;
  }

  async #rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
    const sb = await this.#sb();
    const { data, error } = await sb.rpc(name, params);
    if (error) throw new Error(error.message || String(error));
    return data as T;
  }

  // ================= session persistence =================

  #saveSession(): void {
    if (!this.roomId || !this.playerId) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ roomId: this.roomId, playerId: this.playerId, code: this.code, isHost: this.isHost })
      );
    } catch {
      /* ignore */
    }
  }

  #clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // ================= sync =================

  /** Any change to this string means the round moved and clients must re-render. */
  #syncKey(room: Room | null): string {
    if (!room) return '';
    return `${room.status}|${room.question_index}|${room.phase}|${room.question_ends_at}|${room.host_player_id}`;
  }

  async #fetchRoom(): Promise<Room | null> {
    if (!this.roomId) return null;
    const { data, error } = await (await this.#sb()).from('rooms').select('*').eq('id', this.roomId).single();
    if (error) throw new Error(error.message);
    this.room = data as Room;
    return this.room;
  }

  async #fetchPlayers(): Promise<RoomPlayer[]> {
    if (!this.roomId) return [];
    const { data, error } = await (await this.#sb())
      .from('room_players')
      .select('*')
      .eq('room_id', this.roomId)
      .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    this.players = (data ?? []) as RoomPlayer[];

    if (this.playerId && !this.players.some((p) => p.id === this.playerId)) this.kicked = true;
    return this.players;
  }

  /**
   * Recompute the host flag on every update — the host can migrate at any time
   * (someone left, was promoted, or a hostless room was healed), so deriving it
   * once at join would go stale.
   */
  #afterUpdate(): void {
    this.isHost = !!(this.room && this.playerId && this.room.host_player_id === this.playerId);
    void this.#maybeClaimHost();
  }

  /**
   * If the room has no valid host, the earliest-joined present player claims it.
   * Deterministic, so exactly one client actually fires the RPC.
   */
  async #maybeClaimHost(): Promise<void> {
    if (this.#claimingHost || !this.roomId || !this.room || !this.players.length) return;
    const host = this.room.host_player_id;
    if (host && this.players.some((p) => p.id === host)) return; // host present

    const eligible = this.players
      .filter((p) => !p.spectator)
      .sort((a, b) => new Date(a.joined_at ?? 0).getTime() - new Date(b.joined_at ?? 0).getTime());
    const first = eligible[0] ?? this.players[0];
    if (!first || first.id !== this.playerId) return;

    this.#claimingHost = true;
    try {
      await this.#rpc('claim_host', { p_room_id: this.roomId });
    } catch {
      /* realtime will bring us back around and retry */
    } finally {
      this.#claimingHost = false;
    }
  }

  async refresh(): Promise<void> {
    await this.#fetchRoom();
    await this.#fetchPlayers();
    this.#lastSyncKey = this.#syncKey(this.room);
    this.#afterUpdate();
  }

  #stopTick(): void {
    if (this.#tickTimer !== null) {
      clearInterval(this.#tickTimer);
      this.#tickTimer = null;
    }
  }

  /**
   * Poll the server deadline. When it passes, ask the server to advance — the
   * client never decides the round moved on, it only notices the clock ran out.
   */
  #startTick(): void {
    this.#stopTick();
    this.#tickTimer = setInterval(() => {
      void (async () => {
        if (!this.roomId || !this.room || this.room.status !== 'playing') return;
        const endsAt = this.room.question_ends_at ? new Date(this.room.question_ends_at).getTime() : 0;
        if (!endsAt || Date.now() < endsAt - 50) return;
        try {
          const updated = await this.#rpc<Room>('tick_room', { p_room_id: this.roomId });
          this.room = updated;
          const key = this.#syncKey(this.room);
          if (key !== this.#lastSyncKey) {
            this.#lastSyncKey = key;
            await this.#fetchPlayers();
            this.#afterUpdate();
          }
        } catch (err) {
          this.lastError = err instanceof Error ? err.message : String(err);
        }
      })();
    }, TICK_MS);
  }

  #unsubscribe(): void {
    const sb = this.#clientOrNull();
    if (!sb) {
      this.#roomChannel = null;
      this.#playersChannel = null;
      return;
    }
    if (this.#roomChannel) {
      void sb.removeChannel(this.#roomChannel);
      this.#roomChannel = null;
    }
    if (this.#playersChannel) {
      void sb.removeChannel(this.#playersChannel);
      this.#playersChannel = null;
    }
  }

  async #subscribe(): Promise<void> {
    this.#unsubscribe();
    const sb = await this.#sb();

    this.#roomChannel = sb
      .channel(`room:${this.roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${this.roomId}` },
        (payload) => {
          void (async () => {
            // Room deleted (host ended it, left a lobby, or zombie cleanup).
            // Keep the cached scores so clients can still render results.
            if (payload.eventType === 'DELETE') {
              const wasLobby = !this.room || this.room.status === 'lobby';
              this.#stopTick();
              this.room = { ...(this.room as Room), status: wasLobby ? 'closed' : 'finished' };
              this.#lastSyncKey = `deleted:${this.room.status}`;
              this.#afterUpdate();
              return;
            }
            this.room = (payload.new as Room) ?? this.room;
            const key = this.#syncKey(this.room);
            if (key !== this.#lastSyncKey) {
              this.#lastSyncKey = key;
              await this.#fetchPlayers();
            }
            // Emit on every room change (including settings edits, which don't
            // alter the sync key) so every client's lobby reflects them.
            this.#afterUpdate();
            if (this.room?.status === 'playing') this.#startTick();
            if (this.room?.status === 'finished') this.#stopTick();
          })();
        }
      )
      .subscribe();

    this.#playersChannel = sb
      .channel(`room_players:${this.roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${this.roomId}` },
        () => {
          void (async () => {
            await this.#fetchPlayers();
            this.#afterUpdate();
          })();
        }
      )
      .subscribe();

    await this.refresh();
    if (this.room?.status === 'playing') this.#startTick();
  }

  #adopt(result: JoinResult, host: boolean): void {
    this.roomId = result.roomId;
    this.playerId = result.playerId;
    this.code = result.code;
    this.isHost = host;
    this.kicked = false;
    this.#saveSession();
  }

  // ================= actions =================

  async host(mode: ModeId, settings: RoomSettings, hostName: string): Promise<JoinResult> {
    const result = await this.#rpc<JoinResult>('create_room', {
      p_mode: mode,
      p_settings: settings,
      p_host_name: hostName
    });
    this.#adopt(result, true);
    await this.#subscribe();
    return result;
  }

  async join(code: string, name: string): Promise<JoinResult> {
    const result = await this.#rpc<JoinResult>('join_room', {
      p_code: normalizeCode(code),
      p_name: name
    });
    this.#adopt(result, false);
    await this.#subscribe();
    return result;
  }

  /** Discord Activity: everyone in the voice channel lands in one room. */
  async joinDiscord(
    instanceId: string,
    mode: ModeId,
    settings: RoomSettings,
    name: string,
    discordUserId: string | null
  ): Promise<JoinResult> {
    const result = await this.#rpc<JoinResult>('join_discord_room', {
      p_instance_id: instanceId,
      p_mode: mode,
      p_settings: settings,
      p_player_name: name,
      p_discord_user_id: discordUserId
    });
    this.#adopt(result, !!result.isHost);
    await this.#subscribe();
    return result;
  }

  async start(roundRefs: RoundRef[], answerKeys: AnswerKey[]): Promise<Room> {
    this.#requireHost();
    const updated = await this.#rpc<Room>('start_room', {
      p_room_id: this.roomId,
      p_player_id: this.playerId,
      p_round_refs: roundRefs,
      p_answer_keys: answerKeys
    });
    this.room = updated;
    this.#lastSyncKey = this.#syncKey(updated);
    this.#startTick();
    this.#afterUpdate();
    return updated;
  }

  submitAnswer(answer: string, timeLeft: number): Promise<unknown> {
    return this.#rpc('submit_answer', {
      p_room_id: this.roomId,
      p_player_id: this.playerId,
      p_answer: answer,
      p_time_left: Math.max(0, timeLeft)
    });
  }

  /** Host-only. The room is kept (status -> finished) so "Play again" can reuse it. */
  async end(): Promise<Room> {
    this.#requireHost();
    const updated = await this.#rpc<Room>('end_room', {
      p_room_id: this.roomId,
      p_player_id: this.playerId
    });
    this.#stopTick();
    this.room = updated;
    this.#lastSyncKey = this.#syncKey(updated);
    await this.#fetchPlayers();
    this.#afterUpdate();
    return updated;
  }

  /** Host-only: reset a finished room back to its lobby for another round. */
  async restart(): Promise<Room> {
    this.#requireHost();
    const updated = await this.#rpc<Room>('restart_room', {
      p_room_id: this.roomId,
      p_player_id: this.playerId
    });
    this.room = updated;
    this.#lastSyncKey = this.#syncKey(updated);
    await this.#fetchPlayers();
    this.#afterUpdate();
    return updated;
  }

  /** Host-only: change mode / settings while in the lobby. */
  async updateSettings(mode: ModeId, settings: RoomSettings): Promise<Room> {
    this.#requireHost();
    const updated = await this.#rpc<Room>('update_room_settings', {
      p_room_id: this.roomId,
      p_player_id: this.playerId,
      p_mode: mode,
      p_settings: settings
    });
    this.room = updated;
    this.#afterUpdate();
    return updated;
  }

  /** Every player's submitted answer for a question — used at reveal time. */
  async fetchAnswers(questionIndex: number): Promise<RoomAnswerRow[]> {
    if (!this.roomId) return [];
    const { data, error } = await (await this.#sb())
      .from('room_answers')
      .select('player_id,answer')
      .eq('room_id', this.roomId)
      .eq('question_index', questionIndex);
    if (error) throw new Error(error.message);
    return (data ?? []) as RoomAnswerRow[];
  }

  async kick(targetPlayerId: string): Promise<void> {
    this.#requireHost();
    await this.#rpc('kick_player', {
      p_room_id: this.roomId,
      p_admin_player_id: this.playerId,
      p_target_player_id: targetPlayerId
    });
    await this.refresh();
  }

  async makeHost(targetPlayerId: string): Promise<void> {
    this.#requireHost();
    await this.#rpc('make_host', {
      p_room_id: this.roomId,
      p_player_id: this.playerId,
      p_target_player_id: targetPlayerId
    });
    await this.refresh();
  }

  async leave(): Promise<void> {
    if (this.roomId && this.playerId) {
      try {
        await this.#rpc('leave_room', { p_room_id: this.roomId, p_player_id: this.playerId });
      } catch {
        /* leaving is best-effort; the zombie cleanup will catch it */
      }
    }
    this.teardown();
  }

  /**
   * Best-effort leave for page close / refresh. Async RPCs are killed when the
   * document unloads, so this POSTs straight to PostgREST with `keepalive`,
   * which the browser flushes during unload.
   */
  leaveBeacon(): void {
    const cfg = supabaseConfig();
    if (this.#beaconSent || !cfg || !this.roomId || !this.playerId) return;
    this.#beaconSent = true;
    try {
      void fetch(`${cfg.url.replace(/\/+$/, '')}/rest/v1/rpc/leave_room`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`
        },
        body: JSON.stringify({ p_room_id: this.roomId, p_player_id: this.playerId })
      }).catch(() => {});
    } catch {
      /* page is unloading; nothing more we can do */
    }
  }

  teardown(): void {
    this.#unsubscribe();
    this.#stopTick();
    this.#beaconSent = false;
    this.roomId = null;
    this.playerId = null;
    this.code = null;
    this.isHost = false;
    this.room = null;
    this.players = [];
    this.kicked = false;
    this.#lastSyncKey = '';
    this.#clearSession();
  }

  #requireHost(): void {
    if (!this.isHost) throw new Error('Host access required');
  }

  /** `avatarOf` prefers the real Discord photo and falls back to the emoji icon. */
  leaderboard(avatarOf: (p: RoomPlayer) => string): LeaderboardEntry[] {
    return this.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: avatarOf(p),
        color: p.color,
        score: p.score,
        you: p.id === this.playerId
      }));
  }
}

export const room = new RoomStore();
