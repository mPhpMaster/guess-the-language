# Guess the Language — Svelte 5 rewrite

A rewrite of the game's client in **Svelte 5 (runes) + TypeScript + Vite**, living
in its own directory so the shipping app in `../src` keeps running untouched.

```bash
pnpm install --ignore-workspace
pnpm dev              # http://localhost:5273
pnpm build            # web / Discord build -> dist/
pnpm build:desktop    # Electron build (relative asset URLs) -> dist/
pnpm electron         # run the desktop shell against dist/
pnpm dist             # package a Windows installer -> release/
pnpm check            # svelte-check (0 errors)
pnpm test             # vitest — 80 unit tests over the pure logic
```

## Why Svelte (and why a separate directory)

Svelte compiles away, so the runtime cost is the smallest of the mainstream
frameworks — the thing that matters most here, because the Discord Activity runs
in an iframe and a large share of players are on mobile data.

The initial download is **~163 kB of JS (58 kB gzipped)**. The two heavy SDKs are
code-split and fetched only when actually needed:

| Chunk | Size | Loaded when |
| --- | --- | --- |
| app | 163 kB | always |
| `@supabase/supabase-js` | 217 kB | first multiplayer room (Realtime) |
| `@discord/embedded-app-sdk` | 159 kB | running inside the Discord Activity |

A solo web player downloads none of the other two.

The rewrite lives in `svelte-app/` rather than replacing `../src` so the two can
run side by side and be compared. Nothing here imports from `../src`.

## Architecture

```
src/
  main.ts                    mount + error hooks
  App.svelte                 screen routing, score reporting, <html lang/dir>
  app.css                    the original stylesheet, reused verbatim
  lib/
    game/                    pure logic — no DOM, no reactivity, unit-testable
      types.ts               domain types (RawQuestion, Question, RoundAnswer…)
      constants.ts           language pool, option colours, mode ids
      modes.ts               per-mode bilingual titles/descriptions
      round.ts               shuffling, scoring, bank balancing, daily seed,
                             fill grading, question normalization
      adaptive.ts            AdaptivePicker (difficulty that tracks the player)
      highlight.ts           tokenizer for the code panel
      names.ts               name sanitising + profanity guard + emoji avatars
      challenge.ts           challenge payload encode/decode (pure, no browser)
    multiplayer/             rooms — server-authoritative Realtime client
      room.svelte.ts         room state, RPCs, channels, host migration
      session.svelte.ts      the round as the local player sees it
      round.ts               seeded dealing the server and clients agree on
      avatars.ts             Discord photo -> emoji icon fallback
    i18n/
      dictionary.ts          277 EN/AR keys, generated from the original
      index.svelte.ts        reactive language state, t(), diffLabel(), pick()
    state/
      settings.svelte.ts     persisted player settings, high scores, daily marker
      game.svelte.ts         the round engine
    services/
      supabase.ts            tiny PostgREST client
      leaderboard.ts         score submit / top scores / personal rank / daily
      questions.ts           per-bank JSON loading, cached
      errors.ts              error_logs reporting + global hooks
      audio.ts               synthesized SFX + haptics
      profile.ts             stats, XP/level, achievements, follows, rankings
      presence.ts            Discord rich-presence card + admin heartbeat
      admin.ts               admin client (UI gate only; server enforces)
      share.ts               result card canvas, upload, challenge links
    components/              CodePanel, TimerRing, OptionsGrid, FillForm,
                             Leaderboard, ProfileCard, AdminPanel, ShareOverlay,
                             TitleBar, dialogs
    screens/                 Home, Game, Results, Lobby, MpGame, MpResults
electron/                    frameless desktop shell (main + preload)
scripts/                     desktop build + headless Electron smoke test
```

### Tests

`pnpm test` runs 80 unit tests over the pure modules — the ones deliberately
kept free of DOM and reactivity. The two that matter most:

- **Multiplayer shuffle parity.** `multiplayer/round.test.ts` keeps a verbatim
  copy of the original `multiplayer.js` LCG and asserts the port produces
  identical output across a spread of seeds. Rooms mix clients on different
  builds, so a drift here would show two players the same question with options
  in different positions and the server would grade the wrong one.
