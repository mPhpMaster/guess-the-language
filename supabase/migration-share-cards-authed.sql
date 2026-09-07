-- ===========================================================================
-- share-cards uploads move behind /api/share-card.
--
-- APPLY BY HAND in the Supabase SQL editor (project lgpimeppmekfgxpheeqp),
-- WITH the release that ships the endpoint. Hard cutover in one direction only:
-- once the anon insert policy is gone, an older client's direct upload fails
-- and the share sheet falls back to the local blob — degraded, not broken.
--
-- ---------------------------------------------------------------------------
-- Why
-- ---------------------------------------------------------------------------
-- migration-anon-write-bounds.sql pinned the object name to the shape the
-- client writes, and was explicit that this bought nothing against volume:
--
--   "none of that stops someone uploading a LOT of valid cards. Volume is not
--    expressible in RLS; capping it needs the upload to move behind /api with
--    a per-session rate limit, the way /api/submit-score already works."
--
-- This is that. The bucket is public, writable and permanent — the one surface
-- here where abuse costs real money — and counting uploads needs an
-- authenticated door, which RLS is not.
--
-- /api/share-card requires a signed session, rate-limits per identity, names the
-- object itself so no caller can choose a path, and checks the bytes actually
-- start with the PNG magic number rather than trusting the name.
--
-- ---------------------------------------------------------------------------
-- What this costs
-- ---------------------------------------------------------------------------
-- Players with no session token — anonymous web, and the Electron desktop
-- build — no longer get a hosted card URL. uploadShareCard() returns null and
-- the caller already treats that as "no hosted URL", falling back to the local
-- blob. That works everywhere except inside the Discord iframe, whose whole
-- reason for wanting a hosted URL is that it blocks downloads — and inside
-- Discord there is always a session.
--
-- Reads stay open: a card is meant to be opened by anyone with the link.
-- Verified after applying — an anon upload is refused, and an existing card
-- still serves 200 image/png with no key at all.
-- ===========================================================================

-- No insert policy at all: the service-role key used by /api/share-card is not
-- subject to RLS, so it remains the only writer.
drop policy if exists "share_cards_insert" on storage.objects;

-- Unchanged, restated so this file describes the whole end state. There is
-- still no update or delete policy, so a card cannot be overwritten or removed
-- by a client.
drop policy if exists "share_cards_read" on storage.objects;
create policy "share_cards_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'share-cards');
