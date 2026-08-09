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

## What is ported

- Home screen: all seven modes, language switch, best score, daily button state
- Round engine: round building, bank balancing, adaptive difficulty, daily
  challenge (deterministic UTC seed), practice mode, scoring with streak
  multiplier, the fast-forward-to-2s behaviour after locking an answer, 50:50
  lifeline, countdown + beeps, feedback delay / manual advance
- All three question styles: language pick, multiple choice, fill-in-the-blank
- Keyboard answering (1–9 / a–f)
- Results: score, accuracy, best streak, wrong-answer review, live leaderboard
  with all-time / this-week scope and per-mode switching, personal rank
- Settings dialog (native `<dialog>`), persisted
- EN/AR with full RTL
- Supabase score submission, daily board, error logging
- **Multiplayer**: host/join by code, lobby with host controls (kick, promote,
  mode change), server-authoritative rounds, spectators (including their own
  Leave button), host migration, room results, play-again, leave-beacon on unload
- **Discord Activity**: SDK handshake with the single-flight `authorize` fix,
  identity adoption, participant tracking for real avatars, `/supabase` URL
  mapping installed before mount, invite dialog
- **Profiles**: stats, XP/level/streak, achievements, per-mode rankings, follows;
  leaderboard rows open a player's card
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

Everything from the original is ported. Two small behaviours are still missing:

- results show 2 of the original 4 stat tiles — *average response* and *fastest
  correct* need per-answer response times recorded into the round history
- no name-validation gate before starting a round: the original blocks Start
  until a valid, non-profane name exists, whereas this plays anonymously and
  simply skips the leaderboard submission

The profanity guard itself (`game/names.ts`) is ported and is applied to every
name that is displayed or submitted.

## Verified

- `pnpm check` — 0 errors, 0 warnings
- `pnpm build` — succeeds; 162.9 kB app JS + 58.5 kB CSS, SDKs split into
  separate on-demand chunks
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
  - Electron: headless smoke test boots `dist/` and asserts the title bar, its
    three window controls, seven mode cards and the preload bridge — SMOKE OK,
    no console errors (a CSP is set, so the Electron security warning is gone)
  - multiplayer against production Supabase: room created (code `NR5B`), host
    crown correct, round started, server advanced Q1 → Q3 across mixed banks,
    score awarded server-side (100), results rendered, play-again returned to the
    lobby, countdown derived from the server deadline (10→9→8→7→6), End + Leave
    cleared the session and returned home