- **Daily determinism.** The daily set is asserted identical across times of day
  and across bank load order, and different across a UTC rollover.

Also covered: scoring (including the practice-mode Infinity trap), bank
balancing, the profanity guard's obfuscation folding, question normalization for
all three styles, the highlighter's losslessness, adaptive difficulty, and
challenge-payload validation against hostile input.

The Electron shell has a separate headless smoke test
(`electron --disable-gpu scripts/smoke-desktop.mjs`).

### Verifying the Discord path without Discord

`inDiscordEmbed()` decides from the URL alone, so appending the query params
Discord uses puts the app into its embedded mode locally:

    http://localhost:5273/?frame_id=test&instance_id=test

The SDK handshake then fails (it is not a real Discord iframe), which is exactly
the state that broke the original — and the point of the check is that the game
must stay playable anyway. What to expect:

| Signal | Expected |
| --- | --- |
| `<html>` class | `platform-discord` |
| Title bar | hidden |
| Host/Join buttons | hidden (rooms are automatic in Discord) |
| Mode grid | 3 columns, descriptions hidden, ~58px cards |
| Home padding-bottom | 84px (`--discord-safe-bottom`, clears the voice bar) |
| Console | `Discord Activity setup skipped: …` warning, app still mounts |
| Supabase requests | routed through `/supabase` (they fail locally — there is no proxy) |
| Gameplay | a round starts and plays normally |

The Supabase failures are the simulation lacking Discord's proxy, not a fault.
Seeing the requests go to `/supabase` at all is the positive signal: it means the
URL mapping was installed before boot, which is the fix from v3.12.2.

### Decisions worth knowing

**The engine owns the data; components only render.** `game.svelte.ts` replaces
the ~1,200 lines of `game.js` that mutated a global `state` object and hand-patched
the DOM after every change (`$('#q-current').textContent = …`). Nothing in
`lib/game` or `lib/state` touches the DOM.

**The highlighter returns tokens, not HTML.** The original built an HTML string
and assigned it to `innerHTML`. `highlight.ts` returns a `Token[]` that
`CodePanel.svelte` renders through normal Svelte escaping, so a question bank can
never inject markup. This removed the app's only `innerHTML` path in the game loop.

**i18n is reactive rather than a DOM sweep.** The original re-walked every
`[data-i18n]` node on each language change. Here components read `i18n.t(...)`,
which subscribes them to the language rune — switching languages just re-renders,
and `<html lang/dir>` follows in one effect.

**Translation keys are type-checked.** `TranslationKey` is derived from the English
table, so a typo like `t('lbEmty')` is a compile error. The dictionary was lifted
mechanically out of the old `i18n.js` — 277 keys, EN and AR fully parallel, no
string retyped.

**Question banks stay out of the bundle.** The six JSON files (~520 kB) are served
from `public/data` and fetched per bank, cached per session, so a single-bank round
doesn't pay for the other five.

**The stylesheet is reused as-is.** `app.css` is a byte-for-byte copy of the
original `styles.css`, and the components keep the original class names. That keeps
the visual design identical and makes the diff reviewable. Moving rules into
component `<style>` blocks is a follow-up, not part of the conversion.

**Admin authority is server-side only.** `services/admin.ts` reads the session
token's claims *without verifying them* purely to decide whether to show the admin
button. A forged token reveals a button and nothing else: `/api/admin` verifies
the HMAC signature and the admin claim, and the underlying RPCs are granted to
`service_role` only. Verified against production — no auth 401, forged token 401,
GET 405.

**One question-loading path for every target.** The original desktop build read
banks over an Electron IPC channel while web fetched them. Here all three targets
fetch from `dist/data`, so the preload bridge shrank to window controls only.
The desktop build is separate (`pnpm build:desktop`) purely because file:// needs
relative asset URLs.

**Runtime config, not build-time.** `public/supabase-config.js` and
`public/discord-config.js` load before the bundle (copy the `.example.js` files),
so one build artifact can point at different projects. Both are optional — missing
config degrades to offline play. The real files are gitignored.

