import { renderHome } from './home.js';
import { syncDiscordNameField } from './identity.js';

// ============================================================
//  UI strings (English only)
// ============================================================
export const I18N = {
    en: {
        appTitle: 'Guess the Language',
        appSlug: 'guess-the-language',
        appTitleMono: 'guess_the_language',
        homeSub: 'Read the snippet. Beat the clock. Seven banks, one leaderboard.',
        langPrompt: 'Which language is this?',
        fillSubmit: 'Submit',
        fillPlaceholder: 'Type the missing code…',
        fillPrompt: 'Fill in the blank (____)',
        endQuiz: 'End',
        correctLabel: 'Correct:',
        aboutTitle: 'About',
        aboutDesc: 'An IT quiz game: programming languages, cybersecurity, DevOps & networking.',
        aboutQuestions: 'Questions:',
        close: 'Close',
        start: 'run ▸',
        friends: '🏆  Global Leaderboard',
        settings: '⚙  Settings',
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
        save: 'Save & Close',
        score: 'Score:',
        // Terminal/IDE HUD: the label sits above the value, uppercase and mono.
        hudScore: 'SCORE',
        hudCorrect: 'CORRECT',
        hudStreak: 'STREAK',
        answerWithKeys: 'press 1–6 to answer',
        signedInDiscord: 'signed in · discord',
        tbRound: 'round',
        tbResults: 'results',
        tbLobby: 'lobby · room',
        railRank: 'rank',
        railAccuracy: 'accuracy',
        railBest: 'best',
        hintTab: 'hint.md',
        snippetTab: 'snippet.??',
        hintCategory: 'category',
        hintDifficulty: 'difficulty',
        hintMasked: 'The answer is hidden below.',
        question: 'Question',
        finalScore: 'Final Score:',
        comparison: 'Global Leaderboard',
        globalLeaderboard: '🏆 Global Leaderboard',
        challenge: '🔗  Challenge a friend',
        replay: '🔄  Play again',
        backMenu: '🏠  Main menu',
        webAuthHint: 'Sign in with Discord to save your identity and play on the global leaderboard.',
        retry: 'Retry',
        nextQuestion: 'Next question',
        gameTitle: 'Quiz in progress',
        lobbyTitle: 'Multiplayer lobby',
        joinHint: 'Paste a 4-letter code or type it manually.',
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
        you: '(YOU)',
        lbLoading: 'Loading leaderboard…',
        bootLoading: 'Connecting…',
        settingUiScale: 'Interface size',
        lbOnline: '🌐 Global leaderboard',
        lbOffline: '⚠ Could not reach the leaderboard — showing local results.',
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
        modeAll: 'All (Mixed)',
        modeAllDesc: 'Everything: all six modes together',
        changeMode: 'Modes',
        diff: {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard'
        },
        hostRoom: '🏠  Host Room',
        joinRoom: '🔗  Join Room',
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
        adminButton: '🛡️  Admin',
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
        loginDiscord: '💬  Login with Discord',
        loginDiscordToPlay: 'Sign in with Discord to play',
        logoutDiscord: '🚪  Log out',
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
        copyCode: 'Copy',
        playersTitle: 'Players',
        waitingHost: 'Waiting for host…',
        startGame: '▶  Start Game',
        endRoom: 'End Room',
        endGame: 'End Game',
        leaveRoom: 'Leave',
        joinConfirm: 'Join',
        joining: 'Joining…',
        adminBadge: 'Host',
        kickPlayer: 'Remove',
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
        levelShort: 'Lvl',
        dayStreak: 'Day streak',
        achievementsTitle: 'Achievements',
        achievementUnlocked: 'Achievement unlocked!',
        dailyChallenge: 'Daily challenge',
        dailyNew: 'new',
        dailyPlayed: 'Daily · view board',
        scopeAllTime: 'All-time',
        scopeWeek: 'This week',
        breakdownTitle: 'Accuracy by category',
        practiceMode: '🎓  Practice',
        practiceRound: 'Practice round',
        practiceNotSaved: 'Practice — not saved to the leaderboard',
        onboardTitle: 'Open source — and built to be contributed to',
        onboardTip1: 'Guess the Language is open source. The whole thing — the question banks, the multiplayer rooms, the leaderboard — is on GitHub.',
        onboardTip2: 'It exists so junior developers have a real project to learn on: something that ships, has users, and breaks in interesting ways.',
        onboardTip3: 'Read it, run it, break it. Every screen, every bank and every rough edge is somewhere you can leave a fingerprint.',
        onboardTip4: 'Pull requests are genuinely welcome — start with a question you wish someone had asked you.',
        onboardGotIt: "Let's go",
        shareResult: '📸  Share result',
        copyImage: 'Copy image',
        download: 'Download',
        copied: '✓ Copied — paste it into chat',
        copyFailed: 'Copy blocked here — long-press / right-click the image to save it.',
        downloadStarted: '⬇ Saved to your downloads',
        downloadBlocked: 'Download blocked here — long-press / right-click the image to save it.',
        shareHint: 'Copy it, download it, or long-press the image to save.',
        shareOpenImage: '🖼️  Open image',
        shareToDiscord: '📤  Share to Discord',
        shareCopyLink: '🔗  Copy link',
        shareLinkCopied2: '✓ Link copied',
        shareDiscordHint: 'Open the image to save it, or share it straight into Discord.',
        shareUploading: 'Preparing…',
        follow: 'Follow',
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
        lastSeen: 'Last seen',
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
        inviteToRoom: '➕  Invite to this room',
        inviteFailed: 'Could not open the invite dialog',
        inviteShareCode: 'Room code copied — share it so friends can join.',
        openPlayerCard: 'View progress',
        joinRequestFailed: 'Could not join that room',
        presenceLobby: 'In the lobby',
        presenceResults: 'Viewing results',
        presenceMenu: 'In the menu',
        presenceSolo: 'Solo round',
        presenceRoom: 'Multiplayer room',
        presenceSpectating: 'Spectating'
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
    all: {
        key: 'all',
        icon: '🎲',
        title: {
            en: ['All', 'Mixed Quiz']
        },
        desc: {
            en: 'Everything mixed: all six modes together'
        }
    }
};

export function t(key) {
    return I18N.en[key] != null ? I18N.en[key] : key;
}

export function diffLabel(d) {
    return (I18N.en.diff || {})[d] || d;
}

export function challengeText(score) {
    return `I scored ${score} points in "Guess the Language"! Can you beat me?`;
}

// The app is English-only. Older builds persisted a UI language in `gtl_lang`
// and could leave the document in RTL; drop that key so a returning player who
// had picked Arabic still boots into the English LTR layout.
function purgeLegacyLanguagePref() {
    try { localStorage.removeItem('gtl_lang'); } catch (_) {}
}

// Paints every [data-i18n] element from the English dictionary. Still needed on
// boot (and whenever the home screen is re-rendered) even though there is no
// longer a language to choose.
export function applyLanguage() {
    purgeLegacyLanguagePref();
    const dict = I18N.en;
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (dict[k] != null) el.textContent = dict[k];
    });
    // Refresh the currently-shown difficulty badge if a question is loaded.
    const dEl = document.querySelector('#code-difficulty');
    if (dEl && dEl.dataset.diff) dEl.textContent = diffLabel(dEl.dataset.diff);
    renderHome();
    syncDiscordNameField();
}

purgeLegacyLanguagePref();
