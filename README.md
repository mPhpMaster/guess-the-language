# Guess the Language

**English** · [العربية](README.ar.md)

An interactive quiz game for **Windows** (Electron), the **web** (also an
installable **PWA / mobile app**), and **Discord** (as an embedded Activity).
From a single home page you pick one of seven quiz modes and race the timer — with
scoring, streaks, a correct/total counter, and a per-mode **live global
leaderboard** (Supabase). The entire UI is available in **English and Arabic**
(with full RTL layout), switchable anytime.

### Seven game modes
- **💻 Programming Languages** — a code snippet appears; guess the language.
  15-language pool (Python, JavaScript, TypeScript, C, C++, C#, Java, Kotlin,
  Swift, Rust, Go, Ruby, PHP, SQL, Bash); each question shows the correct answer
  plus rotating distractors.
- **🛡️ Cybersecurity** — tools, malware, Nmap (and its flags), Metasploit,
  pentest tools (Wireshark, Burp, sqlmap, John, Hydra…), ports and concepts.
- **♾️ DevOps** — Docker, Kubernetes, CI/CD, Git, Terraform/Ansible, cloud (AWS)
  and monitoring (Prometheus/Grafana).
- **🌐 Networking** — OSI model, TCP/IP, DNS/DHCP, IP & subnetting, routing
  (OSPF/BGP), ports and protocols.
- **🎮 Game Dev** — game loops, physics, rendering, ECS, pathfinding, netcode,
  assets and UI systems.
- **🧩 Problem Solving** — **fill-in-the-blank code completion**: type the
  missing token in a snippet. Covers algorithms, data structures, Big-O and
  LeetCode-style patterns (two pointers, sliding window, BFS/DFS, DP…). Grading
  ignores case and spacing.
- **🎲 All (Mixed)** — all six banks shuffled together; each question renders
  with its own answer style.

![Home](screenshots/8-modeselect.png)

| Languages mode | Cybersecurity mode |
| --- | --- |
| ![Game](screenshots/2-game.png) | ![Cyber](screenshots/9-cyber-game.png) |

| Results | About |
| --- | --- |
| ![Results](screenshots/4-results.png) | ![About](screenshots/12-about.png) |

Arabic (RTL):

![Home AR](screenshots/11-modeselect-ar.png)

| Languages mode (AR) | Cybersecurity mode (AR) |
| --- | --- |
| ![Game AR](screenshots/6-game-ar.png) | ![Cyber AR](screenshots/10-cyber-game-ar.png) |

| Results (AR) | About |
| --- | --- |
| ![Results AR](screenshots/7-results-ar.png) | ![About](screenshots/12-about.png) |

---

## Repository layout

The application is a **Svelte 5** app living at the repository root. The
pre-rewrite implementation — the same game written as a vanilla-JS ES-module app
— is kept, unmodified and buildable, under [`v1/`](v1).

```
/                 the application: Svelte 5 + Vite + TypeScript
  src/            components, state (runes), game logic, services
  api/            Vercel serverless functions (Discord auth, reports, admin)
  public/         runtime config, question banks, PWA assets, privacy/terms
  electron/       desktop shell (main + preload)
v1/               the previous app, archived — not built, not deployed
supabase/         SQL schema and RPCs (shared by both)
docs/             design notes; see docs/svelte-rewrite.md
```

Nothing in `v1/` runs in production. It has its own `package.json` and
`vite.config.js`, so it can still be built and run on its own if you need to
compare behaviour — `cd v1 && pnpm install && pnpm run dev:web`.

## Requirements

