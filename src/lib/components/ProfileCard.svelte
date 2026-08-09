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

  const level = $derived(activity ? (activity.level || levelFromXp(activity.xp)) : 1);
  /** Progress through the current level, as a percentage for the XP bar. */
  const levelProgress = $derived.by(() => {
    if (!activity) return 0;
    const floor = xpForLevel(level);
    const ceiling = xpForLevel(level + 1);
    const span = ceiling - floor;
    return span > 0 ? Math.max(0, Math.min(100, ((activity.xp - floor) / span) * 100)) : 0;
  });
  const unlocked = $derived(new Set(activity?.achievements ?? []));

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
    const mine = !!who && who.toLowerCase() === me.toLowerCase();
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

<dialog class="modal-card" bind:this={dialog} onclose={onclose}>
  {#if name}
    <div class="player-card-head">
      {#if avatar?.startsWith('http')}
        <img class="player-card-avatar" src={avatar} alt="" referrerpolicy="no-referrer" />
      {:else}
        <span class="player-card-avatar">{avatar || avatarFor(name)}</span>
      {/if}
      <div>
        <div class="player-card-name">{name}</div>
        <div class="player-card-lastseen" class:is-online={isRecentlyActive(activity?.last_seen)}>
          {isRecentlyActive(activity?.last_seen) ? i18n.t('online') : i18n.t('lastSeen')}
        </div>
      </div>
    </div>

    {#if loading}
      <p class="lb-note">{i18n.t('lbLoading')}</p>
    {:else}
      {#if activity}
        <div class="player-card-level">
          <strong>{i18n.t('levelShort')} {level}</strong>
          <span>{i18n.t(levelTitleKey(level) as TextKey)}</span>
          <div class="level-bar"><div class="level-bar-fill" style:width="{levelProgress}%"></div></div>
          <span class="level-xp">{activity.xp} XP</span>
        </div>
      {/if}

      {#if stats}
        <div class="player-card-profile-stats">
          <div><strong>{stats.games}</strong><span>{i18n.t('statGames')}</span></div>
          <div><strong>{stats.best}</strong><span>{i18n.t('statBest')}</span></div>
          <div><strong>{stats.avg}</strong><span>{i18n.t('statAvg')}</span></div>
          <div><strong>{stats.mp}</strong><span>{i18n.t('statMp')}</span></div>
        </div>
      {/if}

      {#if activity}
        <div class="player-card-achievements">
          {#each ACHIEVEMENTS as ach (ach.id)}
            <span
              class="achievement"
              class:is-locked={!unlocked.has(ach.id)}
              title={i18n.t(`ach_${ach.id}` as TextKey)}
            >
              {ach.icon}
            </span>
          {/each}
        </div>
      {/if}

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
                <span class="friend-score">{friend.score}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if rankings.length}
        <div class="player-card-rankings">
          <div class="player-card-rankings-title">{i18n.t('rankingsTitle')}</div>
          <div class="player-card-rankings-list">
            {#each rankings as r (r.mode)}
              <div class="player-card-rank-row">
                <span>{modeMeta(r.mode).icon} {modeMeta(r.mode).title[i18n.lang][1]}</span>
                <strong>{r.rank ? `#${r.rank}` : '—'}</strong>
                <span>{r.best}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

    <div class="player-card-actions">
      {#if !isYou && me}
        <button class="btn btn-sm" type="button" onclick={toggleFollow}>
          {following ? i18n.t('following') : i18n.t('follow')}
        </button>
      {/if}
      <button class="btn btn-ghost btn-sm" type="button" onclick={onclose}>{i18n.t('close')}</button>
    </div>
  {/if}
</dialog>
