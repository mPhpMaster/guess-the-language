<script lang="ts">
  import ArmedButton from '$lib/components/ArmedButton.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import {
    admin,
    type AdminBan,
    type AdminLiveRow,
    type AdminReport,
    type AdminTab,
    type AdminUser
  } from '$lib/services/admin';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let tab = $state<AdminTab>('reports');
  let search = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);

  let reports = $state<AdminReport[]>([]);
  let users = $state<AdminUser[]>([]);
  let live = $state<AdminLiveRow[]>([]);
  let bans = $state<AdminBan[]>([]);

  /** Bumped after a mutation so the active tab refetches. */
  let revision = $state(0);

  const TABS: ReadonlyArray<{ id: AdminTab; labelKey: 'adminReports' | 'adminUsers' | 'adminLive' | 'adminBans' }> = [
    { id: 'reports', labelKey: 'adminReports' },
    { id: 'users', labelKey: 'adminUsers' },
    { id: 'live', labelKey: 'adminLive' },
    { id: 'bans', labelKey: 'adminBans' }
  ];

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  // Load the active tab. Re-runs on tab change, search change and after actions.
  $effect(() => {
    if (!open) return;
    const which = tab;
    const term = search;
    void revision;

    let cancelled = false;
    loading = true;
    error = null;

    const load = async () => {
      if (which === 'reports') reports = await admin.reports();
      else if (which === 'users') users = await admin.users(term);
      else if (which === 'live') live = await admin.live();
      else bans = await admin.banned();
    };

    load()
      .catch((err: unknown) => {
        if (!cancelled) error = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  const refresh = () => (revision += 1);

  function timeAgo(iso: string | null | undefined): string {
    if (!iso) return '—';
    const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    if (secs < 86400) return `${Math.round(secs / 3600)}h`;
    return `${Math.round(secs / 86400)}d`;
  }
</script>

<dialog class="admin-modal" bind:this={dialog} onclose={onclose}>
  <div class="admin-box">
    <div class="admin-head">
      <h3>{i18n.t('adminTitle')}</h3>
      <button class="btn btn-ghost btn-sm" type="button" onclick={onclose}>{i18n.t('close')}</button>
    </div>

    <div class="admin-tabs">
      {#each TABS as t (t.id)}
        <button class="admin-tab" class:is-active={tab === t.id} type="button" onclick={() => (tab = t.id)}>
          {i18n.t(t.labelKey)}
        </button>
      {/each}
    </div>

    {#if tab === 'users'}
      <input
        class="fill-input"
        type="search"
        placeholder={i18n.t('adminSearch')}
        value={search}
        oninput={(e) => (search = e.currentTarget.value)}
      />
    {/if}

    <div class="admin-body">
      {#if loading}
        <p class="lb-note">{i18n.t('adminLoading')}</p>
      {:else if error}
        <p class="auth-error">{i18n.t('adminError')}: {error}</p>
      {:else if tab === 'reports'}
        {#if !reports.length}
          <p class="lb-note">{i18n.t('adminEmpty')}</p>
        {:else}
          {#each reports as r (r.id)}
            <div class="admin-row">
              <span class="admin-badge">{r.status ?? 'open'}</span>
              <span>{r.player ?? '—'} · {r.score ?? '—'} · {r.mode ?? '—'}</span>
              <span>{i18n.t('adminReporter')}: {r.reporter ?? '—'}</span>
              <span>{r.reason ?? ''}</span>
              {#if r.score_id}
                <ArmedButton
                  label={i18n.t('adminDeleteScore')}
                  danger
                  run={() => admin.deleteScore(r.score_id!)}
                  ondone={refresh}
                />
              {/if}
              {#if r.player}
                <ArmedButton label={i18n.t('adminBan')} danger run={() => admin.ban(r.player!)} ondone={refresh} />
              {/if}
              <ArmedButton
                label={i18n.t('adminResolve')}
                run={() => admin.resolveReport(r.id, 'resolved')}
                ondone={refresh}
              />
              <ArmedButton
                label={i18n.t('adminDismiss')}
                run={() => admin.resolveReport(r.id, 'dismissed')}
                ondone={refresh}
              />
            </div>
          {/each}
        {/if}
      {:else if tab === 'users'}
        {#if !users.length}
          <p class="lb-note">{i18n.t('adminEmpty')}</p>
        {:else}
          {#each users as u (u.player)}
            <div class="admin-row">
              <span>{u.player}</span>
              {#if u.banned}<span class="admin-badge">{i18n.t('adminBan')}</span>{/if}
              <span>{i18n.t('levelShort')} {u.level ?? 1}</span>
              <span>{u.games ?? 0} {i18n.t('statGames')}</span>
              <span>{timeAgo(u.last_seen)}</span>
              {#if u.banned}
                <ArmedButton label={i18n.t('adminUnban')} run={() => admin.unban(u.player)} ondone={refresh} />
              {:else}
                <ArmedButton label={i18n.t('adminBan')} danger run={() => admin.ban(u.player)} ondone={refresh} />
              {/if}
              <ArmedButton
                label={i18n.t('adminReset')}
                danger
                run={() => admin.resetProfile(u.player)}
                ondone={refresh}
              />
            </div>
          {/each}
        {/if}
      {:else if tab === 'live'}
        {#if !live.length}
          <p class="lb-note">{i18n.t('adminEmpty')}</p>
        {:else}
          {#each live as l (l.player + l.updated_at)}
            <div class="admin-row">
              <span>{l.player}</span>
              <span class="admin-badge">{l.activity ?? '—'}</span>
              <span>{l.platform ?? '—'}</span>
              <span>{l.mode ?? '—'}</span>
              <span>{i18n.t('adminServer')}: {l.guild_id ?? i18n.t('adminNoServer')}</span>
              <span>{timeAgo(l.updated_at)}</span>
            </div>
          {/each}
        {/if}
      {:else if !bans.length}
        <p class="lb-note">{i18n.t('adminEmpty')}</p>
      {:else}
        {#each bans as b (b.player)}
          <div class="admin-row">
            <span>{b.player}</span>
            <span>{b.reason ?? ''}</span>
            <span>{i18n.t('adminBannedBy')}: {b.banned_by ?? '—'}</span>
            <span>{timeAgo(b.created_at)}</span>
            <ArmedButton label={i18n.t('adminUnban')} run={() => admin.unban(b.player)} ondone={refresh} />
          </div>
        {/each}
      {/if}
    </div>
  </div>
</dialog>
