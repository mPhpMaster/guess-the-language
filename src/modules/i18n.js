import { renderHome } from './home.js';
import { syncDiscordNameField } from './identity.js';
import { AR, MODES_AR } from './i18n-ar.js';

// ============================================================
//  UI strings — English (the source of truth) and Arabic (i18n-ar.js).
//  Question content stays English in both: the banks are English-only.
// ============================================================
export const I18N = {
    en: {
        appTitle: 'Guess the Language',
        appSlug: 'guess-the-language',
        appTitleMono: 'guess_the_language',
        homeSub: 'Pick a mode and beat the timer.',
        langPrompt: 'Which language is this?',
        fillSubmit: 'Submit',
        fillPlaceholder: 'Type the missing code…',
        fillPrompt: 'Fill in the blank (____)',
        endQuiz: 'end',
        correctLabel: 'Correct:',
        aboutTitle: 'About',
        aboutButton: 'About',
        linkCopied: 'Link copied',
        correctWord: 'correct',
        mainMenu: 'Main menu',
        missedTitle: 'missed',
        youSuffix: '(you)',
        answeredYou: 'you:',
        answeredAnswer: '· answer:',
        answeredTimeout: 'timeout · answer:',
        reportEntry: 'Report',
        gameSettings: 'Game settings',
        badgeReady: 'ready',
        badgeHost: 'host',
        aboutDesc: 'An IT quiz game: programming languages, cybersecurity, DevOps & networking.',
        aboutQuestions: 'Questions:',
        close: 'Close',
        closeLower: 'close',
        start: 'run ▸',
        friends: 'Global Leaderboard',
        settings: 'Settings',
        bestScore: 'Best score:',
        settingsTitle: 'Settings',
        settingsDescription: 'Adjust your quiz preferences.',
        settingName: 'Your leaderboard name',
        settingNameDiscord: 'Your name (from Discord)',
        discordNameNote: 'Your public name and avatar come from Discord.',
        settingQuestions: 'Questions per round',
        settingSound: 'Sound effects',
        settingAdaptive: 'Adaptive difficulty',
        settingDifficulty: 'Difficulty',
        settingFeedbackDelay: 'Answer review time',
        feedback2: '2 seconds',
        feedback4: '4 seconds',
        feedback6: '6 seconds',
        feedbackManual: 'Manual',
        diffAll: 'All',
        diffEasy: 'Easy',
        diffMedium: 'Medium',
        diffHard: 'Hard',
        save: 'save & close',
        score: 'Score:',
        // Terminal/IDE HUD: the label sits above the value, uppercase and mono.
        hudScore: 'SCORE',
        hudCorrect: 'CORRECT',
        hudStreak: 'STREAK',
        answerWithKeys: 'press 1–{n} to answer',
        signedInDiscord: 'signed in · discord',
        tbRound: 'round',
        tbResults: 'results',
        tbLeaderboard: 'leaderboard —',
        tbLobby: 'lobby · room',
        tbProfile: 'profile —',
        railRank: 'rank',
        railAccuracy: 'accuracy',
        railBest: 'best',
        lbColRank: 'rank',
        lbColPlayer: 'player',
        lbColScore: 'score',
        lbColGames: 'games',
        lbColDays: 'days',
        hintTab: 'hint.md',
        snippetTab: 'snippet.??',
        hintCategory: 'category',
        hintDifficulty: 'difficulty',
        hintMasked: 'The answer is hidden below.',
        question: 'Q',
        finalScore: 'final score',
        comparison: 'Global Leaderboard',
        globalLeaderboard: 'global leaderboard',
        challenge: 'Challenge a friend',
        replay: 'play again ▸',
        backMenu: 'Home',
        webAuthHint: 'Sign in with Discord to save your identity and play on the global leaderboard.',
        loginToJoinRoom: 'Sign in with Discord to join room {code}.',
        retry: 'Retry',
        nextQuestion: 'next ▸',
        gameTitle: 'Quiz in progress',
        lobbyTitle: 'Multiplayer lobby',
        joinHint: 'Paste a 4-letter code or type it manually.',
        endConfirmAction: 'End',
        endConfirmTitle: 'End this quiz?',
        endConfirmDesc: 'Your current progress will be shown in the results.',
        continueQuiz: 'Keep playing',
        statAccuracy: 'Accuracy',
        statStreak: 'Best streak',
        statAverage: 'Average response',
        statFastest: 'Fastest correct',
        reviewAnswers: 'Review incorrect answers',
        noIncorrect: 'No incorrect answers to review.',
        yourAnswer: 'Your answer',
        correctAnswer: 'Correct answer',
        personalRank: 'Your global rank',
        you: '(you)',
        lbLoading: 'Loading leaderboard…',
        bootLoading: 'Connecting…',
        settingUiScale: 'Interface size',
        lbOnline: '🌐 Global leaderboard',
        lbOffline: '⚠ Could not reach the leaderboard — showing only your result.',
        lbScoreNotSaved: '⚠ Your score could not be saved — showing the global leaderboard.',
        correct: 'Correct!',
        streakBonus: '(×1.5 🔥)',
        wrong: 'Wrong — correct answer:',
        timeUp: "Time's up! Answer:",
        loadFail: '⚠ Failed to load questions',
        challengeCopied: '✅ Challenge copied!',
        loading: 'Loading…',
        modeSelectTitle: 'Choose a game mode',
        modeLanguages: 'Programming Languages',
        modeLanguagesDesc: 'Guess the language from a code snippet',
        modeCyber: 'Cybersecurity',
        modeCyberDesc: 'Tools, malware, Nmap, Metasploit & more',
        modeDevops: 'DevOps',
        modeDevopsDesc: 'Docker, Kubernetes, CI/CD, Git, IaC & cloud',
        modeNetwork: 'Networking',
        modeNetworkDesc: 'OSI, TCP/IP, DNS, routing & protocols',
        modeGamedev: 'Game Dev',
        modeGamedevDesc: 'Game loops, physics, rendering, assets and UI systems',
        modeAlgo: 'Problem Solving',
        modeAlgoDesc: 'Fill the blank, fix the bug or predict the output',
        modeSql: 'SQL & Databases',
        modeSqlDesc: 'Queries, joins, indexes, transactions & schema design',
        modeRegex: 'Regex',
        modeRegexDesc: 'Patterns, groups, lookarounds & flags',
        modeGit: 'Git',
        modeGitDesc: 'Branching, merging, rebasing, history & undo',
        modeLinux: 'Linux CLI',
        modeLinuxDesc: 'Files, permissions, pipes, processes & text tools',
        modeAi: 'AI & ML',
        modeAiDesc: 'Models, training, evaluation, neural nets & LLMs',
        modeAll: 'All (Mixed)',
        modeAllDesc: 'Everything: every mode together',
        changeMode: 'Mode',
        questionsWord: 'questions',
        soundOn: 'on',
        soundOff: 'off',
        diff: {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard'
        },
        hostRoom: 'Host room',
        joinRoom: 'Join room',
        discordVoiceRoom: 'Voice channel',
        discordVoiceRoomHint: 'Everyone in this call',
        discordAutoMp: 'Multiplayer is automatic here — everyone in this voice channel shares the same room.',
        discordJoining: 'Joining voice channel room…',
        discordMpUnavailable: "Multiplayer couldn't connect — you can still play solo below.",
        createRoom: '🏠  Create Room',
        backToLobby: '🔙  Back to Lobby',
        discordCreateHint: 'Enter your voice channel’s shared room lobby.',
        returnLobbyFailed: 'Could not reach the room — try again.',
        challengeSent: '✅ Challenge sent!',
        challengeFailed: 'Could not open the share dialog.',
        challengeWon: '🎉 Challenge beaten!',
        challengeLost: '💪 Challenge not beaten',
        challengeWonSub: 'You scored {you} — the target was {target}. Send them a challenge back!',
        challengeLostSub: 'You scored {you}, the target was {target}. So close — try again!',
        challengeBack: '🔗  Challenge them back',
        challengeDismiss: 'Dismiss',
        adminButton: 'Admin',
        adminTitle: '🛡️ Admin panel',
        adminReports: 'Reports',
        adminUsers: 'Users',
        adminLive: 'Live',
        adminBans: 'Bans',
        adminEmpty: 'Nothing here.',
        adminLoading: 'Loading…',
        adminError: 'Request failed.',
        adminDeleteScore: 'Delete score',
        adminBan: 'Ban',
        adminUnban: 'Unban',
        adminResolve: 'Resolve',
        adminDismiss: 'Dismiss',
        adminReset: 'Reset profile',
        adminConfirm: 'Confirm?',
        adminSearch: 'Search player…',
        adminReporter: 'Reporter',
        adminBannedBy: 'by',
        adminActivityHome: 'On home',
        adminActivityLobby: 'In lobby',
        adminActivityPlaying: 'Playing',
        adminServer: 'Server',
        adminNoServer: 'No server (web)',
        adminJoin: 'Join',
        adminJoinHint: 'Join this room as a player',
        adminJoinAmbiguous: 'This player is in more than one room — joining the most recent one.',
        adminJoinGone: 'That room has ended.',
        adminJoinFail: 'Could not join that room.',
        adminDone: '✓ Done',
        adminUnlockTitle: '🔒 Admin passcode',
        adminUnlockHint: 'Enter the admin passcode to open the panel.',
        adminUnlockLabel: 'Passcode',
        adminUnlockPlaceholder: 'Passcode',
        adminUnlockSubmit: 'Unlock',
        adminUnlockChecking: 'Checking…',
        adminUnlockWrong: 'Incorrect passcode.',
        adminUnlockLocked: 'Too many attempts. Try again in {min} min.',
        adminUnlockUnset: 'No admin passcode is configured on the server.',
        adminUnlockExpired: 'Admin session expired — enter the passcode again.',
        loginDiscord: 'Login with Discord',
        loginDiscordToPlay: 'Sign in with Discord to play',
        logoutDiscord: 'Log out',
        discordLinkedAs: 'Signed in as',
        discordLoginFailed: 'Discord login failed. Please try again.',
        unsafeName: 'That name is not allowed. Please choose a different name.',
        hiddenPlayer: 'Hidden player',
        report: 'Report',
        reportTitle: 'Report leaderboard entry',
        reportDesc: 'Tell us why this entry should be reviewed.',
        reportReason: 'Reason',
        reportOffensive: 'Offensive name',
        reportImpersonation: 'Impersonation',
        reportSpam: 'Spam or other',
        reportDetails: 'Details (optional)',
        reportSubmit: 'Submit report',
        reportSuccess: 'Thanks. This entry was sent for review.',
        reportDuplicate: 'You have already reported this entry.',
        reportFailed: 'The report could not be sent. Please try again.',
        roomCode: 'Room code',
        copyCode: 'copy',
        playersTitle: 'Players',
        waitingHost: 'Waiting for host…',
        startGame: 'start game ▸',
        endRoom: 'End room',
        endGame: 'End Game',
        leaveRoom: 'Leave',
        joinConfirm: 'Join',
        joining: 'Joining…',
        adminBadge: 'host',
        kickPlayer: 'Remove',
        kickPlayerAdmin: 'Remove — admin',
        roomResults: 'Room Results',
        mpNeedOnline: 'Multiplayer requires an online connection — see README',
        mpJoinFail: 'Could not join room',
        mpHostFail: 'Could not create room',
        codeCopied: '✅ Code copied!',
        challengeLinkCopied: '🔗 Link copied!',
        spectating: '👁  Spectating — the game is in progress',
        mpKicked: 'You were removed from the room',
        waitingOpponents: '⏳ Waiting for opponents…',
        lobbySettings: 'Game settings',
        settingTimer: 'Time per question',
        timerAuto: 'Auto (by difficulty)',
        multiplayerScore: 'Multiplayer score',
        nameRequired: 'Please enter your name before starting the game.',
        nameTaken: 'That name is already taken on the leaderboard. Please choose another one.',
        leaderboardFor: 'Leaderboard for',
        settingPresence: 'Show my game on Discord',
        playerCardTitle: 'Player details',
        playerCardHint: 'Live progress in this room.',
        profileTitle: 'Player profile',
        profileHint: 'Best score and rank in each mode.',
        rankingsTitle: 'Rankings by mode',
        noRankings: 'No ranked scores yet.',
        statGames: 'Games',
        statBest: 'Best score',
        statAvg: 'Avg score',
        statMp: 'Multiplayer',
        statTotal: 'Total score',
        statBestRank: 'Best rank',
        statWinRate: 'Win rate',
        statHours: 'Hours played',
        statPerfect: 'Perfect rounds',
        levelShort: 'lvl',
        dayStreak: 'Day streak',
        achievementsTitle: 'Achievements',
        achievementUnlocked: 'Achievement unlocked!',
        dailyChallenge: 'Daily challenge',
        dailyNew: 'new',
        dailyPlayed: 'Daily · view board',
        scopeAllTime: 'all-time',
        scopeWeek: 'this week',
        weeklyChallenge: 'Weekly challenge',
        weeklyChallengeEmpty: 'No daily challenges played yet this week.',
        breakdownTitle: 'Accuracy by category',
        practiceMode: 'Practice',
        practiceRound: 'Practice round',
        practiceNotSaved: 'Practice — not saved to the leaderboard',
        onboardTitle: 'Open source — and built to be contributed to',
        onboardTip1: 'Guess the Language is open source. The whole thing — the question banks, the multiplayer rooms, the leaderboard — is on GitHub.',
        onboardTip2: 'It exists so junior developers have a real project to learn on: something that ships, has users, and breaks in interesting ways.',
        onboardTip3: 'Read it, run it, break it. Every screen, every bank and every rough edge is somewhere you can leave a fingerprint.',
        onboardTip4: 'Pull requests are genuinely welcome — start with a question you wish someone had asked you.',
        onboardGotIt: "Let's go",
        shareResult: 'Share result',
        copyImage: 'Copy image',
        download: 'Download',
        copied: '✓ Copied — paste it into chat',
        copyFailed: 'Copy blocked here — long-press / right-click the image to save it.',
        downloadStarted: '⬇ Saved to your downloads',
        downloadBlocked: 'Download blocked here — long-press / right-click the image to save it.',
        shareHint: 'Copy it, download it, or long-press the image to save.',
        shareOpenImage: 'Open image',
        supportDev: '☕ Support',
        supportPrompt: 'Enjoying the game?',
        supportDevLong: 'Support the developer ☕',
        shareToDiscord: 'Share to Discord',
        shareCopyLink: 'Copy link',
        shareLinkCopied2: '✓ Link copied',
        shareDiscordHint: 'Open the image to save it, or share it straight into Discord.',
        shareUploading: 'Preparing…',
        follow: 'follow +',
        following: 'Following',
        followingTitle: 'Following',
        makeHost: 'Make host',
        titleNovice: 'Novice',
        titleApprentice: 'Apprentice',
        titleCoder: 'Coder',
        titleHacker: 'Hacker',
        titleExpert: 'Expert',
        titleGuru: 'Guru',
        ach_rookie: 'First game',
        ach_dedicated: '25 games',
        ach_centurion: '100 games',
        ach_first_win: 'First win',
        ach_champion: '10 wins',
        ach_perfect: 'Perfect round',
        ach_flawless: '5 perfect rounds',
        ach_streak3: '3-day streak',
        ach_streak7: '7-day streak',
        ach_marathon: '1 hour played',
        ach_level5: 'Reach level 5',
        ach_level10: 'Reach level 10',
        lastPlayed: 'Last played',
        lastSeen: 'last seen',
        online: 'Online now',
        playerCardMode: 'Game mode',
        playerCardRound: 'Round',
        playerCardScore: 'Score',
        playerCardCorrect: 'Correct',
        playerCardStreak: 'Streak',
        playerCardStatus: 'Status',
        statusPlaying: '🎮 Playing',
        statusSpectating: '👁 Spectating',
        statusLobby: '⏳ In the lobby',
        statusFinished: '🏁 Finished',
        inviteToRoom: 'Invite',
        inviteFailed: 'Could not open the invite dialog',
        inviteShareCode: 'Room code copied — share it so friends can join.',
        openPlayerCard: 'View progress',
        joinRequestFailed: 'Could not join that room',
        presenceLobby: 'In the lobby',
        presenceResults: 'Viewing results',
        presenceMenu: 'In the menu',
        presenceSolo: 'Solo round',
        presenceRoom: 'Multiplayer room',
        presenceSpectating: 'Spectating',
        // ---- play styles ----
        styleClassic: 'classic',
        styleSurvival: 'survival',
        styleSpeedrun: 'speed run',
        styleHardcore: 'hardcore',
        styleHint_classic: 'A normal round: a timer on every question.',
        styleHint_survival: 'Three lives. It gets harder the longer you last.',
        styleHint_speedrun: 'One 60-second clock. Answer as many as you can.',
        styleHint_hardcore: 'Type the language yourself. No 50:50, less time.',
        hardcoreLangPrompt: 'Type the language name',
        hardcorePlaceholder: 'e.g. Python, C#, Bash…',
        fillFooterHint: 'type your answer · enter to submit',
        hudLives: 'LIVES',
        livesLeft: '{n} lives left',
        survivalResult: 'Survived {n} questions',
        speedrunResult: '{n} answered in 60 seconds',
        // ---- focus packs ----
        packFocus: 'focus',
        packAll: 'everything',
        packUnranked: 'unranked · study round',
        focusRound: 'Focus round',
        focusNotSaved: 'Focus round — XP only, not posted to the leaderboard',
        pack_web: 'Web (JS, TS, PHP)',
        pack_systems: 'Systems (C, C++, Rust, Go)',
        pack_jvm: 'JVM & mobile (Java, Kotlin, Swift, C#)',
        pack_scripting: 'Scripting & data (Python, Ruby, Bash, SQL)',
        pack_fill: 'Fill the blank',
        pack_bug: 'Fix the bug',
        pack_output: 'Predict the output',
        pack_python: 'Python only',
        pack_jsts: 'JavaScript & TypeScript',
        pack_offense: 'Offense & tools',
        pack_crypto: 'Crypto & auth',
        pack_defense: 'Malware & defense',
        pack_concepts: 'Concepts & principles',
        pack_docker: 'Docker & containers',
        pack_kubernetes: 'Kubernetes',
        pack_cicd: 'CI/CD & deployment',
        pack_iac: 'IaC & cloud',
        pack_ops: 'Observability & reliability',
        pack_fundamentals: 'TCP/IP fundamentals',
        pack_routing: 'Routing & switching',
        pack_services: 'DNS & services',
        pack_netsec: 'Security & diagnostics',
        pack_rendering: 'Rendering & animation',
        pack_physics: 'Physics & math',
        pack_gameplay: 'Gameplay & AI',
        pack_engine: 'Engine & performance',
        pack_netcode: 'Netcode',
        // ---- mistake review ----
        reviewMistakes: 'Review mistakes',
        reviewNextIn: 'in {n}d',
        reviewDueTitle: '{n} questions are due for review',
        reviewNoneDue: 'Nothing is due for review yet.',
        reviewRound: 'Review round',
        reviewSummary: '{ok} recalled · {bad} back in the queue',
        // ---- ranked duel ----
        duelButton: '⚔ Ranked duel',
        duelBoard: 'Ranked duel',
        duelSearching: 'Looking for an opponent…',
        duelSearchStatus: 'Searching for a player near your rating · {s}s',
        duelFoundHuman: 'Opponent found: {name}',
        duelBotFallback: 'Nobody else is searching right now — you will face a bot.',
        duelYourRating: 'Your rating: {r}',
        duelBotName: 'Bot ({r})',
        duelYou: 'you',
        duelWon: '🏆 You won the duel!',
        duelLost: 'You lost the duel.',
        duelDraw: 'A draw.',
        duelRatingChange: 'Rating {from} → {to} ({delta})',
        duelRatingOffline: 'Rating not saved — the server could not be reached.',
        duelVs: 'vs',
        duelNeedLogin: 'Sign in with Discord to play ranked duels.',
        duelRatingCol: 'rating',
        duelRecordCol: 'w-l',
        cancel: 'Cancel',
        // ---- question reports ----
        reportQuestion: '⚑ report question',
        qreportTitle: 'Report this question',
        qreportDesc: "What's wrong with it? Reports go to the admin for review.",
        qreportWrong: 'The marked answer is wrong',
        qreportUnclear: 'Unclear or ambiguous',
        qreportTypo: 'Typo or broken code',
        qreportDuplicate: 'Duplicate of another question',
        qreportOther: 'Something else',
        qreportThanks: 'Thanks — the question was sent for review.',
        qreportDuplicateSent: 'You already reported this question.',
        qreportFailed: 'The report could not be sent. Please try again.',
        qreportNeedLogin: 'Sign in with Discord to report questions.',
        viewQuestionPage: 'full explanation ↗',
        // ---- seasons ----
        scopeSeason: 'season',
        seasonLabel: 'Season {name}',
        seasonEndsIn: 'ends in {n} days',
        seasonEndsToday: 'ends today',
        seasonChamps: 'Last season ({name})',
        seasonChampTitle: 'Season champion',
        // ---- admin: questions & analytics ----
        adminQuestions: 'Questions',
        adminStats: 'Stats',
        adminQReportsEmpty: 'No open question reports.',
        adminReportsCount: '{n} reports',
        adminOpenQuestion: 'Open',
        adminHardest: 'Hardest questions (lowest correct rate, 20+ answers)',
        adminMostReported: 'Most reported questions',
        adminModePlays: 'Rounds per board (last 30 days)',
        adminActivePlayers: 'Active players',
        adminActive1: 'today',
        adminActive7: '7 days',
        adminActive30: '30 days',
        adminNewPlayers: 'New players (7 days)',
        adminReturning: 'Came back after their first day',
        adminTotalPlayers: 'All players',
        adminAnswers: 'Answers recorded',
        // ---- settings / misc ----
        settingLanguage: 'Language',
        otherGamesTitle: 'More games by the developer',
        updateReady: 'A new version is ready.',
        updateReload: 'refresh'
    }
};

