'use strict';

/* ============================================================
   Multiplayer room client — Supabase Realtime + RPCs
   ============================================================ */

(function () {
  const STORAGE_KEY = 'gtl_mp_session';

  let client = null;
  let roomChannel = null;
  let playersChannel = null;
  let tickTimer = null;

  const mp = {
    roomId: null,
    playerId: null,
    code: null,
    isAdmin: false,
    room: null,
    players: [],
    onUpdate: null,
    onKicked: null,
    onError: null,
    lastSyncKey: ''
  };

  function configured() {
    const c = window.SUPABASE_CONFIG;
    return !!(c && c.url && c.anonKey && window.supabase);
  }

  function getClient() {
    if (!configured()) throw new Error('Supabase not configured');
    if (!client) {
      const c = window.SUPABASE_CONFIG;
      client = window.supabase.createClient(c.url, c.anonKey);
    }
    return client;
  }

  function saveSession() {
    if (!mp.roomId || !mp.playerId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      roomId: mp.roomId,
      playerId: mp.playerId,
      code: mp.code,
      isAdmin: mp.isAdmin
    }));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }

  async function rpc(name, params) {
    const { data, error } = await getClient().rpc(name, params);
    if (error) throw new Error(error.message || String(error));
    return data;
  }

  function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = (Number(seed) >>> 0) || 1;
    function rand() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    }
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function timeForDifficulty(d) {
    return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
  }

  // Must match renderer.js normFill() exactly so fill-in answer keys and the
  // client's submitted answers normalise identically for the server's match.
  function normFillKey(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function buildRoundForRoom(allQuestions, settings) {
    let pool = allQuestions.slice();
    if (settings.mode && settings.mode !== 'all') {
      pool = pool.filter((q) => (q.bank || 'languages') === settings.mode);
    }
    if (pool.length === 0) pool = allQuestions.slice();
    if (settings.difficulty && settings.difficulty !== 'all') {
      const byDiff = pool.filter((q) => q.difficulty === settings.difficulty);
      if (byDiff.length) pool = byDiff;
    }
    if (pool.length === 0) pool = allQuestions.slice();

    const shuffled = seededShuffle(pool, Date.now() & 0xffffffff);
    const count = Math.min(settings.questions, shuffled.length);
    const round = shuffled.slice(0, count);

    const roundRefs = [];
    const answerKeys = [];

    const fixedTimer = settings.timer && settings.timer !== 'auto' ? Number(settings.timer) : null;
    round.forEach((q, index) => {
      const bank = q.bank || 'languages';
      const optionSeed = ((Date.now() + index * 9973) & 0xffffffff) || 1;
      const duration = fixedTimer || timeForDifficulty(q.difficulty);
      roundRefs.push({ bank, id: q.id, optionSeed, duration });

      const isCyber = Array.isArray(q.options) && q.answer != null;
      const isFill = !isCyber && q.answer != null && !q.correctLanguage;
      // Fill-in answers are normalised (trim/lowercase/collapse spaces) so the
      // server's exact-match scoring lines up with the client's normalised submit.
      const answer = isFill ? normFillKey(q.answer) : (isCyber ? q.answer : q.correctLanguage);
      answerKeys.push({ index, answer });
    });

    return { roundRefs, answerKeys, round };
  }

  function resolveQuestion(ref, allQuestions) {
    return allQuestions.find((q) => q.bank === ref.bank && q.id === ref.id) || null;
  }

  function me() {
    return mp.players.find((p) => p.id === mp.playerId) || null;
  }

  async function fetchRoom() {
    if (!mp.roomId) return null;
    const { data, error } = await getClient()
      .from('rooms')
      .select('*')
      .eq('id', mp.roomId)
      .single();
    if (error) throw new Error(error.message);
    mp.room = data;
    return data;
  }

  async function fetchPlayers() {
    if (!mp.roomId) return [];
    const { data, error } = await getClient()
      .from('room_players')
      .select('*')
      .eq('room_id', mp.roomId)
      .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    mp.players = data || [];

    if (mp.playerId && !mp.players.some((p) => p.id === mp.playerId)) {
      mp.onKicked?.();
    }
    return mp.players;
  }

  function emitUpdate() {
    mp.onUpdate?.(mp.room, mp.players, me());
  }

  function syncKey(room) {
    if (!room) return '';
    return `${room.status}|${room.question_index}|${room.phase}|${room.question_ends_at}`;
  }

  async function refresh() {
    await fetchRoom();
    await fetchPlayers();
    const key = syncKey(mp.room);
    if (key !== mp.lastSyncKey) {
      mp.lastSyncKey = key;
      emitUpdate();
    } else {
      emitUpdate();
    }
  }

  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function startTick() {
    stopTick();
    tickTimer = setInterval(async () => {
      if (!mp.roomId || !mp.room || mp.room.status !== 'playing') return;
      const endsAt = mp.room.question_ends_at ? new Date(mp.room.question_ends_at).getTime() : 0;
      if (endsAt && Date.now() >= endsAt - 50) {
        try {
          const updated = await rpc('tick_room', { p_room_id: mp.roomId });
          mp.room = updated;
          const key = syncKey(mp.room);
          if (key !== mp.lastSyncKey) {
            mp.lastSyncKey = key;
            await fetchPlayers();
            emitUpdate();
          }
        } catch (e) {
          console.error('tick_room error:', e);
        }
      }
    }, 250);
  }

  function unsubscribeChannels() {
    if (roomChannel) {
      getClient().removeChannel(roomChannel);
      roomChannel = null;
    }
    if (playersChannel) {
      getClient().removeChannel(playersChannel);
      playersChannel = null;
    }
    stopTick();
  }

  async function subscribe() {
    unsubscribeChannels();
    const sb = getClient();

    roomChannel = sb
      .channel(`room:${mp.roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${mp.roomId}`
      }, async (payload) => {
        // Room deleted (admin ended it, host left a lobby, or zombie cleanup).
        // Keep the cached player scores so clients can still render results.
        if (payload.eventType === 'DELETE') {
          const wasLobby = !mp.room || mp.room.status === 'lobby';
          stopTick();
          mp.room = { id: mp.roomId, status: wasLobby ? 'closed' : 'finished' };
          mp.lastSyncKey = `deleted:${mp.room.status}`;
          emitUpdate();
          return;
        }
        mp.room = payload.new || mp.room;
        const key = syncKey(mp.room);
        if (key !== mp.lastSyncKey) {
          mp.lastSyncKey = key;
          await fetchPlayers();
        }
        // Emit on every room change (incl. settings/mode edits, which don't
        // alter syncKey) so the lobby reflects them for every client.
        emitUpdate();
        if (mp.room?.status === 'playing') startTick();
        if (mp.room?.status === 'finished') stopTick();
      })
      .subscribe();

    playersChannel = sb
      .channel(`room_players:${mp.roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${mp.roomId}`
      }, async () => {
        await fetchPlayers();
        emitUpdate();
      })
      .subscribe();

    await refresh();
    if (mp.room?.status === 'playing') startTick();
  }

  async function hostRoom(mode, settings, hostName) {
    const result = await rpc('create_room', {
      p_mode: mode,
      p_settings: settings,
      p_host_name: hostName
    });
    mp.roomId = result.roomId;
    mp.playerId = result.playerId;
    mp.code = result.code;
    mp.isAdmin = true;
    saveSession();
    await subscribe();
    return result;
  }

  async function joinRoom(code, name) {
    const result = await rpc('join_room', {
      p_code: normalizeCode(code),
      p_name: name
    });
    mp.roomId = result.roomId;
    mp.playerId = result.playerId;
    mp.code = result.code;
    mp.isAdmin = false;
    saveSession();
    await subscribe();
    return result;
  }

  async function joinDiscordRoom(instanceId, mode, settings, name, discordUserId) {
    const result = await rpc('join_discord_room', {
      p_instance_id: instanceId,
      p_mode: mode,
      p_settings: settings,
      p_player_name: name,
      p_discord_user_id: discordUserId
    });
    mp.roomId = result.roomId;
    mp.playerId = result.playerId;
    mp.code = result.code;
    mp.isAdmin = !!result.isHost;
    saveSession();
    await subscribe();
    return result;
  }

  async function startRoom(roundRefs, answerKeys) {
    if (!mp.isAdmin) throw new Error('Admin access required');
    const updated = await rpc('start_room', {
      p_room_id: mp.roomId,
      p_player_id: mp.playerId,
      p_round_refs: roundRefs,
      p_answer_keys: answerKeys
    });
    mp.room = updated;
    mp.lastSyncKey = syncKey(mp.room);
    startTick();
    emitUpdate();
    return updated;
  }

  async function submitAnswer(answer, timeLeft) {
    return rpc('submit_answer', {
      p_room_id: mp.roomId,
      p_player_id: mp.playerId,
      p_answer: answer,
      p_time_left: Math.max(0, timeLeft)
    });
  }

  async function endRoom() {
    if (!mp.isAdmin) throw new Error('Admin access required');
    // The room is kept (status -> finished) so "Play again" can reuse it.
    const updated = await rpc('end_room', {
      p_room_id: mp.roomId,
      p_player_id: mp.playerId
    });
    stopTick();
    mp.room = updated;
    mp.lastSyncKey = syncKey(mp.room);
    await fetchPlayers();
    emitUpdate();
    return updated;
  }

  // Host-only: reset a finished room back to its lobby for another round.
  async function restartRoom() {
    if (!mp.isAdmin) throw new Error('Admin access required');
    const updated = await rpc('restart_room', {
      p_room_id: mp.roomId,
      p_player_id: mp.playerId
    });
    mp.room = updated;
    mp.lastSyncKey = syncKey(mp.room);
    await fetchPlayers();
    emitUpdate();
    return updated;
  }

  // Host-only: change the room mode / settings while in the lobby.
  async function updateRoomSettings(mode, settings) {
    if (!mp.isAdmin) throw new Error('Admin access required');
    const updated = await rpc('update_room_settings', {
      p_room_id: mp.roomId,
      p_player_id: mp.playerId,
      p_mode: mode,
      p_settings: settings
    });
    mp.room = updated;
    emitUpdate();
    return updated;
  }

  // Read every player's submitted answer for a question (used at reveal time).
  async function fetchAnswers(questionIndex) {
    if (!mp.roomId) return [];
    const { data, error } = await getClient()
      .from('room_answers')
      .select('player_id,answer')
      .eq('room_id', mp.roomId)
      .eq('question_index', questionIndex);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function kickPlayer(targetPlayerId) {
    if (!mp.isAdmin) throw new Error('Admin access required');
    await rpc('kick_player', {
      p_room_id: mp.roomId,
      p_admin_player_id: mp.playerId,
      p_target_player_id: targetPlayerId
    });
    await refresh();
  }

  async function leaveRoom() {
    if (mp.roomId && mp.playerId) {
      try {
        await rpc('leave_room', {
          p_room_id: mp.roomId,
          p_player_id: mp.playerId
        });
      } catch (e) {
        console.warn('leave_room:', e);
      }
    }
    teardown();
  }

  // Best-effort leave for page close / refresh / navigation. Async RPCs get
  // killed when the renderer unloads, so we POST straight to the PostgREST RPC
  // endpoint with keepalive:true, which the browser flushes during unload.
  let beaconSent = false;
  function leaveBeacon() {
    if (beaconSent || !configured() || !mp.roomId || !mp.playerId) return;
    beaconSent = true;
    const c = window.SUPABASE_CONFIG;
    const base = String(c.url || '').replace(/\/+$/, '');
    try {
      fetch(`${base}/rest/v1/rpc/leave_room`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: c.anonKey,
          Authorization: `Bearer ${c.anonKey}`
        },
        body: JSON.stringify({ p_room_id: mp.roomId, p_player_id: mp.playerId })
      }).catch(() => {});
    } catch (e) {
      /* page is unloading; nothing more we can do */
    }
  }

  function teardown() {
    unsubscribeChannels();
    beaconSent = false;
    mp.roomId = null;
    mp.playerId = null;
    mp.code = null;
    mp.isAdmin = false;
    mp.room = null;
    mp.players = [];
    mp.lastSyncKey = '';
    clearSession();
  }

  function getRoomLeaderboard(avatarFor) {
    return mp.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.icon || avatarFor(p.name),
        color: p.color || null,
        score: p.score,
        you: p.id === mp.playerId
      }));
  }

  function remainingSeconds(room) {
    if (!room?.question_ends_at) return 0;
    const ms = new Date(room.question_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  }

  window.GTL_MULTIPLAYER = {
    configured,
    normalizeCode,
    seededShuffle,
    buildRoundForRoom,
    resolveQuestion,
    remainingSeconds,
    getRoomLeaderboard,
    hostRoom,
    joinRoom,
    joinDiscordRoom,
    startRoom,
    submitAnswer,
    endRoom,
    restartRoom,
    updateRoomSettings,
    fetchAnswers,
    kickPlayer,
    leaveRoom,
    leaveBeacon,
    teardown,
    refresh,
    get state() { return mp; },
    set onUpdate(fn) { mp.onUpdate = fn; },
    set onKicked(fn) { mp.onKicked = fn; },
    set onError(fn) { mp.onError = fn; }
  };
})();
