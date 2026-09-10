# Guess the Language


An interactive quiz game for **Windows** (Electron), the **web** (also an
installable **PWA / mobile app**), and **Discord** (as an embedded Activity).
From a single home page you pick one of seven quiz modes and race the timer — with
scoring, streaks, a correct/total counter, XP and levels, daily challenges, and a
per-mode **live global leaderboard** (Supabase). **2,035 questions** across eight
banks. The UI is English.

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
- **🧩 Problem Solving** — three banks in one mode. **Fill-in-the-blank code
  completion** (type the missing token; grading ignores case and spacing) over
  algorithms, data structures, Big-O and LeetCode-style patterns, plus
  **spot-the-bug** and **predict-the-output** multiple choice.
- **🎲 All (Mixed)** — all eight banks shuffled together; each question renders
  with its own answer style.

| Mode | Bank(s) | Questions |
| --- | --- | ---: |
| Programming Languages | `questions.json` | 522 |
| Cybersecurity | `questions-cyber.json` | 240 |
| DevOps | `questions-devops.json` | 200 |
| Networking | `questions-network.json` | 200 |
| Game Dev | `questions-gamedev.json` | 200 |
| Problem Solving | `questions-algo.json` + `-bug` + `-output` | 673 |
| **All (Mixed)** | every bank | **2035** |

![Home](screenshots/8-modeselect.png)

| Languages mode | Cybersecurity mode |
| --- | --- |
| ![Game](screenshots/2-game.png) | ![Cyber](screenshots/9-cyber-game.png) |

| Results | About |
| --- | --- |
| ![Results](screenshots/4-results.png) | ![About](screenshots/12-about.png) |

---

## Requirements