// ---------- Game modes ----------
export const MODES = {
    languages: {
        key: 'languages',
        icon: '💻',
        title: {
            en: ['Guess the', 'Programming Language']
        },
        desc: {
            en: 'Identify the language from the snippet before time runs out'
        }
    },
    cybersecurity: {
        key: 'cybersecurity',
        icon: '🛡️',
        title: {
            en: ['Cyber', 'Security Quiz']
        },
        desc: {
            en: 'Identify tools, malware, Nmap, Metasploit & more'
        }
    },
    devops: {
        key: 'devops',
        icon: '♾️',
        title: {
            en: ['DevOps', 'Quiz']
        },
        desc: {
            en: 'Docker, Kubernetes, CI/CD, Git, Terraform & cloud'
        }
    },
    network: {
        key: 'network',
        icon: '🌐',
        title: {
            en: ['Networking', 'Quiz']
        },
        desc: {
            en: 'OSI, TCP/IP, DNS, routing, subnetting & protocols'
        }
    },
    gamedev: {
        key: 'gamedev',
        icon: '🎮',
        title: {
            en: ['Game', 'Dev Quiz']
        },
        desc: {
            en: 'Game loops, physics, rendering, assets and UI systems'
        }
    },
    algorithms: {
        key: 'algorithms',
        icon: '🧩',
        title: {
            en: ['Problem', 'Solving Quiz']
        },
        desc: {
            en: 'Fill the blank, fix the bug or predict the output'
        }
    },
    sql: { key: 'sql', icon: '🗄️', title: { en: ['SQL &', 'Databases Quiz'] }, desc: { en: 'Queries, joins, indexes, transactions & schema design' } },
    regex: { key: 'regex', icon: '🔣', title: { en: ['Regex', 'Quiz'] }, desc: { en: 'Patterns, groups, lookarounds & flags' } },
    git: { key: 'git', icon: '🌿', title: { en: ['Git', 'Quiz'] }, desc: { en: 'Branching, merging, rebasing, history & undo' } },
    linux: { key: 'linux', icon: '🐧', title: { en: ['Linux', 'CLI Quiz'] }, desc: { en: 'Files, permissions, pipes, processes & text tools' } },
    ai: { key: 'ai', icon: '🤖', title: { en: ['AI &', 'ML Quiz'] }, desc: { en: 'Models, training, evaluation, neural nets & LLMs' } },
    all: {
        key: 'all',
        icon: '🎲',
        title: {
            en: ['All', 'Mixed Quiz']
        },
        desc: {
            en: 'Everything mixed: every mode together'
        }
    }
};

