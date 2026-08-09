<script lang="ts">
  import { avatarFor } from '$lib/game/names';
  import { modeMeta } from '$lib/game/modes';
  import { i18n } from '$lib/i18n/index.svelte';
  import {
    ACHIEVEMENTS,
    fetchFollowing,
    fetchPlayerActivity,
    fetchPlayerRankings,
    fetchPlayerStats,
    followPlayer,
    isFollowing,
    isRecentlyActive,
    levelFromXp,
    levelTitleKey,
    loadMyFollows,
    unfollowPlayer,
    xpForLevel,
    type FollowedPlayer,
    type ModeRank,
    type PlayerActivity,
    type PlayerStats
  } from '$lib/services/profile';
  import type { TextKey } from '$lib/i18n/index.svelte';
  import { settings } from '$lib/state/settings.svelte';

  interface Props {
    /** Player to show; null closes the card. */
    name: string | null;
    avatar?: string | null;
    onclose: () => void;
    /** Switches the card to another player (used by the Following list). */
    onopen?: (name: string, avatar: string | null) => void;
  }

  let { name, avatar = null, onclose, onopen }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let activity = $state<PlayerActivity | null>(null);
  let stats = $state<PlayerStats | null>(null);
  let rankings = $state<ModeRank[]>([]);
  let loading = $state(false);
  let following = $state(false);
  /** Only populated on your own card — following is a private list. */
  let followingList = $state<FollowedPlayer[]>([]);

  const me = $derived(settings.name.trim());
  const isYou = $derived(!!name && name.toLowerCase() === me.toLowerCase());
  const online = $derived(isRecentlyActive(activity?.last_seen));

  const fmt = (n: number) => (Number(n) || 0).toLocaleString('en-US');

  // ---- progression ----
  const level = $derived(activity ? activity.level || levelFromXp(activity.xp) : 1);
  const xpBase = $derived(xpForLevel(level));
  const xpSpan = $derived(Math.max(1, xpForLevel(level + 1) - xpBase));
  const xpInto = $derived(Math.max(0, (activity?.xp ?? 0) - xpBase));
  const xpPercent = $derived(Math.max(0, Math.min(100, Math.round((xpInto / xpSpan) * 100))));
  const streak = $derived(activity?.day_streak ?? 0);
  const earned = $derived(new Set(activity?.achievements ?? []));

  /** Best rank across every mode — the hero cell. */
  const bestRank = $derived.by(() => {
    const ranked = rankings.map((r) => r.rank).filter((r): r is number => !!r);
    return ranked.length ? Math.min(...ranked) : null;
  });

  const rankedModes = $derived(rankings.filter((r) => r.best != null));

  /** The eight stat cells, in the original's order. */
  const cells = $derived.by(() => {
    if (!stats) return [];
    const mpGames = activity?.mp_games ?? 0;
    const wins = activity?.wins ?? 0;
    return [
      { label: i18n.t('statBest'), value: fmt(stats.best) },
      { label: i18n.t('statGames'), value: fmt(stats.games) },
      { label: i18n.t('statWinRate'), value: mpGames > 0 ? `${Math.round((wins / mpGames) * 100)}%` : '—' },
      { label: i18n.t('statHours'), value: activity?.seconds ? `${(activity.seconds / 3600).toFixed(1)}h` : '0h' },
      { label: i18n.t('statAvg'), value: fmt(stats.avg) },
      { label: i18n.t('statMp'), value: fmt(mpGames || stats.mp) },
      { label: i18n.t('statPerfect'), value: fmt(activity?.perfect_games ?? 0) }
    ];
  });

  function medal(rank: number | null): string {
    return rank === 1 ? ' 🥇' : rank === 2 ? ' 🥈' : rank === 3 ? ' 🥉' : '';
  }

  $effect(() => {
    if (!dialog) return;
    if (name && !dialog.open) dialog.showModal();
    else if (!name && dialog.open) dialog.close();
  });

  // Load every section for the player being shown.
  $effect(() => {
    const who = name;
    if (!who) return;
    let cancelled = false;
    loading = true;
    activity = null;
    stats = null;
    rankings = [];
    followingList = [];

    const hidden = i18n.t('hiddenPlayer');
    const mine = who.toLowerCase() === me.toLowerCase();
    void Promise.all([
      fetchPlayerActivity(who, hidden),
      fetchPlayerStats(who, hidden).catch(() => null),
      fetchPlayerRankings(who, hidden).catch(() => []),
      loadMyFollows(me).then(() => isFollowing(who)),
      // Who you follow is yours alone — never fetched for someone else's card.
      mine ? fetchFollowing(me, hidden).catch(() => []) : Promise.resolve([])
    ])
      .then(([act, st, ranks, follows, mySquad]) => {
        if (cancelled) return;
        activity = act;
        stats = st;
        rankings = ranks;
        following = follows;
        followingList = mySquad;
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  async function toggleFollow(): Promise<void> {
    if (!name || isYou || !me) return;
    following = !following;
    if (following) await followPlayer(me, name);
    else await unfollowPlayer(me, name);
  }
</script>

<!--
  Structure mirrors the original `#player-card`: a `dialog.modal` that only
  provides the backdrop and centring, wrapping a `.modal-card`. The stylesheet
  keys the card's width and scrolling off `#player-card .modal-card`, so both the
  id and the inner wrapper are load-bearing rather than decorative.
-->
<dialog id="player-card" class="modal" bind:this={dialog} onclose={onclose}>
  <div class="modal-card">
    {#if name}
      <div class="player-card-head">
        {#if avatar?.startsWith('http')}
          <img class="player-card-avatar" src={avatar} alt="" referrerpolicy="no-referrer" />
        {:else}
          <span class="player-card-avatar">{avatar || avatarFor(name)}</span>
        {/if}
        <div>
          <div class="player-card-name">{name}</div>
          <div class="player-card-lastseen" class:is-online={online}>
            {online ? i18n.t('online') : i18n.t('lastSeen')}
          </div>
        </div>
      </div>

      {#if loading}
        <p class="lb-note">{i18n.t('lbLoading')}</p>
      {:else}
        <!-- Level bar, hero rank, stat cells and achievements all live in this
             one grid — .pcs-levelbar, .pcs-hero and .pcs-ach each span it. -->
        <div class="player-card-profile-stats">
          <div class="pcs-levelbar">
            <div class="pcs-lvl-top">
              <span class="pcs-lvl-badge">{i18n.t('levelShort')} {level}</span>
              <span class="pcs-lvl-title">{i18n.t(levelTitleKey(level) as TextKey)}</span>
              {#if streak >= 2}
                <span class="pcs-streak" title={i18n.t('dayStreak')}>🔥 {streak}</span>
              {/if}
            </div>
            <div class="pcs-xpbar"><div class="pcs-xpfill" style:width="{xpPercent}%"></div></div>
            <div class="pcs-xptext">{fmt(xpInto)} / {fmt(xpSpan)} XP</div>
          </div>

          <div class="pcs-cell pcs-hero">
            <strong class="pcs-value">{bestRank ? `#${bestRank}` : '—'}</strong>
            <span class="pcs-label">{i18n.t('statBestRank')}</span>
          </div>

          {#each cells as cell (cell.label)}
            <div class="pcs-cell">
              <strong class="pcs-value">{cell.value}</strong>
              <span class="pcs-label">{cell.label}</span>
            </div>
          {/each}

          <div class="pcs-ach">
            <div class="pcs-ach-title">
              {i18n.t('achievementsTitle')} · {earned.size}/{ACHIEVEMENTS.length}
            </div>
            <div class="pcs-ach-grid">
              {#each ACHIEVEMENTS as ach (ach.id)}
                {@const label = i18n.t(`ach_${ach.id}` as TextKey)}
                <div class="pcs-ach-item" class:is-earned={earned.has(ach.id)} title={label}>
                  <span class="pcs-ach-icon">{ach.icon}</span>
                  <span class="pcs-ach-name">{label}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        {#if followingList.length}
          <div class="player-card-rankings">
            <div class="player-card-rankings-title">
              {i18n.t('followingTitle')} · {followingList.length}
            </div>
            <div class="player-card-friends-list">
              {#each followingList as friend (friend.name)}
                <button
                  class="friend-row"
                  type="button"
                  disabled={!onopen}
                  onclick={() => onopen?.(friend.name, friend.avatar)}
                >
                  <span class="friend-av">
                    {#if friend.avatar?.startsWith('http')}
                      <img src={friend.avatar} alt="" referrerpolicy="no-referrer" />
                    {:else}
                      {avatarFor(friend.name)}
                    {/if}
                  </span>
                  <span class="friend-name">{friend.name}</span>
                  <span class="friend-score">{fmt(friend.score)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="player-card-rankings">
          <div class="player-card-rankings-title">{i18n.t('rankingsTitle')}</div>
          <div class="player-card-rankings-list">
            {#if rankedModes.length}
              {#each rankedModes as r (r.mode)}
                <div class="player-card-rank-row">
                  <span class="pcr-mode">{modeMeta(r.mode).icon} {modeMeta(r.mode).title[i18n.lang][1]}</span>
                  <span class="pcr-rank">{r.rank ? `#${r.rank}` : '—'}{medal(r.rank)}</span>
                  <span class="pcr-score">{r.best} pts</span>
                </div>
              {/each}
            {:else}
              <p class="player-card-rankings-empty">{i18n.t('noRankings')}</p>
            {/if}
          </div>
        </div>
      {/if}

      <div class="modal-actions">
        {#if !isYou && me}
          <button class="btn btn-sm" type="button" onclick={toggleFollow}>
            {following ? `✓ ${i18n.t('following')}` : `➕ ${i18n.t('follow')}`}
          </button>
        {/if}
        <button class="btn btn-ghost btn-sm" type="button" onclick={onclose}>{i18n.t('close')}</button>
      </div>
    {/if}
  </div>
</dialog>
