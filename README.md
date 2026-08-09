# Guess the Language — SolidJS edition

A bilingual (English / العربية) IT quiz game that runs as a **web app (PWA)**, a
**Discord Activity**, and a **Windows desktop app**. Six question banks —
programming languages, cybersecurity, DevOps, networking, game dev and problem
solving — plus daily challenges, realtime multiplayer rooms, XP/levels, and a
global leaderboard.

This is a full refactor of the original vanilla-JS build onto **SolidJS +
TypeScript (strict) + Tailwind CSS v4**.

---

## Stack

| Concern         | Choice                                                            |
| --------------- | ----------------------------------------------------------------- |
| UI              | SolidJS 1.9 (fine-grained reactivity, no virtual DOM)              |
| Language        | TypeScript 5.9, `strict` **plus** every extra soundness flag       |
| Styling         | Tailwind CSS v4 (CSS-first `@theme` tokens, no config file)        |
| Icons           | `lucide-solid` (UI) + `solid-icons/si` (brand marks) — **no emoji** |
| Build           | Vite 6                                                            |
| Desktop         | Electron 39 (TypeScript main + preload)                           |
| Backend         | Supabase (PostgREST + Realtime + RPCs) & Vercel serverless API     |
| Discord         | `@discord/embedded-app-sdk` v2                                     |

### Strictness

`tsconfig.json` enables `strict` and, on top of it:

`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`, `allowUnreachableCode: false`, `verbatimModuleSyntax`,
`isolatedModules`.

There is no `any` and no non-null assertion (`!`) in the application source. The
same flags apply to `electron/` and `api/`, each of which has its own tsconfig.

### No emoji

Every glyph in the UI is a component from an icon package:

- `src/components/icons.tsx` is the single registry — UI icons from
  `lucide-solid`, language brand marks (Python, Rust, Go, …) from
  `solid-icons/si`.
- Player avatars without a Discord photo render as a **generated initials disc**
  with a name-derived colour, replacing the old emoji avatar pool.
- Achievements, mode cards, rank badges, and the share card all use icons or
  drawn shapes.

---

## Layout

```
index.html               Vite entry (CSP injected at build time only)
src/
  main.tsx               render root, service-worker registration
  App.tsx                screen switch, dialogs, boot sequence
  styles.css             Tailwind import + @theme design tokens
  types/models.ts        the whole domain model
  i18n/                  en.ts is the source of truth; ar.ts must match its keys
  lib/                   platform, storage, settings, identity, discord,
                         supabase, multiplayer, leaderboard, profile,
                         progression, presence, heartbeat, admin, share,
                         round/daily/scoring, highlight, audio, uiScale
  state/game.ts          the reactive store: every screen reads from here
  state/ui.ts            which overlay is open
  components/            ui.tsx primitives, icons.tsx, screens/, dialogs/
  data/                  the six question banks (code-split at build time)
electron/                main.ts + preload.ts (compiled to electron/dist)
api/                     Vercel serverless functions (TypeScript)
supabase/                SQL schema for scores, rooms, admin, progression
scripts/                 CommonJS build/config/question tooling (.cjs)
```

The imperative `renderer.js` is gone: screens render from `state/game.ts`, so
there is no DOM mutation outside Solid. The syntax highlighter now returns typed
tokens instead of an HTML string, which removes the last `innerHTML` path.

Question banks are loaded with `import.meta.glob`, so each bank becomes its own
lazy chunk — that also means Electron works from `file://` without the old IPC
bridge (`fetch` of a local JSON path is blocked there).

---

## Development

```bash
pnpm install
pnpm dev
```

The dev server writes placeholder `public/supabase-config.js` and
`public/discord-config.js` on first run. Fill them in (or set the matching env
vars for a real build) to enable the leaderboard, multiplayer, and Discord.

## Build

```bash
pnpm build          # typecheck + vite build -> dist-web/ + injected config
pnpm typecheck      # app + electron + api
pnpm dist           # web build + electron compile + Windows NSIS installer
pnpm test:smoke     # headless Electron: does the shell load the built app?
```

`pnpm build` runs `tsc --noEmit` first, so a type error fails the build.

## Environment

| Variable                       | Used by                                   |
| ------------------------------ | ----------------------------------------- |
| `VITE_DISCORD_CLIENT_ID`       | Activity handshake, web OAuth             |
| `DISCORD_CLIENT_SECRET`        | `/api/token`, `/api/discord-login`        |
| `VITE_SUPABASE_URL` / `_ANON_KEY` | leaderboard, rooms, progression         |
| `SUPABASE_SERVICE_ROLE_KEY`    | `/api/report`, `/api/admin` (server only) |
| `APP_SESSION_SECRET`           | HMAC for session tokens                   |
| `ADMIN_DISCORD_USERNAMES`      | extra admins (owner `alhlack` is implicit) |

---

## Notes carried over from the original build

These behaviours are deliberate and were preserved in the refactor:

- **`authorize()` is single-flight.** The Discord SDK throws "Already authing" if
  a second call starts while the first is pending, so the presence-scope request
  falls back to base scopes only *after* it rejects — never on a racing timeout.
- **Discord blocks clipboard writes and downloads inside the iframe.** The share
  card is uploaded to Supabase Storage first so there is a real https URL to hand
  to `openExternalLink` / `shareLink`.
- **`img-src` must include `blob:`** or the canvas share-card preview is blocked.
- **Zero scores are never posted** to the global leaderboard.
- **Spectators** (joined mid-round) get their own Leave button, since End is
  host-only.
- Practice rounds are scored locally but never submitted.