// Every selectable mode except the 'all' mix, in display order. Boards, profile
// rankings and pickers read this rather than keeping their own lists.
export const PLAY_MODES = Object.keys(MODES).filter((k) => k !== 'all');

I18N.ar = AR;
export const UI_LANGS = ['en', 'ar'];
const LANG_KEY = 'gtl_ui_lang';

// The interface language. Defaults to Arabic for a browser set to Arabic,
// English otherwise; a choice made in Settings wins.
export function uiLang() {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (UI_LANGS.includes(saved)) return saved;
    } catch (_) { /* fall through */ }
    try {
        if (String(navigator.language || '').toLowerCase().startsWith('ar')) return 'ar';
    } catch (_) { /* fall through */ }
    return 'en';
}

export function setUiLang(lang) {
    const l = UI_LANGS.includes(lang) ? lang : 'en';
    try { localStorage.setItem(LANG_KEY, l); } catch (_) {}
    applyLanguage();
}

export function t(key) {
    const dict = I18N[uiLang()] || I18N.en;
    if (dict[key] != null) return dict[key];
    return I18N.en[key] != null ? I18N.en[key] : key;
}

export function diffLabel(d) {
    const dict = I18N[uiLang()] || I18N.en;
    return (dict.diff || {})[d] || (I18N.en.diff || {})[d] || d;
}