- [Node.js](https://nodejs.org/) 18+ (developed on v22)
- A package manager — **pnpm** is recommended (`npm` is fine elsewhere; on the
  dev machine npm was broken, so pnpm is used throughout)
- Windows 10/11 (desktop build)
- Any modern browser (web build)

## Run (development)

### Web (browser)

```bash
pnpm install
```

```bash
pnpm dev
```

Serves on <http://localhost:5173>. This is the primary way to run the app —
every target builds from the same `src/`.

### Desktop (Electron)

```bash
pnpm run build:desktop && pnpm electron
```

Electron loads the build from disk over `file://`, which needs relative asset
URLs, so it is a separate build rather than a flag on the normal one. All targets
fetch question banks from `public/data` — there is no IPC channel for them.

## Build

### Web (static site) + PWA / mobile app

```bash
pnpm run build
```

Output lands in `dist/`; `pnpm run preview` smoke-tests it locally. The build
also writes the runtime config files from the environment — see
[Deploy to Vercel](#deploy-to-vercel).

The web build is an installable **PWA**: a web app manifest, a service worker
(cached offline shell), and app icons live in `public/`. On a phone, open the
deployed site and **Add to Home Screen** to run it standalone as a mobile app.
The service worker is registered in production only, and never in Electron or
the Discord iframe — in dev its cache-first strategy shadows Vite's module graph
and keeps serving a stale bundle across reloads.

### Windows installer (.exe)

```bash
pnpm run dist
```

Produces an NSIS installer in `release/`.

### Deploy to Vercel

1. Import the repo in [Vercel](https://vercel.com). Leave the root directory at
   the repository root — `v1/` is excluded by [`.vercelignore`](.vercelignore).
2. Vercel reads [`vercel.json`](vercel.json) — build command `pnpm run build`,
   output directory `dist`.
3. Add environment variables (Project Settings → Environment Variables):

   | Variable | Exposed to the browser | Used by |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | yes | leaderboard, rooms, profiles |
   | `VITE_SUPABASE_ANON_KEY` | yes | same (RLS is the real gate) |
   | `VITE_DISCORD_CLIENT_ID` | yes | Activity + web sign-in |
   | `DISCORD_CLIENT_SECRET` | **no** | `/api/token`, `/api/discord-login` |
   | `APP_SESSION_SECRET` | **no** | signs session tokens (falls back to the secret above) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **no** | `/api/report`, `/api/admin` |
   | `ADMIN_DISCORD_USERNAMES` | **no** | extra admins, comma-separated |

4. Deploy. Left empty, the game still runs — it degrades to offline solo play
   rather than failing.

> **How config reaches the browser.** `index.html` loads
> `/supabase-config.js` and `/discord-config.js` before the bundle, so one build
> artifact can be pointed at a different project without rebuilding. Those files
> hold real credentials and are git-ignored, which means they do **not** exist on
> a Vercel build machine — `scripts/generate-runtime-config.mjs` writes them from
> the environment after every build. A blank environment never overwrites a local
> copy, so your working `public/*-config.js` survives a local build.

---

## How to play

Everything starts on one **home page**: pick a mode card, then **Start**, view
the **Global Leaderboard**, open **Settings**, or read **About** — all
without leaving the page.

1. On the public web build, sign in with Discord. Electron uses the local player
   name from Settings; Discord Activities use the current Discord identity.
2. Tap a mode card to select it, then **Start**.
3. A snippet/question appears with a circular countdown (12–15s by difficulty).
4. Pick the correct answer from the buttons — or press the number keys. The HUD
   shows your score and a **correct/total** counter; you can **End** the quiz
   early to jump to the results.
5. Review the explanation, press **Next**, or let the configured review timer
   advance. Results include accuracy, response times, best streak, incorrect
   answers, personal rank, and the global leaderboard.

Switch between **English and Arabic** anytime via the EN / ع toggle (also under
Settings). The choice is persisted, and Arabic flips the UI to RTL.

Public names are checked in the client and by Supabase. Existing unsafe names
are masked, and signed-in Discord users can report an entry for review.

### Scoring
- Correct answer: **+100**
- Speed bonus: **+10** per remaining second
- Streak: **×1.5** multiplier after 3 correct answers in a row
- Wrong answer or timeout: 0 points and the streak resets

---

## Project structure

```
prog-game2/
├─ package.json                 # scripts + electron-builder config
├─ vite.config.ts               # web / Electron / Discord build
├─ tsconfig.json                # strict TS, $lib alias
├─ vercel.json                  # build command + output directory
├─ .vercelignore                # keeps v1/ out of the upload
├─ index.html                   # loads the runtime config, then the bundle
├─ api/                         # Vercel serverless functions
│  ├─ _session.js               # HMAC sign/verify for app session tokens
│  ├─ token.js                  # Discord Activity code exchange
│  ├─ discord-login.js          # web OAuth2 code exchange
│  ├─ report.js                 # file a leaderboard report
│  └─ admin.js                  # every admin action (service-role only)
├─ electron/
│  ├─ main.cjs                  # frameless window
│  └─ preload.cjs               # contextBridge window controls
├─ public/
│  ├─ data/*.json               # the six question banks
│  ├─ supabase-config.js        # Supabase creds (local, git-ignored)
│  ├─ discord-config.js         # Discord client id (local, git-ignored)
│  ├─ manifest.webmanifest, sw.js, icon-*.png   # PWA
│  └─ privacy.html, terms.html  # legal pages (registered with Discord)
├─ scripts/
│  ├─ generate-runtime-config.mjs  # writes the config files from the env
│  ├─ build-desktop.mjs            # relative-base build for file://
│  └─ smoke-desktop.mjs            # headless Electron smoke test
├─ src/
│  ├─ main.ts                   # mount gating, platform class, SW registration
│  ├─ App.svelte                # screen routing and cross-screen wiring
│  ├─ app.css                   # the theme
│  └─ lib/
│     ├─ game/                  # pure logic: rounds, scoring, highlight, names…
│     ├─ state/                 # runes stores: game, settings, uiScale
│     ├─ multiplayer/           # room store, server-authoritative session
│     ├─ services/              # supabase, discord, profiles, share, admin…
│     ├─ i18n/                  # EN/AR dictionary + reactive store
│     ├─ components/            # dialogs, leaderboard, options grid…
│     └─ screens/               # home, game, results, lobby, mp game/results
├─ supabase/
│  ├─ schema.sql                # leaderboard safety, reports, scores + RLS
│  ├─ schema-multiplayer.sql    # rooms, players, RPCs, Realtime
│  └─ schema-discord-rooms.sql  # Discord voice-channel rooms (by instanceId)
└─ v1/                          # the archived pre-rewrite app (see above)
```

Unit tests sit next to what they test (`src/lib/**/*.test.ts`); the original's
Electron smoke-test suite is in [`v1/test/`](v1/test).

## Questions databases

**Languages** — `src/data/questions.json` holds **365 questions** across 15
languages and three difficulty levels:

```json
{
  "id": 1,
  "correctLanguage": "Python",
  "difficulty": "easy",
  "codeSnippet": "print('Hello, World!')",
  "explanation": { "en": "...", "ar": "..." }
}
```

**Cybersecurity / DevOps / Networking / Game Dev** — `questions-cyber.json`
(92), `questions-devops.json` (51), `questions-network.json` (49) and
`questions-gamedev.json` (34) are multiple-choice banks. Each entry has its own
options:

```json
{
  "id": 1,
  "category": "nmap",
  "difficulty": "easy",
  "codeSnippet": "nmap -sS 10.0.0.5",
  "question": { "en": "What scan does -sS perform?", "ar": "..." },
  "options": ["TCP SYN (stealth) scan", "UDP scan", "TCP connect scan", "Ping sweep"],
  "answer": "TCP SYN (stealth) scan",
  "explanation": { "en": "...", "ar": "..." }
}
```

**Problem Solving** — `questions-algo.json` (34) is a **fill-in-the-blank** bank:
a `codeSnippet` with a `____` blank, a typed `answer` (with optional `accept`
variants), and a bilingual `question` + `explanation` — no `options`:

```json
{
  "id": 1,
  "category": "python",
  "difficulty": "easy",
  "codeSnippet": "____ greet(name):\n    return \"Hi \" + name",
  "question": { "en": "Fill the Python keyword that defines a function.", "ar": "..." },
  "answer": "def",
  "accept": ["def"],
  "explanation": { "en": "...", "ar": "..." }
}
```

The quiz banks are generated by helper scripts in `scripts/` and load automatically.

---

## Cloud leaderboard (Supabase)

The game is fully playable offline with no setup. To enable a real global
leaderboard **and multiplayer rooms**:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql)
   (creates or upgrades scores, name safety, reports, and RLS policies). Existing
   projects should rerun this idempotent file to install the moderation changes.
3. Run [`supabase/schema-multiplayer.sql`](supabase/schema-multiplayer.sql)
   in the same editor (rooms, players, RPCs, Realtime).
4. Copy `src/supabase-config.example.js` to `src/supabase-config.js`.
5. From **Project Settings → API**, paste your `Project URL` and the public
   `anon` key into `src/supabase-config.js`.
6. Restart the app. The results screen now shows the global top 10 with your
   row highlighted, and **Host Room / Join Room** are enabled on the home page.

> The `anon` key is meant to be public in client apps; access is governed by RLS
> policies. If left blank, the game falls back to a local mock leaderboard.
> **Security note:** anon inserts are spoofable from a client. To prevent
> cheating, move score submission behind an Edge Function that validates the run
> (see the comment in `schema.sql`).

Electron leaderboard names are set in **Settings**. Public web and Discord
Activity builds use the authenticated Discord name and avatar.

### Multiplayer rooms

With Supabase configured:

1. Pick a mode on the home page, then **Host Room** — you get a **4-character
   code** to share.
2. Friends tap **Join Room**, enter the code, and wait in the lobby.
3. The **host (admin)** starts the round. Everyone sees the same question at the
   same time; correct answers earn points (same formula as solo play).
4. A **live player list** shows names and running scores during the game.
5. When the round ends, a **room scoreboard** ranks all players, and **Back to
   Lobby** keeps the room for another round.
6. Only the admin can **start**, **end**, or **kick** players (lobby only).

**Inside Discord** the game runs as an embedded **Activity**: everyone in the
same voice channel automatically shares one room (keyed by the voice-channel
instance), a lone player can start a **solo round**, and someone who joins after
the round started joins as a **spectator**. **Challenge a friend** shares a link
(or a Discord DM) that opens the game with the same mode/settings and your score
to beat.

### Seeing what a player is up to

Click a player and you get their **round, score and game mode** — in two places:

- **In Discord.** The game publishes [Rich Presence]
  (https://docs.discord.com/developers/rich-presence/using-with-the-embedded-app-sdk)
  with `setActivity()`, so clicking a member in Discord shows a card with the
  game mode, `Round 5/10 • Score 500`, the party badge (`2 of 12`) and an **Ask
  to Join** button. Presence follows the player's chosen language (EN / AR) and
  can be switched off with **Show my game on Discord** in Settings.
  This needs the `rpc.activities.write` scope; if Discord refuses it the Activity
  still loads normally, just without the card.
  Two portal-side values are mirrored in `src/discord-config.js` — keep them in
  sync: `maxParticipants` must match **Activities → Settings → Maximum
  Participants** (set to 12, matching the 12-slot player colour/icon palette in
  `schema-multiplayer.sql`; an *empty* field there means Discord's default of 5,
  not unlimited), and `presenceImage` is a key from **Rich Presence → Art Assets**
  used as the card's image.
- **In the game.** Clicking a row in the lobby or in-game player list opens a
  **player card** with that player's mode, round, score, correct answers, streak
  and status (playing / spectating / in the lobby), plus **Invite to this room** —
  Discord's native invite sheet for the Activity's voice channel, which drops the
  invitee straight into the same room.

| Host lobby | Answer reveal | Room results |
| --- | --- | --- |
| ![Multiplayer lobby](screenshots/mp-lobby-host.png) | ![Answer reveal](screenshots/mp-reveal.png) | ![Room results](screenshots/mp-results.png) |

---

## Implementation notes

- **Local-first:** the game runs fully without internet or a server. With
  Supabase configured, the comparison screen becomes a real global leaderboard;
  without it, it falls back to local mock data.
- **Syntax highlighting:** a small built-in highlighter — no external
  dependencies, works offline.
- **Sound:** simple WebAudio tones (no audio asset files).
- **Security:** `contextIsolation` on, `nodeIntegration` off, `sandbox` on, a
  strict CSP, and DOM built with `textContent` (leaderboard names can't inject
  markup). High score is stored locally via `localStorage`.

## Tests

```bash
pnpm test
```

86 unit tests over the DOM-free logic — round building and bank balancing,
scoring, the adaptive picker, the syntax tokenizer, name safety, challenge-link
parsing, the results breakdown, and a parity test pinning the multiplayer option
shuffle to the exact LCG the server and existing clients already agree on.

```bash
pnpm run check
```

`svelte-check` — strict TypeScript across every component. It logs a notice
about `v1/vite.config.js` having no Svelte plugin; that is the archived app's
config being picked up by the config scanner, and the run still exits zero.

A headless smoke test covers the desktop shell. It must run *under Electron*,
not node — the script imports `electron` directly:

```bash
pnpm exec electron --disable-gpu scripts/smoke-desktop.mjs
```

The original Electron-driven suite (screen captures, presence, multiplayer UI)
is preserved in [`v1/test/`](v1/test) and runs against the archived app.

## Roadmap

- ✅ Global leaderboard via Supabase (with place numbers + profile photos)
- ✅ Multiplayer rooms (host/join, synced quiz, room scoreboard, spectators)
- ✅ Discord Activity (auto voice-channel rooms, solo start, challenge links)
- ✅ Discord Rich Presence (round / score / mode + Ask to Join) and player cards
- ✅ Login with Discord
- ✅ Installable PWA / mobile app
- ⏳ Real friends system (add / follow) instead of a global board only
- ⏳ Server-validated score submission (anti-cheat) via Edge Function
- ⏳ Native mobile (Android/iOS) build

## License

MIT — see [LICENSE](LICENSE).
