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
- **🧩 Problem Solving** — algorithms, data structures, Big-O complexity, and
  LeetCode-style patterns (two pointers, sliding window, BFS/DFS, DP…).
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

The output is written to `dist/` (e.g. `Guess The Language Setup 3.1.0.exe`).
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
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — public anon key
4. Deploy. If the vars are left empty, the game still runs with a local mock
   leaderboard (same as desktop without Supabase).

> **Supabase on desktop:** copy `src/supabase-config.example.js` to
> `src/supabase-config.js` locally (git-ignored). Web builds inject config from
> Vercel env vars into `dist-web/supabase-config.js` at build time — your local
> Electron config is never overwritten.

---

## How to play

Everything starts on one **home page**: pick a mode card, then **Start**, view
the **leaderboard** (Friends & Scores), open **Settings**, or read **About** — all
without leaving the page.

1. Tap a mode card to select it, then **Start**.
2. A snippet/question appears with a circular countdown (12–15s by difficulty).
3. Pick the correct answer from the buttons — or press the number keys. The HUD
   shows your score and a **correct/total** counter; you can **End** the quiz
   early to jump to the results.
4. The results screen shows your score, how many you got right, and the
   leaderboard. Your name defaults to **User** (change it in Settings).

Switch between **English and Arabic** anytime via the EN / ع toggle (also under
Settings). The choice is persisted, and Arabic flips the UI to RTL.

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
├─ vercel.json                  # Vercel static deploy
├─ pnpm-workspace.yaml          # allows Electron's build script under pnpm
├─ public/                      # web static assets copied to the site root
│  ├─ manifest.webmanifest      # PWA manifest (installable mobile app)
│  ├─ sw.js                     # service worker (offline shell)
│  ├─ icon-192.png / icon-512.png # PWA icons
│  ├─ privacy.html / terms.html # legal pages
├─ supabase/
│  ├─ schema.sql                # leaderboard table (scores + avatar) + RLS
│  ├─ schema-multiplayer.sql    # rooms, players, RPCs, Realtime
│  └─ schema-discord-rooms.sql  # Discord voice-channel rooms (by instanceId)
├─ src/
│  ├─ main.js                   # Electron main process (window + IPC)
│  ├─ preload.js                # secure bridge (window controls + question load)
│  ├─ index.html                # the screens (home / lobby / game / results)
│  ├─ styles.css                # dark + neon theme
│  ├─ renderer.js               # game logic, modes, timer, scoring, leaderboard
│  ├─ web-shim.js               # browser gameAPI/appWindow + SW registration
│  ├─ multiplayer.js            # Supabase Realtime rooms (host/join/sync)
│  ├─ discord-activity.js       # Discord Embedded App SDK bootstrap
│  ├─ vendor/supabase.js          # bundled @supabase/supabase-js (UMD)
│  ├─ supabase-config.js         # Supabase creds (local, git-ignored)
│  ├─ discord-config.js          # Discord client id (local, git-ignored)
│  └─ data/
│     ├─ questions.json          # languages bank (333 questions, 15 languages)
│     ├─ questions-cyber.json    # cybersecurity bank (92 questions)
│     ├─ questions-devops.json   # devops bank (51 questions)
│     ├─ questions-network.json  # networking bank (49 questions)
│     ├─ questions-gamedev.json  # game-dev bank (34 questions)
│     └─ questions-algo.json     # problem-solving bank (42 questions)
└─ test/
   ├─ smoke-main.js             # languages mode end-to-end (14 checks)
   ├─ smoke-cyber.js            # cybersecurity mode (12 checks)
   ├─ smoke-newmodes.js         # devops + networking modes (10 checks)
   ├─ smoke-i18n.js             # language switch / RTL (9 checks)
   ├─ smoke-online.js           # Supabase online-path test (10 checks)
   ├─ smoke-multiplayer.js      # multiplayer UI + client smoke test (26 checks)
   ├─ smoke-all.js              # All (mixed) mode (10 checks)
   ├─ smoke-gamedev.js          # game-dev bank sanity check
   ├─ smoke-algo.js             # problem-solving bank sanity check
   ├─ smoke-shuffle.js          # option-shuffle fairness (3 checks)
   ├─ capture.js                # render screenshots of each screen
   ├─ capture-mp.js             # multiplayer lobby / reveal / results screenshots
   └─ reset-state.js            # clear persisted local state
```

## Questions databases

**Languages** — `src/data/questions.json` holds **333 questions** across 15
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

**Cybersecurity / DevOps / Networking / Game Dev / Problem Solving** —
`questions-cyber.json` (92), `questions-devops.json` (51),
`questions-network.json` (49), `questions-gamedev.json` (34) and
`questions-algo.json` (42) are multiple-choice banks. Each entry has its own
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

The quiz banks are generated by helper scripts in `scripts/` and load automatically.

---

## Cloud leaderboard (Supabase)

The game is fully playable offline with no setup. To enable a real global
leaderboard **and multiplayer rooms**:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql)
   (creates the `scores` table with public read/insert RLS policies).
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

Your leaderboard name is set in the **Settings** screen.

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

```powershell
pnpm exec electron test/smoke-main.js      # offline end-to-end (13 checks)
pnpm exec electron test/smoke-online.js    # Supabase online path (8 checks)
pnpm exec electron test/smoke-multiplayer.js  # multiplayer smoke (UI + helpers)
```

## Roadmap

- ✅ Global leaderboard via Supabase (with place numbers + profile photos)
- ✅ Multiplayer rooms (host/join, synced quiz, room scoreboard, spectators)
- ✅ Discord Activity (auto voice-channel rooms, solo start, challenge links)
- ✅ Login with Discord
- ✅ Installable PWA / mobile app
- ⏳ Real friends system (add / follow) instead of a global board only
- ⏳ Server-validated score submission (anti-cheat) via Edge Function
- ⏳ Native mobile (Android/iOS) build

## License

MIT — see [LICENSE](LICENSE).