// A mode's two-line title, in the interface language.
export function modeTitle(mode) {
    const m = MODES[mode] || MODES.languages;
    const ar = uiLang() === 'ar' && MODES_AR[m.key];
    const title = ar ? ar.title : (m.title?.en || []);
    return Array.isArray(title) ? title.join(' ') : String(title || m.key || '');
}

export function challengeText(score) {
    if (uiLang() === 'ar') return `حققت ${score} نقطة في «Guess the Language»! هل تستطيع التغلب عليّ؟`;
    return `I scored ${score} points in "Guess the Language"! Can you beat me?`;
}

// Older builds persisted a UI language in `gtl_lang` from a time when Arabic
// was half-supported; that key is retired in favour of gtl_ui_lang.
function purgeLegacyLanguagePref() {
    try { localStorage.removeItem('gtl_lang'); } catch (_) {}
}

// Paints every [data-i18n] element in the interface language and flips the
// document direction. Code, options and the title bar stay LTR (they carry
// their own dir="ltr").
export function applyLanguage() {
    purgeLegacyLanguagePref();
    const lang = uiLang();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        const v = t(k);
        if (v !== k) el.textContent = v;
    });
    // Refresh the currently-shown difficulty badge if a question is loaded.
    const dEl = document.querySelector('#code-difficulty');
    if (dEl && dEl.dataset.diff) dEl.textContent = diffLabel(dEl.dataset.diff);
    renderHome();
    syncDiscordNameField();
}

purgeLegacyLanguagePref();