- [Node.js](https://nodejs.org/) 18+ (developed on v22)
- A package manager — **pnpm** is recommended (`npm` is fine elsewhere; on the
  dev machine npm was broken, so pnpm is used throughout)
- Windows 10/11 (desktop build)
- Any modern browser (web build)

## Run (development)

### Desktop (Electron)

```powershell
pnpm install      # install dependencies
pnpm start        # launch the desktop app
```

### Web (browser)

```powershell
pnpm install
pnpm dev:web      # http://localhost:5173
```

The same `src/` UI powers both runtimes. Electron uses IPC to load question
banks from disk; the browser uses `fetch`. A small `web-shim.js` provides the
same `gameAPI` / `appWindow` surface when preload is not present.

## Build

### Windows installer (.exe)

```powershell
pnpm run dist     # produces an NSIS installer in dist/
# or a portable, uninstalled build:
pnpm run pack
```

The output is written to `dist/` (e.g. `Guess The Language Setup 3.30.0.exe`).
On the dev machine, build to `release/` to avoid a `dist/` file lock:
`pnpm exec electron-builder --win -c.directories.output=release`.

### Web (static site) + PWA / mobile app

```powershell
pnpm run build:web    # output in dist-web/
pnpm run preview:web  # smoke-test the production build locally
```

The web build is an installable **PWA**: a web app manifest, a service worker
(cached offline shell), and app icons live in `public/`. On a phone, open the
deployed site and **Add to Home Screen** to run it standalone as a mobile app.
The service worker is registered only on the web — never in Electron or the
Discord iframe.

### Deploy to Vercel

1. Import the repo in [Vercel](https://vercel.com).
2. Vercel reads [`vercel.json`](vercel.json) — build command `pnpm run build:web`,
   output directory `dist-web`.
3. Add environment variables (Project Settings → Environment Variables):

   | Variable | Exposed to | Used for |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | client | Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | client | public anon key (RLS-governed) |
   | `VITE_DISCORD_CLIENT_ID` | client | Discord Activity / login |
   | `SUPABASE_URL` | server | project URL for the API routes |
   | `SUPABASE_SERVICE_ROLE_KEY` | server | privileged key used by `api/*` |
   | `APP_SESSION_SECRET` | server | HMAC key for session tokens |
   | `DISCORD_CLIENT_ID` | server | OAuth token exchange |
   | `DISCORD_CLIENT_SECRET` | server | OAuth token exchange |
   | `ADMIN_DISCORD_USERNAMES` | server | who may open the admin panel |
   | `ADMIN_PASSCODE` | server | second factor for the admin panel |

   Only the `VITE_`-prefixed values reach the browser. The rest are read by the
   serverless functions in `api/` and never appear in the bundle.
4. Deploy. If the vars are left empty, the game still runs with a local mock
   leaderboard (same as desktop without Supabase).

> **Supabase on desktop:** copy `src/supabase-config.example.js` to
> `src/supabase-config.js` locally (git-ignored). Web builds inject config from
> Vercel env vars into `dist-web/supabase-config.js` at build time — your local
> Electron config is never overwritten.

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
├─ package.json                 # scripts + electron-builder + web (Vite) config
├─ vite.config.js               # web dev/build (root = src/)
├─ vercel.json                  # Vercel static deploy + serverless functions
├─ pnpm-workspace.yaml          # allows Electron's build script under pnpm
├─ api/                         # Vercel serverless functions (server-only keys)
│  ├─ _session.js               # HMAC session tokens: issue, verify, admin claim
│  ├─ token.js                  # Discord OAuth code -> access token
│  ├─ discord-login.js          # web sign-in; mints the app session cookie
│  ├─ join-room.js              # the only way to take a seat in a room
│  ├─ submit-score.js           # server-validated single-player scores
│  ├─ record-progress.js        # XP, levels, streaks, achievements
│  ├─ share-card.js             # challenge/share card creation
│  ├─ follow.js                 # follow / unfollow, attributed to the session
│  ├─ report.js                 # leaderboard-name reports
│  └─ admin.js                  # admin panel: reports, bans, resets, live view
├─ public/                      # web static assets copied to the site root
│  ├─ manifest.webmanifest      # PWA manifest (installable mobile app)
│  ├─ sw.js                     # service worker (offline shell, versioned cache)
│  ├─ icon-192.png / icon-512.png # PWA icons
│  └─ privacy.html / terms.html # legal pages
├─ supabase/
│  ├─ schema.sql                # leaderboard safety, reports, scores + RLS
│  ├─ schema-multiplayer.sql    # rooms, players, RPCs, Realtime
│  ├─ schema-discord-rooms.sql  # Discord voice-channel rooms (by instanceId)
│  ├─ schema-admin.sql          # admin RPCs, bans, presence heartbeat
│  ├─ snapshot.sql              # the live schema, for drift checking
│  └─ migration-*.sql           # applied in order; see scripts/schema-drift.js
├─ src/
│  ├─ main.js                   # Electron main process (window + IPC)
│  ├─ preload.js                # secure bridge (window controls + question load)
│  ├─ index.html                # the screens (home / lobby / game / results)
│  ├─ styles.css                # terminal / IDE theme
│  ├─ renderer.js               # entry point; boots the modules below
│  ├─ modules/                  # the game logic, split by concern
│  │  ├─ game.js round.js results.js home.js     # play loop and screens
│  │  ├─ state.js events.js boot.js app.js       # wiring
│  │  ├─ identity.js profile.js api.js           # who you are, server calls
│  │  ├─ leaderboard.js mp-ui.js presence.js     # boards, rooms, Discord card
│  │  ├─ admin.js settings.js                    # admin panel, preferences
│  │  └─ highlight.js format.js dom.js util.js   # rendering helpers
│  ├─ web-shim.js               # browser gameAPI/appWindow + SW registration
│  ├─ multiplayer.js            # Supabase Realtime rooms (host/join/sync)
│  ├─ discord-activity.js       # Discord Embedded App SDK bootstrap
│  ├─ vendor/supabase.js        # bundled @supabase/supabase-js (UMD)
│  ├─ supabase-config.js        # Supabase creds (local, git-ignored)
│  ├─ discord-config.js         # Discord client id (local, git-ignored)
│  └─ data/                     # 2035 questions, English only
│     ├─ questions.json          # languages bank (522, 15 languages)
│     ├─ questions-cyber.json    # cybersecurity bank (240)
│     ├─ questions-devops.json   # devops bank (200)
│     ├─ questions-network.json  # networking bank (200)
│     ├─ questions-gamedev.json  # game-dev bank (200)
│     ├─ questions-algo.json     # fill-in-the-blank bank (276)
│     ├─ questions-bug.json      # spot-the-bug bank (200)
│     └─ questions-output.json   # predict-the-output bank (197)
├─ scripts/
│  ├─ validate-questions.js     # schema, duplicates, answer-length bias
│  ├─ check-new-bias.js         # pre-flights a staged batch before appending
│  ├─ append-questions.js       # the safe appender (guards id collisions)
│  ├─ schema-drift.js           # repo SQL vs. production: signatures + grants
│  └─ copy-web-assets.js        # build-time config and asset generation
└─ test/
   ├─ smoke-main.js             # languages mode end-to-end (14 checks)
   ├─ smoke-cyber.js            # cybersecurity mode (12 checks)
   ├─ smoke-newmodes.js         # devops + networking modes (10 checks)
   ├─ smoke-fill.js             # fill-in-the-blank mode play (16 checks)
   ├─ smoke-all.js              # All (mixed) mode (14 checks)
   ├─ smoke-shuffle.js          # option-shuffle fairness (3 checks)
   ├─ smoke-i18n.js             # English-only UI strings + migration (11 checks)
   ├─ smoke-online.js           # Supabase online-path test (10 checks)
   ├─ smoke-multiplayer.js      # multiplayer UI + client (33 checks)
   ├─ smoke-arena.js            # room lifecycle and scoring (29 checks)
   ├─ smoke-presence.js         # Discord presence + player card (53 checks)
   ├─ smoke-discord.js          # Activity bootstrap (12 checks)
   ├─ smoke-ux.js               # responsive + accessibility (19 checks)
   ├─ smoke-session.js          # session tokens, admin claim, key domain (27)
   ├─ smoke-join-room.js        # every seat path goes through /api/join-room (38)
   ├─ smoke-mp-auth.js          # room RPC seat tokens and admin checks (41)
   ├─ smoke-submit-score.js     # score bounds and identity stamping (23)
   ├─ smoke-record-progress.js  # XP/level/streak server rules (23)
   ├─ smoke-share-card.js       # share cards are authenticated (14)
   ├─ smoke-follow.js           # follows are attributable (22)
   ├─ smoke-report-api.js       # report endpoint (8 checks)
   ├─ smoke-weekly-board.mjs    # weekly leaderboard window (10 checks)
   ├─ smoke-algo.js / smoke-gamedev.js  # bank sanity checks
   ├─ probe-anon-surface.js     # black-box probe of production with the anon key
   ├─ capture.js                # render screenshots of each screen
   ├─ capture-mp.js             # multiplayer lobby / reveal / results screenshots
   └─ reset-state.js            # clear persisted local state
```

## Questions databases

**2,035 questions** live in `src/data/`, split into eight banks. Every bank
numbers its own ids from 1; the app de-duplicates on the composite key
`bank|id`. All content is **English only** — the `ar` keys were removed in
`257b1f5`, and the validator rejects them.

**Languages** — `questions.json` (**522**), 15 languages, three difficulties.
There is no `question` field: the prompt is always "which language is this?".

```json
{
  "id": 1,
  "correctLanguage": "Python",
  "difficulty": "easy",
  "codeSnippet": "print('Hello, World!')",
  "explanation": { "en": "..." }
}
```

**Multiple choice** — `questions-cyber.json` (**240**), `questions-devops.json`
(**200**), `questions-network.json` (**200**), `questions-gamedev.json`
(**200**), `questions-bug.json` (**200**) and `questions-output.json` (**197**).
Exactly four options each:

```json
{
  "id": 1,
  "category": "nmap",
  "difficulty": "easy",
  "codeSnippet": "nmap -sS 10.0.0.5",
  "question": { "en": "What scan does -sS perform?" },
  "options": ["TCP SYN (stealth) scan", "UDP scan", "TCP connect scan", "Ping sweep"],
  "answer": "TCP SYN (stealth) scan",
  "explanation": { "en": "..." }
}
```

**Fill-in-the-blank** — `questions-algo.json` (**276**): a `codeSnippet`
containing a `____` blank, a typed `answer` with optional `accept` variants,
and no `options`:

```json
{
  "id": 1,
  "category": "python",
  "difficulty": "easy",
  "codeSnippet": "____ greet(name):\n    return \"Hi \" + name",
  "question": { "en": "Fill the Python keyword that defines a function." },
  "answer": "def",
  "accept": ["def"],
  "explanation": { "en": "..." }
}
```

### Adding questions

`pnpm run build:web` runs the validator first, so a bad bank fails the build.

```powershell
# 1. stage the batch as scripts/new/<name>.json (complete objects, explicit ids)
node scripts/check-new-bias.js <name>.json          # BEFORE appending
node scripts/append-questions.js questions-cyber.json <name>.json
node scripts/validate-questions.js --strict         # after each bank
```

Two guards matter, and they measure different things:

- **Content duplicates.** The key is `norm(question.en) + '||' + norm(codeSnippet)`,
  checked within and across every bank. Most knowledge questions carry an empty
  snippet, so the prompt alone has to be unique. In the three Problem Solving
  banks (`bug`, `output`, `algo`) the prompt is boilerplate and the snippet *is*
  the question, so there the **snippet alone** must also be unique within the
  bank — otherwise "What is printed?" and "What is the output?" over one snippet
  pass as two questions.
- **Answer-length bias.** A question is *exploitable* when the correct option is
  strictly the longest **and** the gap is visible (`(max − min) / mean > 0.6`) —
  length alone would point at it. `validate-questions.js --strict` fails a bank
  above 15%.

`check-new-bias.js` runs both rules over the staged file **alone**. That is the
point: the validator averages a bad batch of 20 against a bank of 200, dilute
enough to pass while still making the bank worse.

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
> **The anon key can no longer write a score.** Scores, progress, room seats,
> share cards and follows all go through the authenticated endpoints in `api/`,
> which verify a signed session, bound the values and stamp the Discord id
> server-side. Run `node scripts/schema-drift.js` and
> `node test/probe-anon-surface.js` after any RLS, policy or grant change — the
> first checks the repo's SQL against production, the second probes the live
> deployment with the public key and asserts what it *cannot* do.

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
- **Server-authoritative writes:** the client never holds a privileged key. Each
  `api/` route verifies an HMAC-signed session, rate-limits per identity, and
  takes the Discord id from the token rather than from the request body.
- **Identity:** `player_stats` is keyed by `discord_id`, so a rename carries your
  XP, level and streak with you; rows with no Discord id stay claimable by name.

## Tests

Two runners. Suites that drive the UI need Electron; the rest are plain Node.

```powershell
pnpm run validate       # question schema, duplicates, answer-length bias
pnpm run test:data      # validator + every plain-node suite (session, api, banks)
pnpm run test:ux        # responsive/accessibility + report API
pnpm run check:schema   # repo SQL vs. production: signatures, RLS, policies, grants
```

```powershell
# Electron-driven suites, one process each
pnpm exec electron --disable-gpu test/smoke-main.js         # 14 checks
pnpm exec electron --disable-gpu test/smoke-multiplayer.js  # 33 checks
pnpm exec electron --disable-gpu test/smoke-presence.js     # 53 checks
pnpm exec electron --disable-gpu test/smoke-arena.js        # 29 checks
```

```powershell
# against the live deployment, with the public anon key only
node test/probe-anon-surface.js
```

The screenshots in this README are generated, not hand-taken:

```powershell
pnpm exec electron --disable-gpu test/capture.js     # every single-player screen
pnpm exec electron --disable-gpu test/capture-mp.js  # lobby / reveal / results
pnpm exec electron scripts/make-discord-cover.js     # re-render the invite banner
```

> Two traps worth knowing. A plain-node suite launched under Electron hangs until
> it times out. And `node --check` on an ES module does not apply the module
> goal — it reports OK on a file that really does have a syntax error, so use the
> Electron suites to catch that.

## Roadmap

- ✅ Global leaderboard via Supabase (with place numbers + profile photos)
- ✅ Multiplayer rooms (host/join, synced quiz, room scoreboard, spectators)
- ✅ Discord Activity (auto voice-channel rooms, solo start, challenge links)
- ✅ Discord Rich Presence (round / score / mode + Ask to Join) and player cards
- ✅ Login with Discord
- ✅ Installable PWA / mobile app
- ✅ Real friends system (follow / unfollow, attributed to your Discord identity)
- ✅ Server-validated score submission (anti-cheat) via authenticated `api/` routes
- ✅ Discord-id-keyed identity: a rename keeps your XP, level and streak
- ✅ Admin panel (reports, bans, resets, live view) behind a signed admin claim
- ⏳ Native mobile (Android/iOS) build

## License

MIT — see [LICENSE](LICENSE).