## Configuration

Credentials come from the same places the original project uses, so one set
serves both builds.

**Runtime config** — `index.html` loads two plain scripts before the bundle:

| File | Sets | Source |
| --- | --- | --- |
| `public/supabase-config.js` | `window.SUPABASE_CONFIG` | copied from the root project; gitignored |
| `public/discord-config.js` | `window.DISCORD_CONFIG` | copied from the root project; gitignored |

They are read at runtime rather than baked in, so one build artifact can be
pointed at a different Supabase project or Discord app without rebuilding. Both
are optional — missing config degrades to offline solo play instead of failing.

Because those files hold real credentials they are gitignored, which means they
do **not** exist on a Vercel build machine. `scripts/generate-runtime-config.mjs`
(run automatically after `vite build`) writes them from the environment instead:

```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_DISCORD_CLIENT_ID
```

A blank env never clobbers a local `public/` copy, and if neither supplies
anything a blank stub is written so the `<script>` tag does not 404. Copy
`.env.example` to `.env.local` for the full list, including the server-only
`DISCORD_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_SESSION_SECRET`.

**Serverless functions** live in `api/` and are ported from the root project's
`api/` (ESM instead of CommonJS; the HMAC token format is unchanged, so existing
sessions keep working):

- `token.js` — Activity handshake code exchange, mints the signed session token
- `discord-login.js` — web OAuth2 code exchange
- `report.js` — files a leaderboard report as the *signed* user
- `admin.js` — every admin action, service-role only
- `_session.js` — sign/verify; `api/admin.js` is the real authorization boundary

In `vite dev` only `/api/token` is stubbed (see `vite.config.ts`), so reporting
and admin actions fail locally by design rather than reaching production.

## What is ported

- Home screen: all seven modes, language switch, best score, daily button state
- Round engine: round building, bank balancing, adaptive difficulty, daily
  challenge (deterministic UTC seed), practice mode, scoring with streak
  multiplier, the fast-forward-to-2s behaviour after locking an answer, 50:50
  lifeline, countdown + beeps, feedback delay / manual advance
- All three question styles: language pick, multiple choice, fill-in-the-blank
- Keyboard answering (1–9 / a–f)
- Results: score, all four stat tiles (accuracy, best streak, average response,
  fastest correct), per-category accuracy breakdown (by bank on a mixed round, by
  difficulty otherwise), wrong-answer review, live leaderboard with all-time /
  this-week scope and per-mode switching, personal rank
- First-run onboarding tips, shown once and never over a lobby
- Settings and About dialogs (native `<dialog>`), persisted settings
- Name gate before a round or hosting: local profanity check, then the server's
  `is_safe_player_name`, then a duplicate check against the live board
- EN/AR with full RTL
- Supabase score submission, daily board, error logging
- **Multiplayer**: host/join by code, lobby with host controls (kick, promote,
  mode change), server-authoritative rounds, spectators (including their own
  Leave button), host migration, room results, play-again, leave-beacon on unload
- **Discord Activity**: SDK handshake with the single-flight `authorize` fix,
  identity adoption, participant tracking for real avatars, `/supabase` URL
  mapping installed before mount, invite dialog, Ask-to-Join (the published join
  secret routes the joiner into that exact room)
- **Web Discord sign-in**: OAuth2 authorization-code flow with a CSRF state
  check, the spent `?code` stripped before mount, and the sign-in gate that only
  ever applies on the plain web build — inside the Activity a top-level redirect
  is blocked, so gating there would strand the player
- **Reporting**: report a leaderboard entry through `/api/report`, with the
  reporter taken from the signed session rather than the request body
- **Profiles**: stats, XP/level/streak, achievements, per-mode rankings, follows
  and your own Following list; leaderboard rows open a player's card
- **Presence**: Discord rich-presence card (solo + room, party badge, Ask-to-Join
  secret) and the admin heartbeat
- **Admin panel**: reports, users, live players and bans, with click-twice
  confirmation instead of `window.confirm` (which Discord's iframe suppresses)
- **Share & challenge**: 1080x1350 result card with the player's Discord photo,
  public-bucket upload, context-aware share actions, challenge deep links and the
  end-of-round verdict
- **UI auto-scaling**: responsive transform-scale with the manual-override flag
- **PWA**: manifest, icons and a service worker (production only)
- **Electron**: frameless desktop shell with a custom title bar, its own
  relative-base build and electron-builder packaging

## Known gaps

One deliberate deviation: the original also offered "invite to this room" from
the player card, duplicating the lobby's invite button. Only the lobby one is
ported — the two ran identical code.

Everything else from the original is ported, and the Discord path has been exercised
as far as is possible without Discord (see above): the layout, the proxy
ordering, the error reporting and the stays-playable-on-failure guarantee all
check out locally.

What cannot be simulated is a *successful* handshake — a real `authorize`,
token exchange, `setActivity` presence card, participant list and voice-channel
auto-join. Those paths are ported with their original fixes intact (notably the
single-flight `authorize`), but they have not run against a live Discord client.
That is the remaining risk, and it argues for shipping this behind a separate
path to a small group first rather than swapping it in.

## Verified

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 86 unit tests pass
- `pnpm build` — succeeds; 159.4 kB app JS + 58.6 kB CSS, SDKs split into
  separate on-demand chunks
- Second pass over the original modules found six unported behaviours; all six
  are now in and were exercised in the browser:
  - onboarding overlay appears once, dismissal persists across reloads
  - sign-in gate turns Start into "Sign in with Discord to play" on the web, and
    stays absent inside the Activity (verified with the `frame_id` simulation)
  - accuracy breakdown grouped by bank on a mixed round
  - report dialog opens against a real board row, all three reasons present, and
    the failure path shows `reportFailed` (dev has no `/api/report`, so nothing
    was actually filed)
  - follow → own card shows "Following · 1" with that player's best score →
    clicking the row switches the card to them → unfollow cleans up
  - runtime-config generator: keeps `public/` when the env is blank, writes from
    the env when it is not
- Runtime, in-browser, no console errors throughout:
  - solo: mode select → question → answer → feedback → auto-advance → results;
    keyboard answering scored +100, matching the original's timer fast-forward
  - live leaderboard returns real production rows
  - Arabic sets `lang=ar` / `dir=rtl`, translates the tree, persists
  - profile card against production: opened RealCyGuy from the live board —
    Lvl 2 "Novice", 1875 XP, 2/12 achievements, rank #2 in Mixed, matching their
    row; heartbeat RPC accepted (204)
  - admin endpoint (production): no auth 401, forged token 401, bad action 401,
    GET 405; the admin button stays hidden without a session
  - challenge deep link presets mode + settings and shows the banner; playing it
    through yields the verdict with {you}/{target} filled in; the share card
    decodes at 1080x1350 and the bucket upload returns 200 / public read 200
  - name gate: empty name blocks Start and opens Settings; a leet/zero-width
    obfuscated name ("f_u.c​k3r") is rejected as not allowed
  - all four stat tiles populate with measured values (17% / 1 / 2.5s / 10.0s)
  - simulated Discord embed (`?frame_id=…&instance_id=…`): platform-discord
    applied, title bar and Host/Join hidden, compact 3-column grid with the 84px
    safe-area padding, handshake failure logged to `error_logs` through the
    `/supabase` mapping rather than dying in a console.warn, and a round still
    starts and plays — the failed-handshake-must-stay-playable guarantee
  - Electron: headless smoke test boots `dist/` and asserts the title bar, its
    three window controls, seven mode cards and the preload bridge — SMOKE OK,
    no console errors (a CSP is set, so the Electron security warning is gone)
  - multiplayer against production Supabase: room created (code `NR5B`), host
    crown correct, round started, server advanced Q1 → Q3 across mixed banks,
    score awarded server-side (100), results rendered, play-again returned to the
    lobby, countdown derived from the server deadline (10→9→8→7→6), End + Leave
    cleared the session and returned home
