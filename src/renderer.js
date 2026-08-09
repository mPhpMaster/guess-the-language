'use strict';

/* ============================================================
   Guess the Programming Language — renderer / game logic
   ============================================================ */

// ---------- The six fixed answer options (order matches mockup) ----------
const LANGUAGES = [{
        name: 'Python',
        glyph: '🐍',
        color: 'linear-gradient(135deg,#4f8fc0,#2b5b87)'
    },
    {
        name: 'JavaScript',
        glyph: 'JS',
        color: 'linear-gradient(135deg,#f7df1e,#e0c500)'
    },
    {
        name: 'TypeScript',
        glyph: 'TS',
        color: 'linear-gradient(135deg,#4b8bf5,#2f6fdc)'
    },
    {
        name: 'C++',
        glyph: 'C++',
        color: 'linear-gradient(135deg,#6aa9e0,#2b69b3)'
    },
    {
        name: 'C',
        glyph: 'C',
        color: 'linear-gradient(135deg,#8aa4bf,#4a6f8f)'
    },
    {
        name: 'C#',
        glyph: 'C#',
        color: 'linear-gradient(135deg,#b07adf,#68217a)'
    },
    {
        name: 'Java',
        glyph: '☕',
        color: 'linear-gradient(135deg,#f89820,#c8442b)'
    },
    {
        name: 'Kotlin',
        glyph: 'Kt',
        color: 'linear-gradient(135deg,#c08cf5,#7f52ff)'
    },
    {
        name: 'Swift',
        glyph: '🐦',
        color: 'linear-gradient(135deg,#ff8f5e,#f05138)'
    },
    {
        name: 'Rust',
        glyph: '🦀',
        color: 'linear-gradient(135deg,#e8b18a,#b7560f)'
    },
    {
        name: 'Go',
        glyph: '🐹',
        color: 'linear-gradient(135deg,#7fd5ea,#00add8)'
    },
    {
        name: 'Ruby',
        glyph: '💎',
        color: 'linear-gradient(135deg,#e06b6b,#cc342d)'
    },
    {
        name: 'PHP',
        glyph: '🐘',
        color: 'linear-gradient(135deg,#8a93c8,#4F5B93)'
    },
    {
        name: 'SQL',
        glyph: '🗄️',
        color: 'linear-gradient(135deg,#5fc9d0,#2f8f96)'
    },
    {
        name: 'Bash',
        glyph: '🐚',
        color: 'linear-gradient(135deg,#8fd48f,#4e9a4e)'
    }
];

// Badge colours for multiple-choice options (A/B/C/D), so the other quiz types
// get the same card-with-icon look as the programming-language buttons.
const OPTION_COLORS = [
    'linear-gradient(135deg,#5fd0ff,#2b7fd8)',
    'linear-gradient(135deg,#19f0c4,#12a988)',
    'linear-gradient(135deg,#ffd874,#e0a83c)',
    'linear-gradient(135deg,#ff7a9c,#d8436c)'
];

// ---------- Mock friends for the comparison screen ----------
const FRIENDS = [{
        name: 'Ahmed',
        avatar: '🧔🏽',
        score: 2450
    },
    {
        name: 'Sarah',
        avatar: '👩🏼',
        score: 2180
    },
    {
        name: 'Omar',
        avatar: '🧑🏻',
        score: 1920
    },
    {
        name: 'Layla',
        avatar: '👩🏻‍🦰',
        score: 1750
    }
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r = 52 -> ~326.7

// ============================================================
//  Internationalization (English / Arabic)
// ============================================================
const I18N = {
    en: {
        appTitle: 'Guess the Language',
        homeSub: 'Pick a mode and beat the timer',
        langPrompt: 'Which language is this?',
        fillSubmit: 'Submit',
        fillPlaceholder: 'Type the missing code…',
        fillPrompt: 'Fill in the blank (____)',
        endQuiz: 'End',
        correctLabel: 'Correct:',
        aboutTitle: 'About',
        aboutDesc: 'A bilingual (EN / AR) IT quiz game: programming languages, cybersecurity, DevOps & networking.',
        aboutQuestions: 'Questions:',
        close: 'Close',
        start: '▶  Start',
        friends: '🏆  Global Leaderboard',
        settings: '⚙  Settings',
        bestScore: 'Best score:',
        settingsTitle: 'Settings',
        settingsDescription: 'Adjust your quiz preferences.',
        settingLanguage: 'Language',
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
        modeAlgoDesc: 'Fill in the blank: algorithms, data structures & Big-O',
        modeAll: 'All (Mixed)',
        modeAllDesc: 'Everything: all six banks together',
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
        adminDone: '✓ Done',
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
        dailyChallenge: 'Daily Challenge',
        dailyPlayed: 'Daily · view board',
        scopeAllTime: 'All-time',
        scopeWeek: 'This week',
        breakdownTitle: 'Accuracy by category',
        practiceMode: '🎓  Practice',
        tryNewVersion: '✨  Try the new version',
        practiceRound: 'Practice round',
        practiceNotSaved: 'Practice — not saved to the leaderboard',
        onboardTitle: 'Welcome to Guess the Language!',
        onboardTip1: 'Pick a mode, then Start — read the code and beat the timer.',
        onboardTip2: 'Try the 🗓️ Daily Challenge: the same 10 questions for everyone.',
        onboardTip3: 'Earn XP, climb levels, and unlock achievements on your profile.',
        onboardTip4: 'On desktop, answer with keys 1–4. Stuck? Use a 50:50.',
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
    },
    ar: {
        appTitle: 'خمّن اللغة',
        homeSub: 'اختر نمطاً وتغلّب على المؤقّت',
        langPrompt: 'ما هذه اللغة؟',
        fillSubmit: 'إرسال',
        fillPlaceholder: 'اكتب الكود الناقص…',
        fillPrompt: 'املأ الفراغ (____)',
        endQuiz: 'إنهاء',
        correctLabel: 'الإجابات الصحيحة:',
        aboutTitle: 'حول التطبيق',
        aboutDesc: 'لعبة اختبارات تقنية بالعربية والإنجليزية: لغات البرمجة والأمن السيبراني وDevOps والشبكات.',
        aboutQuestions: 'عدد الأسئلة:',
        close: 'إغلاق',
        start: '▶  ابدأ اللعب',
        friends: '🏆  لوحة الصدارة العالمية',
        settings: '⚙  الإعدادات',
        bestScore: 'أفضل نتيجة:',
        settingsTitle: 'الإعدادات',
        settingsDescription: 'اضبط تفضيلات الاختبار.',
        settingLanguage: 'اللغة',
        settingName: 'اسمك في لوحة الصدارة',
        settingNameDiscord: 'اسمك (من Discord)',
        discordNameNote: 'يأتي اسمك العام وصورتك من Discord.',
        settingQuestions: 'عدد الأسئلة في الجولة',
        settingSound: 'المؤثرات الصوتية',
        settingAdaptive: 'صعوبة تكيّفية',
        settingDifficulty: 'الصعوبة',
        settingFeedbackDelay: 'مدة مراجعة الإجابة',
        feedback2: 'ثانيتان',
        feedback4: '4 ثوانٍ',
        feedback6: '6 ثوانٍ',
        feedbackManual: 'يدوي',
        diffAll: 'الكل',
        diffEasy: 'سهل',
        diffMedium: 'متوسط',
        diffHard: 'صعب',
        save: 'حفظ وإغلاق',
        score: 'النقاط:',
        question: 'سؤال',
        finalScore: 'النتيجة النهائية:',
        comparison: 'لوحة الصدارة العالمية',
        globalLeaderboard: '🏆 لوحة الصدارة العالمية',
        challenge: '🔗  تحدَّ صديقاً',
        replay: '🔄  إعادة اللعب',
        backMenu: '🏠  القائمة الرئيسية',
        webAuthHint: 'سجّل الدخول عبر Discord لحفظ هويتك واللعب في لوحة الصدارة العالمية.',
        retry: 'إعادة المحاولة',
        nextQuestion: 'السؤال التالي',
        gameTitle: 'الاختبار جارٍ',
        lobbyTitle: 'ردهة اللعب الجماعي',
        joinHint: 'الصق رمزاً من 4 أحرف أو اكتبه يدوياً.',
        endConfirmTitle: 'إنهاء هذا الاختبار؟',
        endConfirmDesc: 'سيظهر تقدمك الحالي في صفحة النتائج.',
        continueQuiz: 'متابعة اللعب',
        statAccuracy: 'الدقة',
        statStreak: 'أفضل سلسلة',
        statAverage: 'متوسط الاستجابة',
        statFastest: 'أسرع إجابة صحيحة',
        reviewAnswers: 'مراجعة الإجابات الخاطئة',
        noIncorrect: 'لا توجد إجابات خاطئة للمراجعة.',
        yourAnswer: 'إجابتك',
        correctAnswer: 'الإجابة الصحيحة',
        personalRank: 'ترتيبك العالمي',
        you: '(أنت)',
        lbLoading: 'جارٍ تحميل لوحة الصدارة…',
        bootLoading: 'جارٍ الاتصال…',
        settingUiScale: 'حجم الواجهة',
        lbOnline: '🌐 لوحة الصدارة العالمية',
        lbOffline: '⚠ تعذّر الاتصال بلوحة الصدارة — عرض نتائج محلية.',
        correct: 'صحيح!',
        streakBonus: '(×1.5 🔥)',
        wrong: 'خطأ — الإجابة الصحيحة:',
        timeUp: 'انتهى الوقت! الإجابة:',
        loadFail: '⚠ تعذّر تحميل الأسئلة',
        challengeCopied: '✅ تم نسخ التحدي!',
        loading: 'جارٍ التحميل…',
        modeSelectTitle: 'اختر نمط اللعب',
        modeLanguages: 'لغات البرمجة',
        modeLanguagesDesc: 'خمّن اللغة من مقتطف كود',
        modeCyber: 'الأمن السيبراني',
        modeCyberDesc: 'أدوات وبرمجيات خبيثة وNmap وMetasploit والمزيد',
        modeDevops: 'DevOps',
        modeDevopsDesc: 'Docker وKubernetes وCI/CD وGit والسحابة',
        modeNetwork: 'الشبكات',
        modeNetworkDesc: 'OSI وTCP/IP وDNS والتوجيه والبروتوكولات',
        modeGamedev: 'تطوير الألعاب',
        modeGamedevDesc: 'حلقات الألعاب والفيزياء والرسوم والمحتوى والواجهات',
        modeAlgo: 'حل المشكلات',
        modeAlgoDesc: 'املأ الفراغ: الخوارزميات وهياكل البيانات وتعقيد الوقت',
        modeAll: 'الكل (مدمج)',
        modeAllDesc: 'كل شيء: البنوك الستة معاً',
        changeMode: 'الأنماط',
        diff: {
            easy: 'سهل',
            medium: 'متوسط',
            hard: 'صعب'
        },
        hostRoom: '🏠  إنشاء غرفة',
        joinRoom: '🔗  الانضمام لغرفة',
        discordVoiceRoom: 'قناة الصوت',
        discordVoiceRoomHint: 'الجميع في هذه المكالمة',
        discordAutoMp: 'اللعب الجماعي تلقائي هنا — الجميع في قناة الصوت يشاركون نفس الغرفة.',
        discordJoining: 'جارٍ الانضمام لغرفة قناة الصوت…',
        discordMpUnavailable: 'تعذّر الاتصال باللعب الجماعي — يمكنك اللعب منفرداً بالأسفل.',
        createRoom: '🏠  إنشاء غرفة',
        backToLobby: '🔙  العودة إلى اللوبي',
        discordCreateHint: 'ادخل إلى لوبي الغرفة المشتركة لقناتك الصوتية.',
        returnLobbyFailed: 'تعذّر الوصول إلى الغرفة — حاول مرة أخرى.',
        challengeSent: '✅ تم إرسال التحدي!',
        challengeFailed: 'تعذّر فتح نافذة المشاركة.',
        challengeWon: '🎉 مبروك! كسرت التحدّي',
        challengeLost: '💪 لم تكسر التحدّي',
        challengeWonSub: 'حصلت على {you} نقطة والهدف كان {target}. تحدَّ صديقك بالمقابل!',
        challengeLostSub: 'حصلت على {you} نقطة والهدف كان {target}. اقتربت — حاول مجدداً!',
        challengeBack: '🔗  تحدَّ صديقك بالمقابل',
        challengeDismiss: 'إغلاق',
        adminButton: '🛡️  لوحة التحكم',
        adminTitle: '🛡️ لوحة التحكم',
        adminReports: 'البلاغات',
        adminUsers: 'المستخدمون',
        adminLive: 'المتصلون الآن',
        adminBans: 'المحظورون',
        adminEmpty: 'لا يوجد شيء.',
        adminLoading: 'جارٍ التحميل…',
        adminError: 'فشل الطلب.',
        adminDeleteScore: 'حذف النتيجة',
        adminBan: 'حظر',
        adminUnban: 'رفع الحظر',
        adminResolve: 'إغلاق البلاغ',
        adminDismiss: 'تجاهل',
        adminReset: 'تصفير البروفايل',
        adminConfirm: 'تأكيد؟',
        adminSearch: 'ابحث عن لاعب…',
        adminReporter: 'المُبلِّغ',
        adminBannedBy: 'بواسطة',
        adminActivityHome: 'في الرئيسية',
        adminActivityLobby: 'في اللوبي',
        adminActivityPlaying: 'يلعب',
        adminServer: 'السيرفر',
        adminNoServer: 'بلا سيرفر (ويب)',
        adminDone: '✓ تم',
        loginDiscord: '💬  تسجيل الدخول عبر Discord',
        loginDiscordToPlay: 'سجّل الدخول عبر Discord للّعب',
        logoutDiscord: '🚪  تسجيل الخروج',
        discordLinkedAs: 'مسجّل الدخول باسم',
        discordLoginFailed: 'فشل تسجيل الدخول عبر Discord. حاول مرة أخرى.',
        unsafeName: 'هذا الاسم غير مسموح. اختر اسماً مختلفاً.',
        hiddenPlayer: 'لاعب مخفي',
        report: 'إبلاغ',
        reportTitle: 'الإبلاغ عن نتيجة',
        reportDesc: 'أخبرنا بسبب ضرورة مراجعة هذه النتيجة.',
        reportReason: 'السبب',
        reportOffensive: 'اسم مسيء',
        reportImpersonation: 'انتحال شخصية',
        reportSpam: 'إزعاج أو سبب آخر',
        reportDetails: 'التفاصيل (اختياري)',
        reportSubmit: 'إرسال البلاغ',
        reportSuccess: 'شكراً. تم إرسال النتيجة للمراجعة.',
        reportDuplicate: 'لقد أبلغت عن هذه النتيجة مسبقاً.',
        reportFailed: 'تعذّر إرسال البلاغ. حاول مرة أخرى.',
        roomCode: 'رمز الغرفة',
        copyCode: 'نسخ',
        playersTitle: 'اللاعبون',
        waitingHost: 'بانتظار المضيف…',
        startGame: '▶  بدء اللعب',
        endRoom: 'إنهاء الغرفة',
        endGame: 'إنهاء اللعبة',
        leaveRoom: 'مغادرة',
        joinConfirm: 'انضم',
        joining: 'جارٍ الانضمام…',
        adminBadge: 'مضيف',
        kickPlayer: 'إزالة',
        roomResults: 'نتائج الغرفة',
        mpNeedOnline: 'اللعب الجماعي يتطلب اتصالاً بالإنترنت — راجع README',
        mpJoinFail: 'تعذّر الانضمام للغرفة',
        mpHostFail: 'تعذّر إنشاء الغرفة',
        codeCopied: '✅ تم نسخ الرمز!',
        challengeLinkCopied: '🔗 تم نسخ الرابط!',
        spectating: '👁  وضع المشاهدة — اللعبة جارية',
        mpKicked: 'تمت إزالتك من الغرفة',
        waitingOpponents: '⏳ بانتظار الخصوم…',
        lobbySettings: 'إعدادات اللعبة',
        settingTimer: 'مدة كل سؤال',
        timerAuto: 'تلقائي (حسب الصعوبة)',
        multiplayerScore: 'نتيجة جماعية',
        nameRequired: 'يرجى إدخال اسمك قبل بدء اللعبة.',
        nameTaken: 'هذا الاسم مستخدم بالفعل في لوحة الصدارة. يرجى اختيار اسم آخر.',
        leaderboardFor: 'لوحة الصدارة لـ',
        settingPresence: 'إظهار لعبتي على ديسكورد',
        playerCardTitle: 'تفاصيل اللاعب',
        playerCardHint: 'تقدّمه المباشر في هذه الغرفة.',
        profileTitle: 'ملف اللاعب',
        profileHint: 'أفضل نتيجة وترتيبه في كل قسم.',
        rankingsTitle: 'الترتيب حسب القسم',
        noRankings: 'لا توجد نتائج مصنّفة بعد.',
        statGames: 'الجولات',
        statBest: 'أفضل نتيجة',
        statAvg: 'متوسط النتيجة',
        statMp: 'اللعب الجماعي',
        statTotal: 'مجموع النقاط',
        statBestRank: 'أفضل ترتيب',
        statWinRate: 'معدل الفوز',
        statHours: 'ساعات اللعب',
        statPerfect: 'جولات كاملة',
        levelShort: 'مستوى',
        dayStreak: 'سلسلة الأيام',
        achievementsTitle: 'الإنجازات',
        achievementUnlocked: 'إنجاز جديد!',
        dailyChallenge: 'التحدّي اليومي',
        dailyPlayed: 'اليومي · اعرض اللوحة',
        scopeAllTime: 'كل الأوقات',
        scopeWeek: 'هذا الأسبوع',
        breakdownTitle: 'الدقّة حسب الفئة',
        practiceMode: '🎓  تدريب',
        tryNewVersion: '✨  جرّب النسخة الجديدة',
        practiceRound: 'جولة تدريب',
        practiceNotSaved: 'تدريب — غير محفوظة في لوحة الصدارة',
        onboardTitle: 'أهلًا بك في «خمّن اللغة»!',
        onboardTip1: 'اختر نوعًا ثم ابدأ — اقرأ الكود واسبق المؤقّت.',
        onboardTip2: 'جرّب 🗓️ التحدّي اليومي: نفس الـ١٠ أسئلة للجميع.',
        onboardTip3: 'اكسب XP، وارتقِ بالمستويات، وافتح الإنجازات في بروفايلك.',
        onboardTip4: 'على الكمبيوتر أجب بالأرقام ١–٤. محتار؟ استخدم 50:50.',
        onboardGotIt: 'يلا نبدأ',
        shareResult: '📸  شارك النتيجة',
        copyImage: 'نسخ الصورة',
        download: 'تنزيل',
        copied: '✓ نُسخت — الصقها في المحادثة',
        copyFailed: 'النسخ محجوب هنا — اضغط مطوّلًا/بزر يمين على الصورة لحفظها.',
        downloadStarted: '⬇ تم الحفظ في التنزيلات',
        downloadBlocked: 'التنزيل محجوب هنا — اضغط مطوّلًا/بزر يمين على الصورة لحفظها.',
        shareHint: 'انسخها أو نزّلها، أو اضغط مطوّلًا على الصورة لحفظها.',
        shareOpenImage: '🖼️  فتح الصورة',
        shareToDiscord: '📤  مشاركة في ديسكورد',
        shareCopyLink: '🔗  نسخ الرابط',
        shareLinkCopied2: '✓ تم نسخ الرابط',
        shareDiscordHint: 'افتح الصورة لحفظها، أو شاركها مباشرة في ديسكورد.',
        shareUploading: 'جارٍ التجهيز…',
        follow: 'متابعة',
        following: 'متابَع',
        followingTitle: 'المتابَعون',
        makeHost: 'اجعله المضيف',
        titleNovice: 'مبتدئ',
        titleApprentice: 'متدرّب',
        titleCoder: 'مبرمج',
        titleHacker: 'هاكر',
        titleExpert: 'خبير',
        titleGuru: 'أسطورة',
        ach_rookie: 'أول جولة',
        ach_dedicated: '٢٥ جولة',
        ach_centurion: '١٠٠ جولة',
        ach_first_win: 'أول فوز',
        ach_champion: '١٠ انتصارات',
        ach_perfect: 'جولة كاملة',
        ach_flawless: '٥ جولات كاملة',
        ach_streak3: 'سلسلة ٣ أيام',
        ach_streak7: 'سلسلة ٧ أيام',
        ach_marathon: 'ساعة لعب',
        ach_level5: 'الوصول للمستوى ٥',
        ach_level10: 'الوصول للمستوى ١٠',
        lastPlayed: 'آخر لعب',
        lastSeen: 'آخر ظهور',
        online: 'متصل الآن',
        playerCardMode: 'نوع اللعبة',
        playerCardRound: 'الجولة',
        playerCardScore: 'النتيجة',
        playerCardCorrect: 'الإجابات الصحيحة',
        playerCardStreak: 'التتابع',
        playerCardStatus: 'الحالة',
        statusPlaying: '🎮 يلعب',
        statusSpectating: '👁 يشاهد',
        statusLobby: '⏳ في غرفة الانتظار',
        statusFinished: '🏁 انتهى',
        inviteToRoom: '➕  دعوة إلى هذه الغرفة',
        inviteFailed: 'تعذّر فتح نافذة الدعوة',
        inviteShareCode: 'تم نسخ رمز الغرفة — شاركه عشان أصحابك يدخلون.',
        openPlayerCard: 'عرض التقدّم',
        joinRequestFailed: 'تعذّر الانضمام إلى تلك الغرفة',
        presenceLobby: 'في غرفة الانتظار',
        presenceResults: 'يستعرض النتائج',
        presenceMenu: 'في القائمة',
        presenceSolo: 'جولة فردية',
        presenceRoom: 'غرفة جماعية',
        presenceSpectating: 'وضع المشاهدة'
    }
};

// ---------- Game modes ----------
const MODES = {
    languages: {
        key: 'languages',
        icon: '💻',
        title: {
            en: ['Guess the', 'Programming Language'],
            ar: ['خمِّن', 'لغة البرمجة']
        },
        desc: {
            en: 'Identify the language from the snippet before time runs out',
            ar: 'خمّن لغة البرمجة من مقتطف الكود قبل انتهاء الوقت'
        }
    },
    cybersecurity: {
        key: 'cybersecurity',
        icon: '🛡️',
        title: {
            en: ['Cyber', 'Security Quiz'],
            ar: ['اختبار', 'الأمن السيبراني']
        },
        desc: {
            en: 'Identify tools, malware, Nmap, Metasploit & more',
            ar: 'تعرّف على الأدوات والبرمجيات الخبيثة وNmap وMetasploit والمزيد'
        }
    },
    devops: {
        key: 'devops',
        icon: '♾️',
        title: {
            en: ['DevOps', 'Quiz'],
            ar: ['اختبار', 'DevOps']
        },
        desc: {
            en: 'Docker, Kubernetes, CI/CD, Git, Terraform & cloud',
            ar: 'Docker وKubernetes وCI/CD وGit وTerraform والسحابة'
        }
    },
    network: {
        key: 'network',
        icon: '🌐',
        title: {
            en: ['Networking', 'Quiz'],
            ar: ['اختبار', 'الشبكات']
        },
        desc: {
            en: 'OSI, TCP/IP, DNS, routing, subnetting & protocols',
            ar: 'OSI وTCP/IP وDNS والتوجيه والتقسيم والبروتوكولات'
        }
    },
    gamedev: {
        key: 'gamedev',
        icon: '🎮',
        title: {
            en: ['Game', 'Dev Quiz'],
            ar: ['اختبار', 'تطوير الألعاب']
        },
        desc: {
            en: 'Game loops, physics, rendering, assets and UI systems',
            ar: 'حلقات الألعاب والفيزياء والرسوم والمحتوى والواجهات'
        }
    },
    algorithms: {
        key: 'algorithms',
        icon: '🧩',
        title: {
            en: ['Problem', 'Solving Quiz'],
            ar: ['اختبار', 'حل المشكلات']
        },
        desc: {
            en: 'Fill in the blank: algorithms, data structures & Big-O',
            ar: 'املأ الفراغ: الخوارزميات وهياكل البيانات وتعقيد الوقت'
        }
    },
    all: {
        key: 'all',
        icon: '🎲',
        title: {
            en: ['All', 'Mixed Quiz'],
            ar: ['الكل', 'اختبار شامل']
        },
        desc: {
            en: 'Everything mixed: all six banks together',
            ar: 'كل شيء مدمج: البنوك الستة معاً'
        }
    }
};

function getLang() {
    const l = localStorage.getItem('gtl_lang');
    return l === 'ar' || l === 'en' ? l : 'en';
}

function setLang(lang) {
    localStorage.setItem('gtl_lang', lang === 'ar' ? 'ar' : 'en');
    applyLanguage();
}

function t(key) {
    const d = I18N[getLang()];
    if (d && d[key] != null) return d[key];
    return I18N.en[key] != null ? I18N.en[key] : key;
}

function diffLabel(d) {
    return (I18N[getLang()].diff || {})[d] || d;
}

function challengeText(score) {
    return getLang() === 'ar' ?
        `حصلت على ${score} نقطة في لعبة "خمّن اللغة"! هل تستطيع التغلب عليّ؟` :
        `I scored ${score} points in "Guess the Language"! Can you beat me?`;
}

function applyLanguage() {
    const lang = getLang();
    const dict = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (dict[k] != null) el.textContent = dict[k];
    });
    document.querySelectorAll('.lang-switch button').forEach((b) => {
        b.classList.toggle('active', b.dataset.setlang === lang);
    });
    const sel = document.querySelector('#set-language');
    if (sel) sel.value = lang;
    // Refresh the currently-shown difficulty badge if a question is loaded.
    const dEl = document.querySelector('#code-difficulty');
    if (dEl && dEl.dataset.diff) dEl.textContent = diffLabel(dEl.dataset.diff);
    renderHome();
    syncDiscordNameField();
}

// Highlight the active mode card and show its best score on the home page.
function renderHome() {
    document.querySelectorAll('#mode-grid .mode-card').forEach((c) => {
        const selected = c.dataset.mode === state.mode;
        c.classList.toggle('selected', selected);
        c.setAttribute('aria-pressed', String(selected));
    });
    refreshMenu();
    refreshMultiplayerButtons();
    updateDailyButton();
}

// Reflect whether today's daily challenge has already been played.
function updateDailyButton() {
    const btn = $('#btn-daily');
    if (!btn) return;
    const done = isDailyDone();
    btn.classList.toggle('is-done', done);
    btn.textContent = done ? `🗓️  ${t('dailyPlayed')}` : `🗓️  ${t('dailyChallenge')}`;
}

// ---------- First-run onboarding ----------
function maybeShowOnboarding() {
    try { if (localStorage.getItem('gtl_onboarded') === '1') return; } catch (_) { return; }
    if (!screens.home.classList.contains('active')) return; // don't cover a lobby / Discord auto-join
    showOnboarding();
}
function showOnboarding() {
    let el = document.getElementById('onboarding');
    if (!el) {
        el = document.createElement('div');
        el.id = 'onboarding';
        el.className = 'onboarding-overlay';
        el.innerHTML = '<div class="onboarding-card" role="dialog" aria-modal="true">' +
            '<div class="onboarding-emoji" aria-hidden="true">🎮</div>' +
            '<h3 class="onboarding-title"></h3><ul class="onboarding-tips"></ul>' +
            '<button type="button" class="btn btn-primary onboarding-ok"></button></div>';
        document.body.appendChild(el);
        el.querySelector('.onboarding-ok').addEventListener('click', dismissOnboarding);
        el.addEventListener('click', (e) => { if (e.target === el) dismissOnboarding(); });
    }
    el.querySelector('.onboarding-title').textContent = t('onboardTitle');
    const ul = el.querySelector('.onboarding-tips');
    ul.innerHTML = '';
    ['onboardTip1', 'onboardTip2', 'onboardTip3', 'onboardTip4'].forEach((k) => {
        const li = document.createElement('li');
        li.textContent = t(k);
        ul.appendChild(li);
    });
    el.querySelector('.onboarding-ok').textContent = t('onboardGotIt');
    el.classList.add('show');
}
function dismissOnboarding() {
    try { localStorage.setItem('gtl_onboarded', '1'); } catch (_) {}
    document.getElementById('onboarding')?.classList.remove('show');
}

// ---------- Persistent settings / high score ----------
const store = {
    highScore(mode) {
        const v = Number(localStorage.getItem(`gtl_highscore_${mode}`) || 0);
        // Heal any non-finite value written by the old practice ∞-timer bug.
        if (!Number.isFinite(v)) { try { localStorage.removeItem(`gtl_highscore_${mode}`); } catch (e) {} return 0; }
        return v;
    },
    setHighScore(mode, v) {
        if (!Number.isFinite(Number(v))) return; // never store Infinity/NaN
        localStorage.setItem(`gtl_highscore_${mode}`, String(v));
    },
    get settings() {
        try {
            return JSON.parse(localStorage.getItem('gtl_settings')) || {};
        } catch {
            return {};
        }
    },
    set settings(v) {
        localStorage.setItem('gtl_settings', JSON.stringify(v));
    }
};

const defaultSettings = {
    questions: 10,
    sound: true,
    difficulty: 'all',
    timer: 'auto',
    feedbackDelay: 4,
    name: '',
    adaptive: false, // adjust question difficulty to the player's performance
    // Publish mode / round / score to this player's Discord profile card.
    discordPresence: true
};

// ---------- Game state ----------
const state = {
    mode: 'all',
    allQuestions: [],
    round: [],
    index: 0,
    score: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    roundHistory: [],
    questionStartedAt: 0,
    timeLeft: 0,
    questionTime: 15,
    timerId: null,
    advanceTimer: null,
    lastTickSecond: -1,
    answered: false,
    current: null,
    multiplayer: false,
    mpAnsweredIndex: -1,
    mpSyncKey: '',
    mpRound: null,
    mpChosen: null,
    mpResultsShown: false,
    spectator: false
};

// ---------- DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const screens = {
    home: $('#screen-home'),
    lobby: $('#screen-lobby'),
    game: $('#screen-game'),
    results: $('#screen-results')
};

function showScreen(name) {
    state.currentScreen = name;
    Object.entries(screens).forEach(([key, screen]) => {
        const active = key === name;
        screen.classList.toggle('active', active);
        screen.hidden = !active;
        screen.inert = !active;
        screen.setAttribute('aria-hidden', String(!active));
    });
    const heading = screens[name].querySelector('.screen-heading, h1, h2');
    if (heading) requestAnimationFrame(() => heading.focus({ preventScroll: true }));
    // Every screen change is a presence change (menu / lobby / round / results).
    pushPresence();
}

function announce(message) {
    const live = $('#app-live-region');
    if (!live || !message) return;
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
}

const dialogReturnFocus = new WeakMap();
function openDialog(dialog, initialFocus) {
    if (!dialog || dialog.open) return;
    dialogReturnFocus.set(dialog, document.activeElement);
    dialog.showModal();
    requestAnimationFrame(() => {
        const target = initialFocus || dialog.querySelector('[autofocus], input, select, button');
        target?.focus();
    });
}

function closeDialog(dialog, returnFocus = true) {
    if (!dialog?.open) return;
    dialog.close();
    if (returnFocus) dialogReturnFocus.get(dialog)?.focus?.();
}

// ============================================================
//  Lightweight, language-agnostic syntax highlighter
// ============================================================
const KEYWORDS = new Set([
    'def', 'class', 'return', 'import', 'from', 'as', 'with', 'async', 'await', 'lambda', 'for', 'in', 'if', 'elif',
    'else', 'while', 'print', 'None', 'True', 'False', 'not', 'and', 'or', 'is', 'pass', 'yield', 'try', 'except', 'finally',
    'const', 'let', 'var', 'function', '=>', 'new', 'export', 'default', 'document', 'console', 'typeof', 'this', 'null',
    'undefined', 'void', 'public', 'private', 'protected', 'static', 'final', 'class', 'interface', 'extends', 'implements',
    'package', 'main', 'func', 'go', 'defer', 'chan', 'map', 'struct', 'type', 'range', 'fn', 'let', 'mut', 'match', 'impl',
    'trait', 'use', 'pub', 'enum', 'where', 'include', 'template', 'typename', 'namespace', 'using', 'virtual', 'auto',
    'int', 'float', 'double', 'char', 'bool', 'string', 'String', 'vector', 'make_unique', 'throws', 'override', 'super'
]);

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(code) {
    // Token regex: comments, strings, numbers, identifiers, operators/punct.
    const tokenRe = /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*!?)|([{}()\[\];:,.<>+\-*/=&|?@%]+)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = tokenRe.exec(code)) !== null) {
        out += escapeHtml(code.slice(last, m.index));
        last = tokenRe.lastIndex;
        if (m[1]) {
            out += `<span class="tok-comment">${escapeHtml(m[1])}</span>`;
        } else if (m[2]) {
            out += `<span class="tok-string">${escapeHtml(m[2])}</span>`;
        } else if (m[3]) {
            out += `<span class="tok-number">${escapeHtml(m[3])}</span>`;
        } else if (m[4]) {
            const word = m[4];
            const after = code.slice(tokenRe.lastIndex, tokenRe.lastIndex + 1);
            if (KEYWORDS.has(word)) out += `<span class="tok-keyword">${escapeHtml(word)}</span>`;
            else if (after === '(') out += `<span class="tok-func">${escapeHtml(word)}</span>`;
            else out += escapeHtml(word);
        } else if (m[5]) {
            out += `<span class="tok-punct">${escapeHtml(m[5])}</span>`;
        }
    }
    out += escapeHtml(code.slice(last));
    return out;
}

// ============================================================
//  Simple WebAudio sound effects (no asset files needed)
// ============================================================
let audioCtx = null;
let masterGain = null;

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5; // keep everything gentle overall
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// A soft sine note with a smooth attack/release envelope (no harsh edges).
function note(freq, when = 0, dur = 0.18, peak = 0.11) {
    if (!getSettings().sound) return;
    try {
        const ctx = ensureAudio();
        const t0 = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.025); // gentle fade-in
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // smooth fade-out
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.04);
    } catch (_) {
        /* audio not available — ignore */ }
}

// Light haptic buzz on mobile, gated by the same "sound effects" preference so a
// single toggle silences both. No-op where the Vibration API is unavailable.
function haptic(pattern) {
    try {
        if (getSettings().sound && navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) { /* ignore */ }
}

const sfx = {
    correct() {
        note(659, 0, 0.16, 0.12);
        note(988, 0.10, 0.24, 0.10);
        haptic(20);
    }, // soft rising chime
    wrong() {
        note(311, 0, 0.20, 0.10);
        note(233, 0.11, 0.30, 0.08);
        haptic([30, 40, 30]);
    }, // soft descending
    // Countdown beep for the final seconds — pitch rises as time runs out.
    tick(secondsLeft) {
        const f = secondsLeft <= 1 ? 880 : secondsLeft === 2 ? 740 : 620;
        note(f, 0, 0.09, 0.11);
    },
    finish() {
        [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.13, 0.30, 0.09));
    } // gentle arpeggio
};

// ============================================================
//  Settings
// ============================================================
function getSettings() {
    return Object.assign({}, defaultSettings, store.settings);
}

// Normalise a display name: collapse runs of whitespace to one space, trim, and
// cap at 24 code points — so names padded with spaces (or ending in an emoji)
// aren't chopped mid-character and still fit the leaderboard's 24-char limit.
function sanitizeName(raw) {
    const collapsed = String(raw || '').replace(/\s+/g, ' ').trim();
    return Array.from(collapsed).slice(0, 24).join('');
}

const BLOCKED_NAME_PATTERNS = [
    /fuck|fuk|shit|bitch|cunt|nigg|whore|porn|sex/,
    /نيك|كس|قحبة|شرموط|زب/
];

const NAME_CONFUSABLES = {
    '0': 'o', '4': 'a', '3': 'e', '@': 'a',
    'ᶠ': 'f', 'ᶸ': 'u', 'ᶜ': 'c', 'ᵏ': 'k', 'ᵧ': 'y', 'ₒ': 'o', 'ᵤ': 'u',
    'ˢ': 's', 'ʰ': 'h', 'ⁱ': 'i', 'ᵗ': 't', 'ᵇ': 'b', 'ⁿ': 'n', 'ᵍ': 'g',
    'ʷ': 'w', 'ʳ': 'r', 'ᵖ': 'p', 'ᵉ': 'e', 'ˣ': 'x', 'ᴜ': 'u', 'γ': 'y'
};

function normalizedNameForSafety(raw) {
    return sanitizeName(raw).normalize('NFKD').toLowerCase()
        .replace(/[043@ᶠᶸᶜᵏᵧₒᵤˢʰⁱᵗᵇⁿᵍʷʳᵖᵉˣᴜγ]/g, (c) => NAME_CONFUSABLES[c] || c)
        .replace(/[\u200B-\u200D\uFEFF\s_.\-]+/g, '')
        .replace(/[^a-z0-9\u0600-\u06ff]/g, '');
}

function isSafePlayerName(raw) {
    const normalized = normalizedNameForSafety(raw);
    return !!normalized && !BLOCKED_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

function safeDisplayName(raw) {
    const name = sanitizeName(raw);
    return isSafePlayerName(name) ? name : t('hiddenPlayer');
}

function isDiscordActivity() {
    return Boolean(window.DISCORD_ACTIVITY?.active);
}

function getDiscordDisplayName() {
    const user = window.DISCORD_ACTIVITY?.user;
    if (!user) return null;
    const name = user.global_name || user.username;
    return name ? sanitizeName(name) : null;
}

function syncDiscordNameField() {
    const nameInput = $('#set-name');
    const nameLabel = $('#set-name-label');
    if (!nameInput || !nameLabel) return;

    // Lock the name field whenever the player is signed in through Discord —
    // either an Activity (SDK) or a web "Login with Discord".
    const profile = getDiscordProfile();
    if (profile) {
        if (profile.name) nameInput.value = profile.name;
        nameInput.disabled = true;
        nameInput.classList.add('discord-locked');
        nameLabel.textContent = t('settingNameDiscord');
    } else {
        nameInput.disabled = false;
        nameInput.classList.remove('discord-locked');
        nameLabel.setAttribute('data-i18n', 'settingName');
        nameLabel.textContent = t('settingName');
    }
}

function getLinkedDiscordUser() {
    try {
        return JSON.parse(localStorage.getItem('gtl_discord_user')) || null;
    } catch {
        return null;
    }
}

function isDiscordLinked() {
    return isDiscordActivity() || !!getLinkedDiscordUser();
}

// Running inside a Discord Activity iframe, whether or not the SDK handshake
// succeeded. Checked from the URL directly (not just the flag set by
// discord-activity.js) so it holds no matter which script ran first.
function isDiscordEmbedded() {
    if (window.DISCORD_ACTIVITY?.embedded) return true;
    if (document.documentElement.classList.contains('platform-discord')) return true;
    try {
        if (location.pathname.startsWith('/.proxy')) return true;
        const params = new URLSearchParams(location.search);
        return params.has('frame_id') || params.has('instance_id');
    } catch {
        return false;
    }
}

// On the plain web build a Discord sign-in is required before playing (inside an
// Activity you're already signed in; Electron can't do the OAuth redirect).
// Never gate inside a Discord iframe: the sign-in is a top-level OAuth redirect,
// which Discord's sandbox blocks — gating there would leave the player stuck on
// a "Sign in to play" button that can never succeed.
function requiresDiscordLogin() {
    return document.documentElement.classList.contains('platform-web')
        && !isDiscordActivity()
        && !isDiscordEmbedded();
}

// Can the player start a game right now?
function canPlay() {
    if (requiresDiscordLogin()) return isDiscordLinked();
    return isDiscordActivity() || !!getPlayerNameInputValue();
}

// A unified Discord profile { id, name, avatar } from either the Activity SDK
// or a web "Login with Discord".
function getDiscordProfile() {
    if (isDiscordActivity()) {
        const u = window.DISCORD_ACTIVITY.user;
        if (u) return { id: u.id, name: sanitizeName(u.global_name || u.username || ''), avatar: u.avatar || null };
    }
    return getLinkedDiscordUser();
}

function getAppSessionToken() {
    return isDiscordActivity()
        ? (window.DISCORD_ACTIVITY?.sessionToken || null)
        : (getLinkedDiscordUser()?.sessionToken || null);
}

function appApiPrefix() {
    if (location.pathname.startsWith('/.proxy') || new URLSearchParams(location.search).has('frame_id')) return '/.proxy';
    return '';
}

function discordAvatarUrl(user, size = 64) {
    if (user && user.id && user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}`;
    }
    return null;
}

// Load an image for canvas compositing (share card). crossOrigin lets us read the
// pixels back without tainting the canvas; resolves null on any failure.
function loadCrossOriginImage(src) {
    return new Promise((resolve) => {
        if (!src) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Show the signed-in Discord user's avatar + name on the home screen, or a
// "Sign in with Discord to play" call-to-action when sign-in is required.
function updateHomeProfile() {
    const el = $('#home-profile');
    const profile = getDiscordProfile();
    if (el) {
        if (profile && profile.name) {
            const img = $('#home-profile-avatar');
            const url = discordAvatarUrl(profile);
            if (img) {
                if (url) {
                    img.src = url;
                    img.classList.remove('hidden');
                } else {
                    img.classList.add('hidden');
                }
            }
            const nameEl = $('#home-profile-name');
            if (nameEl) nameEl.textContent = safeDisplayName(profile.name);
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
    const signedOutWeb = requiresDiscordLogin() && !isDiscordLinked();
    const cta = $('#home-login-cta');
    if (cta) cta.classList.add('hidden');
    $('#web-auth-hint')?.classList.toggle('hidden', !signedOutWeb);
    updateAdminButton();
}

// Web login only: unlink the Discord account so the name is editable again.
function discordLogout() {
    localStorage.removeItem('gtl_discord_user');
    applySettingsToUI();
    updateHomeProfile();
}

// Show the player's real Discord avatar + name in the in-game HUD.
function updateInGameProfile() {
    const el = $('#game-player');
    if (!el) return;
    const profile = getDiscordProfile();
    if (profile && profile.name) {
        const img = $('#game-player-avatar');
        const url = discordAvatarUrl(profile);
        if (img) {
            if (url) {
                img.src = url;
                img.classList.remove('hidden');
            } else {
                img.classList.add('hidden');
            }
        }
        const nameEl = $('#game-player-name');
        if (nameEl) nameEl.textContent = profile.name;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// The "Login with Discord" button is only useful on the plain web build: the
// Electron file:// origin can't be an OAuth redirect target, and inside a
// Discord Activity the name is already filled from the SDK.
function updateDiscordLoginButton() {
    const loginBtn = $('#btn-discord-login');
    const logoutBtn = $('#btn-discord-logout');
    const status = $('#discord-login-status');
    const web = document.documentElement.classList.contains('platform-web');
    const configured = !!(window.DISCORD_CONFIG && window.DISCORD_CONFIG.clientId);
    // Also hidden inside a Discord iframe: the OAuth redirect can't run there.
    const area = web && configured && !isDiscordActivity() && !isDiscordEmbedded();
    const linked = getLinkedDiscordUser();

    // Signed out -> show Login; signed in -> show Logout instead.
    if (loginBtn) loginBtn.classList.toggle('hidden', !(area && !linked));
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !(area && linked));
    if (status) {
        if (area && linked && linked.name) {
            status.textContent = `${t('discordLinkedAs')} ${linked.name}`;
            status.classList.remove('hidden');
        } else {
            status.classList.add('hidden');
        }
    }
}

// Kick off the Discord OAuth2 authorization-code flow (a full-page redirect).
function startDiscordLogin() {
    const clientId = window.DISCORD_CONFIG && window.DISCORD_CONFIG.clientId;
    if (!clientId) return;
    const redirectUri = location.origin + location.pathname;
    const state = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    sessionStorage.setItem('gtl_discord_oauth_state', state);
    sessionStorage.setItem('gtl_discord_return_search', location.search || '');
    $('#auth-error')?.classList.add('hidden');
    location.href = 'https://discord.com/api/oauth2/authorize'
        + `?client_id=${encodeURIComponent(clientId)}`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + '&response_type=code&scope=identify'
        + `&state=${encodeURIComponent(state)}`;
}

// On boot, complete a login if we've just been redirected back with a ?code.
async function handleDiscordOAuthReturn() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return false;

    const savedState = sessionStorage.getItem('gtl_discord_oauth_state');
    sessionStorage.removeItem('gtl_discord_oauth_state');
    // Strip the OAuth params from the address bar no matter what happens next.
    const cleanUrl = location.origin + location.pathname;
    const returnSearch = sessionStorage.getItem('gtl_discord_return_search') || '';
    sessionStorage.removeItem('gtl_discord_return_search');
    try {
        window.history.replaceState({}, document.title, cleanUrl + returnSearch);
    } catch (e) {
        /* ignore */
    }

    if (!savedState || savedState !== params.get('state')) {
        console.warn('Discord OAuth state mismatch — ignoring callback');
        showAuthError(t('discordLoginFailed'));
        return false;
    }

    try {
        const res = await fetch('/api/discord-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: cleanUrl })
        });
        if (!res.ok) throw new Error(`login failed (${res.status})`);
        const user = await res.json();
        const name = sanitizeName(user.global_name || user.username || '');
        if (!name) throw new Error('missing username');
        const cur = getSettings();
        cur.name = name;
        store.settings = cur;
        localStorage.setItem('gtl_discord_user', JSON.stringify({
            id: user.id,
            name,
            avatar: user.avatar || null,
            sessionToken: user.session_token || null
        }));
        return true;
    } catch (e) {
        console.error('Discord login:', e);
        showAuthError(t('discordLoginFailed'));
        return false;
    }
}

function showAuthError(message) {
    const box = $('#auth-error');
    const text = $('#auth-error-text');
    if (text) text.textContent = message;
    box?.classList.remove('hidden');
    announce(message);
}

function applySettingsToUI() {
    const s = getSettings();
    $('#set-language').value = getLang();
    const scaleLabel = $('#ui-scale-value');
    if (scaleLabel) scaleLabel.textContent = Math.round(getUiScale() * 100) + '%';
    if (!isDiscordActivity()) {
        $('#set-name').value = s.name || '';
    }
    $('#set-questions').value = String(s.questions);
    $('#set-sound').checked = !!s.sound;
    const adaptiveEl = $('#set-adaptive'); if (adaptiveEl) adaptiveEl.checked = !!s.adaptive;
    $('#set-difficulty').value = s.difficulty;
    $('#set-timer').value = String(s.timer || 'auto');
    $('#set-feedback-delay').value = String(s.feedbackDelay ?? 4);
    const presenceRow = $('#setting-presence-row');
    if (presenceRow) {
        // Only meaningful inside Discord with the rich-presence scope granted.
        presenceRow.classList.toggle('hidden', !canPublishPresence());
        $('#set-presence').checked = s.discordPresence !== false;
    }
    const webIdentity = requiresDiscordLogin();
    $('#setting-name-row')?.classList.toggle('hidden', webIdentity);
    $('#discord-name-note')?.classList.toggle('hidden', !webIdentity);
    $('#settings-error')?.classList.add('hidden');
    syncDiscordNameField();
    updateDiscordLoginButton();
    updateHomeProfile();
    updateStartButtonState();
}

function saveSettingsFromUI() {
    // Guard against an empty / non-option #set-questions value writing a
    // 0-question round: fall back to the current or default question count.
    const q = Number($('#set-questions').value);
    const timerRaw = $('#set-timer') ? $('#set-timer').value : 'auto';
    const feedbackRaw = $('#set-feedback-delay')?.value || '4';
    store.settings = {
        name: isDiscordLinked()
            ? (getSettings().name || '')
            : sanitizeName($('#set-name').value),
        questions: q > 0 ? q : (getSettings().questions || defaultSettings.questions),
        sound: $('#set-sound').checked,
        adaptive: $('#set-adaptive') ? $('#set-adaptive').checked : (getSettings().adaptive === true),
        difficulty: $('#set-difficulty').value,
        timer: timerRaw === 'auto' ? 'auto' : (Number(timerRaw) || 'auto'),
        feedbackDelay: feedbackRaw === 'manual' ? 'manual' : ([2, 4, 6].includes(Number(feedbackRaw)) ? Number(feedbackRaw) : 4),
        discordPresence: $('#set-presence') ? $('#set-presence').checked : (getSettings().discordPresence !== false)
    };
    updateStartButtonState();
    // Turning the toggle off must take the card down immediately, not at the next
    // question.
    pushPresence();
}

function getPlayerNameInputValue() {
    if (isDiscordActivity()) {
        return getDiscordDisplayName() || '';
    }
    const raw = $('#set-name')?.value ?? getSettings().name ?? '';
    return String(raw).trim().slice(0, 24);
}

// Player name used on the leaderboard. Defaults to "User".
function getPlayerName() {
    const profile = getDiscordProfile();
    if (profile?.name) {
        return isSafePlayerName(profile.name) ? sanitizeName(profile.name) : `Player ${String(profile.id || '').slice(-4) || 'User'}`;
    }
    const name = getPlayerNameInputValue();
    return name || 'User';
}

function openSettingsPanel() {
    closeDialog($('#about-panel'), false);
    applySettingsToUI();
    const nameInput = $('#set-name');
    openDialog($('#settings-panel'), nameInput && !nameInput.disabled ? nameInput : $('#set-language'));
    if (nameInput && !nameInput.disabled) nameInput.select();
}

async function ensureValidPlayerName() {
    const previousName = getSettings().name ? getSettings().name.trim().toLowerCase() : '';
    saveSettingsFromUI();
    if (isDiscordLinked()) {
        return { valid: true, name: getPlayerName() };
    }

    const candidate = getPlayerNameInputValue();
    if (!candidate) {
        openSettingsPanel();
        return { valid: false, name: '', message: t('nameRequired') };
    }

    if (!isSafePlayerName(candidate)) {
        openSettingsPanel();
        $('#set-name')?.setAttribute('aria-invalid', 'true');
        const error = $('#settings-error');
        if (error) {
            error.textContent = t('unsafeName');
            error.classList.remove('hidden');
        }
        return { valid: false, name: '', message: t('unsafeName') };
    }

    const lower = candidate.toLowerCase();
    const isReturningName = lower && previousName && lower === previousName;

    if (supabaseConfigured() && !isReturningName) {
        try {
            const safety = await sbFetch('rpc/is_safe_player_name', {
                method: 'POST',
                body: JSON.stringify({ p_name: candidate })
            });
            if (safety !== true) {
                openSettingsPanel();
                return { valid: false, name: '', message: t('unsafeName') };
            }
            const top = await fetchTopScores(100);
            const hasOnlineDuplicate = (top || []).some((r) => String(r.player || '').trim().toLowerCase() === lower);
            if (hasOnlineDuplicate) {
                openSettingsPanel();
                return { valid: false, name: '', message: t('nameTaken') };
            }
        } catch (e) {
            console.warn('Unable to verify leaderboard name availability:', e);
        }
    }

    return { valid: true, name: candidate };
}

function updateStartButtonState() {
    const startBtn = $('#btn-start');
    if (startBtn) {
        const hasQuestions = Array.isArray(state.allQuestions) && state.allQuestions.length > 0;
        const needsLogin = requiresDiscordLogin() && !isDiscordLinked();
        startBtn.disabled = needsLogin ? false : !(hasQuestions && canPlay());
        startBtn.dataset.authAction = needsLogin ? 'true' : 'false';
        startBtn.setAttribute('data-i18n', needsLogin ? 'loginDiscordToPlay' : 'start');
        startBtn.textContent = t(needsLogin ? 'loginDiscordToPlay' : 'start');
    }
    // Host / Join follow the same gate.
    refreshMultiplayerButtons();
}

// Gate before starting/hosting/joining. On the web build that means signing in
// with Discord (we kick off the flow); elsewhere it means having a name.
function requireNameToInteract() {
    if (canPlay()) return true;
    if (requiresDiscordLogin()) {
        startDiscordLogin();
        return false;
    }
    openSettingsPanel();
    const error = $('#settings-error');
    if (error) {
        error.textContent = t('nameRequired');
        error.classList.remove('hidden');
    }
    announce(t('nameRequired'));
    return false;
}

// ============================================================
//  Round building
// ============================================================
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function shuffleOptions(arr, optionSeed) {
    if (optionSeed != null && window.GTL_MULTIPLAYER) {
        return window.GTL_MULTIPLAYER.seededShuffle(arr, optionSeed);
    }
    return shuffle(arr);
}

// Number of language choices shown per question. The pool (LANGUAGES) is larger,
// so each question shows the correct language plus a rotating set of distractors.
const LANG_OPTION_COUNT = 4;

// Pick the on-screen language options for a question: the correct language plus
// (LANG_OPTION_COUNT-1) distractors from the pool, then shuffle. optionSeed keeps
// the selection identical for every player in a multiplayer round.
function buildLanguageOptions(correctName, optionSeed) {
    const correct =
        LANGUAGES.find((l) => l.name === correctName) ||
        { name: correctName, glyph: '?', color: 'linear-gradient(135deg,#8aa4bf,#4a6f8f)' };
    const others = LANGUAGES.filter((l) => l.name !== correct.name);
    const distractors = shuffleOptions(others, optionSeed).slice(0, LANG_OPTION_COUNT - 1);
    const seed2 = optionSeed != null ? ((optionSeed ^ 0x9e3779b9) >>> 0) : null;
    return shuffleOptions([correct, ...distractors], seed2).map((l) => ({
        label: l.name,
        glyph: l.glyph,
        color: l.color
    }));
}

function scoreAnswer(timeLeft, streakAfter) {
    const multiplier = streakAfter >= 3 ? 1.5 : 1;
    // Guard against a non-finite timeLeft (e.g. practice mode's ∞ timer) so the
    // score can never become Infinity.
    const t = Number.isFinite(timeLeft) ? Math.max(0, timeLeft) : 0;
    return Math.round((100 + 10 * t) * multiplier);
}

function timeForDifficulty(d) {
    return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
}

// Seconds for a single-player question: the headless-test seam wins, then the
// player's "Time per question" setting (a fixed value or "auto"), else the
// per-difficulty default.
function resolvedQuestionTime(difficulty) {
    if (typeof window.__GTL_QTIME === 'number' && window.__GTL_QTIME > 0) return window.__GTL_QTIME;
    const t = getSettings().timer;
    if (t && t !== 'auto') {
        const n = Number(t);
        if (n > 0) return n;
    }
    return timeForDifficulty(difficulty);
}

// Deal `count` questions round-robin across the banks present in the pool, so a
// mixed round can't be swallowed by the biggest bank. Drawing uniformly used to
// mean ~45% of 10-question "All" rounds contained no Problem Solving question at
// all, because `languages` alone is over half the pool. One pass gives every bank
// a slot before any bank repeats; the bank order and the final order are shuffled
// so the rotation isn't visible to the player.
function sampleAcrossBanks(pool, count, shuffleFn) {
    const byBank = new Map();
    pool.forEach((q) => {
        const bank = q.bank || 'languages';
        if (!byBank.has(bank)) byBank.set(bank, []);
        byBank.get(bank).push(q);
    });
    // Single-bank pool (any specific mode): nothing to balance.
    if (byBank.size < 2) return shuffleFn(pool).slice(0, count);

    const queues = shuffleFn(Array.from(byBank.values())).map((qs) => shuffleFn(qs));
    const picked = [];
    for (let depth = 0; picked.length < count; depth++) {
        let dealt = false;
        for (const queue of queues) {
            if (depth >= queue.length) continue;
            picked.push(queue[depth]);
            dealt = true;
            if (picked.length === count) break;
        }
        if (!dealt) break; // every bank exhausted
    }
    return shuffleFn(picked);
}

function buildRoundFromPool(pool, settings) {
    let filtered = pool;
    if (settings.difficulty !== 'all') filtered = pool.filter((q) => q.difficulty === settings.difficulty);
    if (filtered.length === 0) filtered = pool;
    return sampleAcrossBanks(filtered, Math.min(settings.questions, filtered.length), shuffle);
}

function buildRound() {
    state.round = buildRoundFromPool(state.allQuestions, getSettings());
}

// ---------- Adaptive difficulty (opt-in) ----------
// When on, questions are picked one at a time: the target difficulty rises after a
// correct answer and falls after a wrong one, so the round meets the player's level.
function setupAdaptive(pool, count) {
    state.adaptive = true;
    state.adaptiveTarget = 'easy';
    state.adaptiveUsed = new Set();
    state.adaptivePool = { easy: [], medium: [], hard: [] };
    (pool || []).forEach((q) => {
        const d = state.adaptivePool[q.difficulty] ? q.difficulty : 'medium';
        state.adaptivePool[d].push(q);
    });
    state.round = new Array(Math.max(1, count)).fill(null);
}
function pickAdaptiveQuestion() {
    const prefer = ({
        easy: ['easy', 'medium', 'hard'], medium: ['medium', 'hard', 'easy'], hard: ['hard', 'medium', 'easy']
    })[state.adaptiveTarget] || ['medium', 'easy', 'hard'];
    const key = (q) => (q.bank || '') + '|' + q.id;
    for (const d of prefer) {
        const avail = (state.adaptivePool[d] || []).filter((q) => !state.adaptiveUsed.has(key(q)));
        if (avail.length) { const q = avail[Math.floor(Math.random() * avail.length)]; state.adaptiveUsed.add(key(q)); return q; }
    }
    const all = Object.values(state.adaptivePool).flat();
    const q = all.find((x) => !state.adaptiveUsed.has(key(x))) || all[0];
    if (q) state.adaptiveUsed.add(key(q));
    return q;
}
function bumpAdaptive(correct) {
    if (!state.adaptive) return;
    const up = { easy: 'medium', medium: 'hard', hard: 'hard' };
    const down = { hard: 'medium', medium: 'easy', easy: 'easy' };
    state.adaptiveTarget = correct ? up[state.adaptiveTarget] : down[state.adaptiveTarget];
}
// Turn adaptive on for a single-player round if the setting is enabled.
function maybeSetupAdaptive() {
    if (getSettings().adaptive && !state.daily) {
        setupAdaptive(state.allQuestions, Math.min(getSettings().questions || 10, (state.allQuestions || []).length || 10));
    } else {
        state.adaptive = false;
    }
}

// ---------- Daily Challenge: the same 10 questions for everyone, every day ----------
const DAILY_QUESTION_COUNT = 10;
// Small deterministic PRNG so every client picks the identical daily set.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Integer seed derived from the UTC date, so the day flips at 00:00 UTC worldwide.
function dailySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
function dailyDateKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function seededShuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// Deterministic 10 questions from the whole pool. Sorted by a stable (bank,id) key
// first so the selection is identical on every client that day regardless of load order.
function buildDailyRound(pool) {
    const stable = (pool || []).slice().sort((a, b) =>
        String(a.bank).localeCompare(String(b.bank)) || (Number(a.id) - Number(b.id)));
    return seededShuffle(stable, mulberry32(dailySeed())).slice(0, DAILY_QUESTION_COUNT);
}

// Local "already played today" marker (the server unique(day,player) is the real guard).
function dailyDoneKey() { return 'gtl_daily_done_' + dailyDateKey(); }
function isDailyDone() { try { return localStorage.getItem(dailyDoneKey()) === '1'; } catch (e) { return false; } }
function markDailyDone() { try { localStorage.setItem(dailyDoneKey(), '1'); } catch (e) {} }

async function startDailyChallenge() {
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) { announce(nameCheck.message || t('nameRequired')); return; }
    if (!state.allQuestions || !state.allQuestions.length) {
        try { state.allQuestions = await window.gameAPI.getQuestions('all'); } catch (e) { /* ignore */ }
    }
    const round = buildDailyRound(state.allQuestions);
    if (!round.length) { announce(t('lbOffline')); return; }
    state.round = round;
    state.daily = true;
    state.learn = false;
    state.adaptive = false; // the daily set is fixed and identical for everyone
    state.mode = 'all'; // mixed styles; the daily board is separate from mode boards
    beginRound();
}

// Shared round bootstrap used by both a normal game and the daily challenge.
function beginRound() {
    state.index = 0;
    state.score = 0;
    state.correct = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.roundHistory = [];
    state.viewOnly = false;
    state.selectedAnswer = null;
    state.gameStartMs = Date.now();
    state.lifelines = 2; // two 50:50s per round
    updateScore();
    updateCorrect();
    updateStreakPill();
    updateFiftyButton();
    $('#q-total').textContent = String(state.round.length);
    $('#correct-total').textContent = String(state.round.length);
    updateInGameProfile();
    // The "you've been challenged" banner belongs on Home only — clear it once play
    // starts (the win/lose verdict shows on the results screen instead).
    $('#challenge-banner')?.classList.add('hidden');
    showScreen('game');
    markPresenceRoundStart();
    nextQuestion();
}

// ============================================================
//  Game flow
// ============================================================
async function startGame() {
    // On the web build you must sign in with Discord first (this kicks off the
    // flow); the button is also disabled, so this is mostly a safety net.
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) {
        announce(nameCheck.message || t('nameRequired'));
        return;
    }

    buildRound();
    state.daily = false;
    state.learn = false;
    maybeSetupAdaptive();
    beginRound();
}

// Practice mode: same questions, no timer, no scoring/leaderboard — just learn.
async function startPractice() {
    if (!requireNameToInteract()) return;
    const nameCheck = await ensureValidPlayerName();
    if (!nameCheck.valid) { announce(nameCheck.message || t('nameRequired')); return; }
    buildRound();
    state.daily = false;
    state.learn = true;
    maybeSetupAdaptive();
    beginRound();
}

// Normalise a typed fill-in answer so grading ignores case and spacing.
function normFill(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Grade a fill-in-the-blank answer. Single-player also accepts the question's
// `accept` variants; multiplayer uses canonical-only so it matches the server.
function isFillCorrect(cur, typed, canonicalOnly) {
    const n = normFill(typed);
    if (!n) return false;
    if (n === normFill(cur.answer)) return true;
    if (canonicalOnly) return false;
    return (cur.accept || []).some((a) => normFill(a) === n);
}

// Turn a raw question into a uniform shape for rendering. The type is detected
// per-question (by its fields) so the "All" mode can mix all kinds in a round:
//   languages -> pick a language button; cyber -> multiple choice;
//   fill -> type the missing code (a ____ blank + a typed answer).
function normalizeQuestion(q, opts) {
    const optionSeed = opts && opts.optionSeed != null ? opts.optionSeed : null;
    if (q.correctLanguage) {
        return {
            id: q.id,
            bank: q.bank || 'languages',
            style: 'languages',
            panelText: q.codeSnippet,
            panelIsCode: true,
            questionText: t('langPrompt'),
            options: buildLanguageOptions(q.correctLanguage, optionSeed),
            answer: q.correctLanguage,
            difficulty: q.difficulty,
            explanation: q.explanation
        };
    }
    if (Array.isArray(q.options) && q.answer != null) {
        const hasCmd = !!(q.codeSnippet && q.codeSnippet.trim().length);
        return {
            id: q.id,
            bank: q.bank || state.mode,
            style: 'cyber',
            panelText: hasCmd ? q.codeSnippet : q.question[getLang()],
            panelIsCode: hasCmd,
            questionText: hasCmd ? q.question[getLang()] : '',
            options: shuffleOptions(q.options, optionSeed).map((o) => ({
                label: o
            })),
            answer: q.answer,
            difficulty: q.difficulty,
            explanation: q.explanation
        };
    }
    // Fill-in-the-blank / code completion.
    return {
        id: q.id,
        bank: q.bank || 'algorithms',
        style: 'fill',
        panelText: q.codeSnippet || '',
        panelIsCode: true,
        questionText: q.question ? q.question[getLang()] : t('fillPrompt'),
        answer: q.answer,
        accept: Array.isArray(q.accept) ? q.accept : [],
        difficulty: q.difficulty,
        explanation: q.explanation
    };
}

function nextQuestion() {
    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    state.answered = false;
    state.selectedAnswer = null;
    if (state.index >= state.round.length) {
        endGame();
        return;
    }
    // Adaptive rounds fill each slot on demand based on the running target difficulty.
    if (state.adaptive && !state.round[state.index]) {
        const picked = pickAdaptiveQuestion();
        if (!picked) { endGame(); return; }
        state.round[state.index] = picked;
    }

    const cur = normalizeQuestion(state.round[state.index]);
    state.current = cur;
    $('#q-current').textContent = String(state.index + 1);
    const dEl = $('#code-difficulty');
    dEl.dataset.diff = cur.difficulty;
    dEl.textContent = diffLabel(cur.difficulty);

    // Prompt panel: highlighted code, or wrapped plain text for concept questions.
    const codeEl = $('#code-snippet');
    const panel = codeEl.parentElement; // the <pre class="code-panel">
    if (cur.panelIsCode) {
        panel.classList.remove('as-text');
        panel.setAttribute('dir', 'ltr');
        codeEl.innerHTML = highlight(cur.panelText);
    } else {
        panel.classList.add('as-text');
        panel.setAttribute('dir', 'auto');
        codeEl.textContent = cur.panelText;
    }

    // Sub-question (cyber: "what does this command do?").
    const qt = $('#question-text');
    if (cur.questionText) {
        qt.classList.remove('hidden');
        qt.textContent = cur.questionText;
    } else {
        qt.classList.add('hidden');
        qt.textContent = '';
    }

    hideToast();
    renderQuestionUI(cur, false);
    state.questionTime = resolvedQuestionTime(cur.difficulty);
    state.questionStartedAt = Date.now();
    if (state.learn) {
        // Practice mode: no countdown — take your time. Keep timeLeft finite (full
        // time) so scoring never becomes Infinity; the display just shows ∞.
        clearTimer();
        state.timeLeft = state.questionTime;
        $('#timer-num').textContent = '∞';
        setRing(1);
    } else {
        startTimer(state.questionTime);
    }
    pushPresence();
}

// Render the answer UI for a question: option buttons for languages/cyber, or a
// typed input for fill-in-the-blank. Keeps the two mutually exclusive.
function renderQuestionUI(cur, disabled) {
    const grid = $('#options-grid');
    const fill = $('#fill-form');
    if (cur.style === 'fill') {
        grid.innerHTML = '';
        grid.classList.add('hidden');
        setupFillForm(disabled);
        fill.classList.remove('hidden');
    } else {
        fill.classList.add('hidden');
        renderOptions(cur, disabled);
        grid.classList.remove('hidden');
    }
    updateFiftyButton();
}

// 50:50 lifeline — remove two wrong options from the current choice question.
// Single-player / daily only (hidden in multiplayer), two uses per round.
function updateFiftyButton() {
    const btn = $('#btn-fifty');
    if (!btn) return;
    const cur = state.current;
    const isChoice = cur && cur.style !== 'fill';
    btn.classList.toggle('hidden', !!state.multiplayer || !isChoice);
    const remaining = document.querySelectorAll('#options-grid button:not(:disabled):not(.eliminated)').length;
    btn.disabled = state.answered || (state.lifelines || 0) <= 0 || remaining <= 2;
    const cnt = $('#fifty-count');
    if (cnt) cnt.textContent = String(state.lifelines || 0);
}

function useFifty() {
    const cur = state.current;
    if (state.multiplayer || state.answered || (state.lifelines || 0) <= 0 || !cur || cur.style === 'fill') return;
    const live = [...document.querySelectorAll('#options-grid button:not(:disabled):not(.eliminated)')];
    const wrong = live.filter((b) => b.dataset.answer !== cur.answer);
    if (wrong.length <= 1) return; // already down to the answer + one wrong
    shuffle(wrong).slice(0, 2).forEach((b) => { b.classList.add('eliminated'); b.disabled = true; });
    state.lifelines -= 1;
    try { sfx.tick(3); } catch (_) {}
    updateFiftyButton();
}

function setupFillForm(disabled) {
    const input = $('#fill-input');
    const submit = $('#fill-submit');
    if (input) {
        input.value = '';
        input.disabled = !!disabled;
        input.classList.remove('fill-correct', 'fill-wrong');
        input.placeholder = t('fillPlaceholder');
    }
    if (submit) submit.disabled = !!disabled;
    if (!disabled && input) setTimeout(() => { try { input.focus(); } catch (e) {} }, 40);
}

function renderOptions(cur, disabled) {
    const grid = $('#options-grid');
    grid.innerHTML = '';
    grid.classList.toggle('cyber', cur.style === 'cyber');
    grid.classList.toggle('languages', cur.style === 'languages');
    cur.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.dataset.answer = opt.label;
        btn.disabled = !!disabled;
        if (cur.style === 'languages') {
            btn.className = 'lang-btn';
            btn.innerHTML =
                `<span class="opt-key" aria-hidden="true">${index + 1}</span>` +
                `<span class="lang-icon" style="background:${opt.color}">${opt.glyph}</span>` +
                `<span class="lang-name">${opt.label}</span>`;
        } else {
            // Give multiple-choice options the same card-with-icon look as the
            // language buttons: a lettered A/B/C/D badge plus the answer text.
            btn.className = 'opt-btn';
            const badge = document.createElement('span');
            badge.className = 'opt-badge';
            badge.style.background = OPTION_COLORS[index % OPTION_COLORS.length];
            badge.textContent = String.fromCharCode(65 + index);
            const text = document.createElement('span');
            text.className = 'opt-text';
            text.textContent = opt.label;
            btn.appendChild(badge);
            btn.appendChild(text);
        }
        btn.addEventListener('click', () => {
            if (state.multiplayer) onAnswerMultiplayer(opt.label, btn);
            else onAnswer(opt.label, btn);
        });
        grid.appendChild(btn);
    });
}

function clearSelectedOption() {
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.classList.remove('selected');
    });
}

// Keyboard answering for choice questions: 1–4 / a–d pick the matching option.
function onGameKeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!$('#screen-game')?.classList.contains('active')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    const grid = $('#options-grid');
    if (!grid || grid.classList.contains('hidden') || state.answered) return;

    let idx = -1;
    if (e.key >= '1' && e.key <= '9') idx = Number(e.key) - 1;
    else {
        const k = (e.key || '').toLowerCase();
        if (k.length === 1 && k >= 'a' && k <= 'f') idx = k.charCodeAt(0) - 97;
    }
    if (idx < 0) return;
    const btns = grid.querySelectorAll('button:not(:disabled)');
    if (btns[idx]) {
        e.preventDefault();
        btns[idx].click();
    }
}

function onAnswer(chosen, btn) {
    if (state.answered) return;
    state.selectedAnswer = chosen;
    clearSelectedOption();
    if (btn) {
        btn.classList.add('selected');
    }
    // Practice mode has no timer, so a pick resolves immediately (with the explanation).
    if (state.learn) { resolveCurrentQuestion(chosen, false); return; }
    // Once a choice is locked in, don't make the player wait out a long timer:
    // if more than 2s remain, fast-forward the countdown to 2s (the answer stays
    // changeable during that window, then resolves).
    if (state.timeLeft > 2) {
        state.timeLeft = 2;
        updateTimerDisplay();
        setRing(state.timeLeft / state.questionTime);
    }
}

// Submit a typed fill-in-the-blank answer. Single-player grades and reveals
// immediately; multiplayer submits and waits for the shared reveal.
function submitFill() {
    if (!state.current || state.current.style !== 'fill') return;
    if (state.answered) return;
    const input = $('#fill-input');
    const typed = input ? input.value : '';
    if (state.multiplayer) {
        if (state.spectator) return;
        const room = window.GTL_MULTIPLAYER.state.room;
        if (!room || room.phase !== 'question') return;
        state.answered = true;
        state.mpChosen = typed;
        if (input) input.disabled = true;
        const submit = $('#fill-submit');
        if (submit) submit.disabled = true;
        showMpWaiting();
        window.GTL_MULTIPLAYER.submitAnswer(normFill(typed), state.timeLeft)
            .catch((e) => console.error('submit_answer:', e));
        state.mpAnsweredIndex = state.index;
    } else {
        state.selectedAnswer = typed;
        resolveCurrentQuestion(typed, false);
    }
}

function resolveCurrentQuestion(chosen, timedOut = false) {
    if (state.answered) return;
    state.answered = true;
    clearTimer();
    updateFiftyButton(); // grey out the lifeline once the question is locked
    const cur = state.current;
    const isFill = cur.style === 'fill';
    const correct = isFill ? isFillCorrect(cur, chosen) : (chosen === cur.answer);

    if (isFill) {
        const input = $('#fill-input');
        const submit = $('#fill-submit');
        if (input) {
            input.disabled = true;
            input.classList.remove('fill-correct', 'fill-wrong');
            input.classList.add(correct ? 'fill-correct' : 'fill-wrong');
        }
        if (submit) submit.disabled = true;
    } else {
        const buttons = Array.from(document.querySelectorAll('#options-grid button'));
        buttons.forEach((b) => {
            b.disabled = true;
            b.classList.remove('selected');
        });
        buttons.forEach((b) => {
            if (b.dataset.answer === cur.answer) b.classList.add('correct');
        });
        if (!correct && chosen) {
            const selectedBtn = buttons.find((b) => b.dataset.answer === chosen);
            if (selectedBtn) selectedBtn.classList.add('wrong', 'shake');
        }
    }

    let gained = 0;
    if (correct) {
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        state.correct += 1;
        gained = scoreAnswer(state.timeLeft, state.streak);
        state.score += gained;
        sfx.correct();
        updateScore(true);
        updateCorrect();
        showFeedback('good', `${t('correct')} +${gained}${state.streak >= 3 ? '  ' + t('streakBonus') : ''}`, cur.explanation[getLang()]);
    } else {
        state.streak = 0;
        sfx.wrong();
        showFeedback('bad', `${t('wrong')} ${cur.answer}.`, cur.explanation[getLang()]);
    }

    recordRoundAnswer(cur, chosen, correct, gained, timedOut);
    updateStreakPill();
    if (state.multiplayer) return;
    bumpAdaptive(correct); // nudge the next question's difficulty
    state.index += 1;
    scheduleFeedbackAdvance();
}

function recordRoundAnswer(cur, chosen, correct, points, timedOut) {
    const elapsed = Math.max(0, Date.now() - (state.questionStartedAt || Date.now()));
    state.roundHistory.push({
        questionIndex: state.index,
        id: cur.id,
        bank: cur.bank,
        difficulty: cur.difficulty,
        style: cur.style,
        prompt: cur.questionText || cur.panelText,
        panelText: cur.panelText,
        selectedAnswer: chosen || '',
        correctAnswer: cur.answer,
        correct: !!correct,
        timedOut: !!timedOut,
        responseTimeMs: Math.min(elapsed, state.questionTime * 1000),
        points: Number(points) || 0,
        explanation: cur.explanation || {}
    });
}

function scheduleFeedbackAdvance() {
    const panel = $('#feedback-panel');
    const next = $('#btn-next');
    panel?.classList.remove('hidden');
    next?.classList.remove('hidden');
    requestAnimationFrame(() => next?.focus());
    // Practice mode always waits for a manual "Next" so you can study the explanation.
    if (state.learn) return;
    const setting = getSettings().feedbackDelay;
    if (setting === 'manual') return;
    const seconds = [2, 4, 6].includes(Number(setting)) ? Number(setting) : 4;
    const delay = typeof window.__GTL_FEEDBACK_MS === 'number' ? window.__GTL_FEEDBACK_MS : seconds * 1000;
    state.advanceTimer = setTimeout(advanceAfterFeedback, delay);
}

function advanceAfterFeedback() {
    if (state.advanceTimer) clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
    nextQuestion();
}

function onAnswerMultiplayer(chosen, btn) {
    // Spectators watch only — their picks never count.
    if (state.spectator) return;
    // Accept picks only while the question is open. The player MAY change their
    // answer as many times as they like before the timer runs out.
    const room = window.GTL_MULTIPLAYER.state.room;
    if (!room || room.phase !== 'question') return;
    state.answered = true;
    state.mpChosen = chosen;
    const timeLeft = state.timeLeft;

    // Highlight the current choice but keep every option clickable so it can be
    // changed. Correctness and the score stay hidden until the reveal, and the
    // score itself is not awarded until the question's time is up.
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.classList.toggle('mp-selected', b.dataset.answer === chosen);
    });
    showMpWaiting();

    window.GTL_MULTIPLAYER.submitAnswer(chosen, timeLeft)
        .catch((e) => console.error('submit_answer:', e));

    state.mpAnsweredIndex = state.index;
}

// ---------- Timer ----------
function startTimer(seconds) {
    if (state.multiplayer) {
        startTimerFromServer();
        return;
    }
    state.timeLeft = seconds;
    state.lastTickSecond = -1;
    updateTimerDisplay();
    setRing(1);
    state.timerId = setInterval(() => {
        state.timeLeft -= 1;
        updateTimerDisplay();
        setRing(state.timeLeft / state.questionTime);
        maybeCountdownBeep(state.timeLeft);
        if (state.timeLeft <= 0) {
            clearTimer();
            onTimeout();
        }
    }, 1000);
}

// Beep once per second over the final 3 seconds, but only while the player has
// not answered yet (so a locked-in answer goes quiet).
function maybeCountdownBeep(left) {
    if (left <= 3 && left > 0 && !state.answered && left !== state.lastTickSecond) {
        state.lastTickSecond = left;
        sfx.tick(left);
    }
}

function startTimerFromServer() {
    clearTimer();
    state.lastTickSecond = -1;
    const total = state.questionTime || 15;

    function tick() {
        const room = window.GTL_MULTIPLAYER.state.room;
        if (!room ?.question_ends_at) return;
        const left = window.GTL_MULTIPLAYER.remainingSeconds(room);
        state.timeLeft = left;
        updateTimerDisplay();
        setRing(left / total);
        if (room.phase === 'question') maybeCountdownBeep(left);
        if (left <= 0 && room.phase === 'question') {
            if (!state.answered) {
                onTimeoutMultiplayer();
            } else {
                // Time is up — lock in the current pick (no more changes).
                document.querySelectorAll('#options-grid button').forEach((b) => {
                    b.disabled = true;
                });
            }
        }
    }
    tick();
    state.timerId = setInterval(tick, 200);
}

function onTimeout() {
    if (state.answered) return;
    const cur = state.current;
    // For fill-in questions the "pick" is whatever was typed (even if not
    // submitted); for choice questions it's the selected option.
    let pick = state.selectedAnswer;
    if (cur && cur.style === 'fill') {
        const input = $('#fill-input');
        pick = input ? input.value : '';
    }
    const hadPick = cur && cur.style === 'fill' ? !!normFill(pick) : !!state.selectedAnswer;
    // resolveCurrentQuestion already shows the correct/wrong feedback (and
    // handles the streak + score) for whatever the player picked. Only when
    // NOTHING was picked do we replace it with the red "time's up" message.
    resolveCurrentQuestion(pick, true);
    if (!hadPick && !state.multiplayer) {
        showFeedback('bad', `${t('timeUp')} ${cur.answer}.`, cur.explanation[getLang()]);
    }
    updateStreakPill();
}

function onTimeoutMultiplayer() {
    if (state.answered) return;
    state.answered = true;
    // For a fill question, submit whatever was typed (even if not clicked) so it
    // still counts; otherwise no pick was made.
    if (state.current && state.current.style === 'fill') {
        const input = $('#fill-input');
        state.mpChosen = input ? input.value : '';
        if (input) input.disabled = true;
        const submit = $('#fill-submit');
        if (submit) submit.disabled = true;
    } else {
        state.mpChosen = '';
    }
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.disabled = true;
    });
    // The shared deadline has passed; the reveal follows almost immediately.
    showMpWaiting();
    // A fill answer typed-but-not-submitted still counts on timeout.
    const finalAnswer = state.current && state.current.style === 'fill'
        ? normFill(state.mpChosen) : '';
    window.GTL_MULTIPLAYER.submitAnswer(finalAnswer, 0)
        .then(() => syncMpHudFromPlayers())
        .catch((e) => console.error('timeout submit:', e));
    state.mpAnsweredIndex = state.index;
}

// End the round early and show the results so far.
function endQuiz() {
    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    if (state.multiplayer && window.GTL_MULTIPLAYER.state.isAdmin) {
        window.GTL_MULTIPLAYER.endRoom().catch((e) => console.error(e));
        return;
    }
    endGame();
}

function clearTimer() {
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }
}

function updateTimerDisplay() {
    $('#timer-num').textContent = String(Math.max(0, state.timeLeft));
}

function setRing(fraction) {
    fraction = Math.max(0, Math.min(1, fraction));
    const ring = $('#ring-fg');
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
    ring.classList.toggle('warn', fraction <= 0.4 && fraction > 0.2);
    ring.classList.toggle('danger', fraction <= 0.2);
}

// ---------- HUD ----------
function updateScore(pulse) {
    const el = $('#game-score');
    el.textContent = String(state.score);
    if (pulse) {
        el.animate(
            [{
                transform: 'scale(1)'
            }, {
                transform: 'scale(1.35)'
            }, {
                transform: 'scale(1)'
            }], {
                duration: 350,
                easing: 'ease-out'
            }
        );
    }
    // The score is half of what the Discord card advertises.
    pushPresence();
}

function updateCorrect() {
    $('#correct-count').textContent = String(state.correct);
}

function updateStreakPill() {
    const pill = $('#streak-pill');
    if (state.streak >= 3) {
        pill.classList.remove('hidden');
        $('#streak-count').textContent = String(state.streak);
    } else {
        pill.classList.add('hidden');
    }
}

// Structured answer feedback: a bold result headline plus the question's
// explanation on its own line, so the teaching text is readable at a glance
// (and stays put for the whole review window) instead of a cramped single line.
function showFeedback(kind, headline, explanation) {
    const toast = $('#answer-toast');
    const h = $('#fb-headline');
    const e = $('#fb-explanation');
    if (h) h.textContent = headline || '';
    if (e) {
        e.textContent = explanation || '';
        e.classList.toggle('hidden', !explanation);
    }
    if (toast) toast.className = `toast show ${kind}`;
    $('#feedback-panel')?.classList.remove('hidden');
    $('#btn-next')?.classList.toggle('hidden', state.multiplayer);
    announce(`${headline || ''}${explanation ? '. ' + explanation : ''}`);
}

// Back-compat shim for any single-line callers.
function showToast(text, kind) {
    showFeedback(kind, text, '');
}

function hideToast() {
    $('#answer-toast').className = 'toast';
    $('#feedback-panel')?.classList.add('hidden');
    $('#btn-next')?.classList.add('hidden');
}

// Multiplayer "Waiting for opponents…" banner (shown after you lock an answer
// while the timer keeps running for the others).
function showMpWaiting() {
    const el = $('#mp-status');
    if (!el) return;
    el.textContent = t('waitingOpponents');
    el.classList.remove('hidden');
}

function hideMpStatus() {
    const el = $('#mp-status');
    if (el) el.classList.add('hidden');
}

// ============================================================
//  Results / leaderboard
// ============================================================
async function endGame() {
    const viewOnly = !!state.viewOnly;

    if (!viewOnly && state.score > store.highScore(state.mode)) {
        store.setHighScore(state.mode, state.score);
    }
    if (!viewOnly) sfx.finish();
    showScreen('results');

    $('.final-score').classList.toggle('hidden', viewOnly);
    $('.results-correct').classList.toggle('hidden', viewOnly);
    $('#btn-challenge').classList.toggle('hidden', viewOnly);
    $('#btn-share-card')?.classList.toggle('hidden', viewOnly);
    $('#challenge-link').classList.add('hidden');
    // "Play again" only makes sense after an actual round — not when just browsing
    // the leaderboard (viewOnly), where there's no round to replay.
    $('#btn-replay').classList.toggle('hidden', viewOnly);
    $('#btn-replay').textContent = t('replay');
    $('#btn-menu').textContent = t('backMenu');
    $('.results-sub').textContent = `${t('leaderboardFor')} ${currentModeLabel()}`;
    $('#result-stats').classList.toggle('hidden', viewOnly);
    if (viewOnly) $('#round-breakdown')?.classList.add('hidden');
    $('#answer-review').classList.toggle('hidden', viewOnly);
    $('#personal-result').classList.add('hidden');
    renderChallengeVerdict(viewOnly);

    if (!viewOnly) {
        countUp($('#final-score'), state.score, 900);
        $('#results-correct').textContent = String(state.correct);
        $('#results-total').textContent = String(state.round.length);
        renderRoundSummary();
        // Single-player round finished — log play-time + games, award XP and unlock
        // achievements (not a multiplayer win). Practice rounds are not scored/tracked.
        if (!state.multiplayer && !state.learn) recordPlay(false, false, state.score, isPerfectRound());
    }
    await buildResultsLeaderboard();
}

function formatSeconds(ms) {
    if (!Number.isFinite(ms)) return '—';
    return `${(ms / 1000).toFixed(1)}s`;
}

function renderRoundSummary() {
    const history = state.roundHistory || [];
    const total = state.round.length || history.length;
    const answered = history.filter((item) => item.selectedAnswer).length;
    const average = history.length
        ? history.reduce((sum, item) => sum + item.responseTimeMs, 0) / history.length
        : NaN;
    const correctTimes = history.filter((item) => item.correct).map((item) => item.responseTimeMs);
    $('#stat-accuracy').textContent = total ? `${Math.round((state.correct / total) * 100)}%` : '0%';
    $('#stat-streak').textContent = String(state.bestStreak || 0);
    $('#stat-average').textContent = answered ? formatSeconds(average) : '—';
    $('#stat-fastest').textContent = correctTimes.length ? formatSeconds(Math.min(...correctTimes)) : '—';
    renderRoundBreakdown(history);
    renderAnswerReview(history);
}

// Per-category accuracy after a round: by bank when the round mixed several banks
// (All / daily), otherwise by difficulty. Highlights the strongest & weakest area.
function renderRoundBreakdown(history) {
    const wrap = $('#round-breakdown');
    if (!wrap) return;
    const rows = (history || []).filter((h) => h.selectedAnswer || h.timedOut || h.correct === false || h.correct === true);
    const banks = new Set(rows.map((h) => h.bank).filter(Boolean));
    const useBank = banks.size > 1;
    const keyOf = (h) => useBank ? (h.bank || 'other') : (h.difficulty || 'other');
    const label = (k) => useBank ? modeLabel(k === 'algorithms' ? 'algorithms' : k) : (t('diff' + k.charAt(0).toUpperCase() + k.slice(1)) || k);

    const groups = new Map();
    rows.forEach((h) => {
        const k = keyOf(h);
        const g = groups.get(k) || { correct: 0, total: 0 };
        g.total += 1; if (h.correct) g.correct += 1;
        groups.set(k, g);
    });
    if (groups.size < 2) { wrap.classList.add('hidden'); return; }

    const entries = [...groups.entries()].map(([k, g]) => ({ k, label: label(k), pct: Math.round((g.correct / g.total) * 100), correct: g.correct, total: g.total }));
    entries.sort((a, b) => b.pct - a.pct);
    const best = entries[0], worst = entries[entries.length - 1];

    wrap.classList.remove('hidden');
    wrap.innerHTML = `<div class="rb-title">${t('breakdownTitle')}</div>`;
    const list = document.createElement('div');
    list.className = 'rb-list';
    entries.forEach((e) => {
        const row = document.createElement('div');
        row.className = 'rb-row' + (e === best ? ' is-best' : '') + (e === worst && best !== worst ? ' is-worst' : '');
        const name = document.createElement('span'); name.className = 'rb-name'; name.textContent = e.label;
        const bar = document.createElement('span'); bar.className = 'rb-bar';
        const fill = document.createElement('span'); fill.className = 'rb-fill'; fill.style.width = e.pct + '%';
        bar.appendChild(fill);
        const val = document.createElement('span'); val.className = 'rb-val'; val.textContent = `${e.correct}/${e.total}`;
        row.appendChild(name); row.appendChild(bar); row.appendChild(val);
        list.appendChild(row);
    });
    wrap.appendChild(list);
}

// Draw a shareable result card (score / mode / accuracy / name) to a PNG and
// share it (Web Share API with a file) or download it as a fallback.
async function shareResultCard() {
    try {
        const w = 1080, h = 1350;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#0e2a44'); g.addColorStop(1, '#081019');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(46,197,255,0.10)';
        ctx.beginPath(); ctx.arc(w * 0.82, h * 0.14, 340, 0, Math.PI * 2); ctx.fill();
        const cx = w / 2, FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8ea6c0'; ctx.font = `600 42px ${FONT}`;
        ctx.fillText('GUESS THE LANGUAGE', cx, 150);
        ctx.fillStyle = '#2ec5ff'; ctx.font = `800 56px ${FONT}`;
        ctx.fillText(state.daily ? t('dailyChallenge') : currentModeLabel(), cx, 250);
        // Player's Discord avatar as a circular badge (falls back to the trophy when
        // there's no avatar or it fails to load / would taint the canvas).
        const avImg = await loadCrossOriginImage(discordAvatarUrl(getDiscordProfile(), 256));
        if (avImg) {
            const r = 108, ay = 430;
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, ay, r + 8, 0, Math.PI * 2);
            ctx.fillStyle = '#2ec5ff'; ctx.fill();
            ctx.beginPath(); ctx.arc(cx, ay, r, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(avImg, cx - r, ay - r, r * 2, r * 2);
            ctx.restore();
        } else {
            ctx.font = '150px serif'; ctx.fillText('🏆', cx, 470);
        }
        ctx.fillStyle = '#eaf4ff'; ctx.font = `900 200px ${FONT}`;
        ctx.fillText(String(state.score), cx, 720);
        ctx.fillStyle = '#8ea6c0'; ctx.font = `600 44px ${FONT}`;
        ctx.fillText('SCORE', cx, 792);
        const total = state.round.length || 1;
        const acc = Math.round((state.correct / total) * 100);
        ctx.fillStyle = '#19f0c4'; ctx.font = `800 62px ${FONT}`;
        ctx.fillText(`${acc}%   ·   ${state.correct}/${total}`, cx, 930);
        ctx.fillStyle = '#cfe0f4'; ctx.font = `700 54px ${FONT}`;
        ctx.fillText(safeDisplayName(getPlayerName()) || 'Player', cx, 1130);
        ctx.fillStyle = '#5f7590'; ctx.font = `500 38px ${FONT}`;
        ctx.fillText('guess-the-language-chi.vercel.app', cx, 1275);

        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) return;
        const file = new File([blob], 'guess-the-language.png', { type: 'image/png' });
        // Native share sheet (mobile / where allowed) — best experience when available.
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: t('shareResult') }); return; } catch (_) { /* fall through */ }
        }
        // Inside Discord the iframe blocks clipboard writes AND downloads, so neither
        // "copy image" nor "download" can work. The only reliable path is a real
        // https URL we can hand to the Discord SDK (openExternalLink / shareLink), so
        // upload the card to public storage first.
        let publicUrl = null;
        try { publicUrl = await uploadShareCard(blob); } catch (_) { publicUrl = null; }
        showShareOverlay(URL.createObjectURL(blob), blob, publicUrl);
    } catch (e) { console.warn('share card failed:', e); if (typeof logError === 'function') logError('share card: ' + e, { source: 'shareResultCard' }); }
}

// Upload a share-card PNG to the public `share-cards` bucket and return its public
// URL (or null on failure). Inside Discord the request is transparently proxied via
// the /supabase URL mapping; the returned URL uses the real host so it opens in the
// player's browser / embeds in a Discord message.
async function uploadShareCard(blob) {
    if (!supabaseConfigured() || !blob) return null;
    const c = window.SUPABASE_CONFIG;
    const name = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const res = await fetch(`${c.url}/storage/v1/object/share-cards/${name}`, {
        method: 'POST',
        headers: { apikey: c.anonKey, Authorization: `Bearer ${c.anonKey}`, 'Content-Type': 'image/png' },
        body: blob
    });
    if (!res.ok) return null;
    return `${c.url}/storage/v1/object/public/share-cards/${name}`;
}

// Overlay presenting the generated card. Actions adapt to the context: inside
// Discord (clipboard + downloads blocked) it offers open-in-browser / share-to-
// Discord / copy-link against the uploaded `publicUrl`; on web it offers the direct
// copy-image / download that actually work there.
function showShareOverlay(url, blob, publicUrl) {
    let el = document.getElementById('share-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'share-overlay';
        el.className = 'share-overlay';
        el.innerHTML =
            '<div class="share-card-box">' +
            '<img class="share-img" id="share-img" alt="" />' +
            '<div class="share-actions" id="share-actions"></div>' +
            '<p class="share-hint" id="share-hint"></p></div>';
        document.body.appendChild(el);
        el.addEventListener('click', (e) => { if (e.target === el) hideShareOverlay(); });
    }
    const hint = el.querySelector('#share-hint');
    const actions = el.querySelector('#share-actions');
    el.querySelector('#share-img').src = url;
    actions.innerHTML = '';

    const mkBtn = (label, cls, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${cls} btn-sm`;
        b.textContent = label;
        b.onclick = onClick;
        actions.appendChild(b);
        return b;
    };

    const inDiscord = isDiscordActivity();
    const da = window.DISCORD_ACTIVITY;

    if (inDiscord && publicUrl) {
        // Reliable inside the sandbox: hand the real https URL to the SDK.
        mkBtn(t('shareOpenImage'), 'btn-primary', () => { try { da.openExternal(publicUrl); } catch (_) {} });
        mkBtn(t('shareToDiscord'), 'btn-ghost', () => {
            try {
                const msg = `${safeDisplayName(getPlayerName()) || 'Player'} — ${state.score} pts • ${publicUrl}`;
                const p = da.shareLink ? da.shareLink(msg, null) : null;
                if (!p) da.openExternal(publicUrl);
            } catch (_) { try { da.openExternal(publicUrl); } catch (__) {} }
        });
        mkBtn(t('shareCopyLink'), 'btn-ghost', async () => {
            try { await navigator.clipboard.writeText(publicUrl); hint.textContent = t('shareLinkCopied2'); }
            catch (e) { hint.textContent = publicUrl; }
        });
        hint.textContent = t('shareDiscordHint');
    } else if (inDiscord) {
        // Upload failed — no https URL to hand off; the visible image is still saveable.
        hint.textContent = t('shareHint');
    } else {
        // Web / Electron: direct copy + download work here.
        mkBtn(`📋 ${t('copyImage')}`, 'btn-primary', async () => {
            try {
                if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('no-clipboard');
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                hint.textContent = t('copied');
            } catch (e) { hint.textContent = t('copyFailed'); }
        });
        mkBtn(`⬇ ${t('download')}`, 'btn-ghost', () => {
            try {
                const a = document.createElement('a');
                a.href = url; a.download = 'guess-the-language.png'; a.rel = 'noopener';
                document.body.appendChild(a); a.click(); a.remove();
                hint.textContent = t('downloadStarted');
            } catch (e) { try { window.open(url, '_blank'); } catch (_) {} hint.textContent = t('downloadBlocked'); }
        });
        hint.textContent = t('shareHint');
    }

    mkBtn(t('close'), 'btn-ghost', hideShareOverlay);
    el._url = url;
    el.classList.add('show');
}
function hideShareOverlay() {
    const el = document.getElementById('share-overlay');
    if (!el) return;
    el.classList.remove('show');
    if (el._url) { try { setTimeout(() => URL.revokeObjectURL(el._url), 3000); } catch (e) {} }
}

function renderAnswerReview(history) {
    const list = $('#answer-review-list');
    list.innerHTML = '';
    const incorrect = history.filter((item) => !item.correct);
    if (!incorrect.length) {
        const empty = document.createElement('p');
        empty.className = 'review-empty';
        empty.textContent = t('noIncorrect');
        list.appendChild(empty);
        return;
    }
    incorrect.forEach((item, index) => {
        const article = document.createElement('article');
        article.className = 'review-item';
        const title = document.createElement('h4');
        title.textContent = `${index + 1}. ${item.prompt || item.panelText}`;
        const code = document.createElement('pre');
        code.textContent = item.panelText || item.prompt || '';
        const answers = document.createElement('p');
        answers.textContent = `${t('yourAnswer')}: ${item.selectedAnswer || '—'} · ${t('correctAnswer')}: ${item.correctAnswer}`;
        const explanation = document.createElement('p');
        explanation.className = 'review-explanation';
        explanation.textContent = item.explanation?.[getLang()] || item.explanation?.en || '';
        article.append(title, code, answers, explanation);
        list.appendChild(article);
    });
}

function countUp(el, target, durationMs) {
    const start = performance.now();

    function frame(now) {
        const p = Math.min(1, (now - start) / durationMs);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ---------- Supabase REST leaderboard (optional, configured via window.SUPABASE_CONFIG) ----------
function supabaseConfigured() {
    const c = window.SUPABASE_CONFIG;
    return !!(c && c.url && c.anonKey);
}

async function sbFetch(pathQuery, options = {}) {
    const c = window.SUPABASE_CONFIG;
    const res = await fetch(`${c.url}/rest/v1/${pathQuery}`, {
        ...options,
        headers: {
            apikey: c.anonKey,
            Authorization: `Bearer ${c.anonKey}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    // Tolerate empty bodies: return=minimal inserts come back 201/204 with no body,
    // so res.json() would throw "Unexpected end of JSON input".
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ---------- Error logging to Supabase (best-effort; must NEVER throw) ----------
// Any runtime error — uncaught, unhandled rejection, or console.error — is written
// to the `error_logs` table so it can be inspected server-side later. Deduped and
// throttled so a repeating error can't flood the table.
let __cachedAppVersion = null;
const __errLogThrottle = new Map();

function logError(message, extra) {
    try {
        if (!supabaseConfigured()) return;
        const msg = String(message == null ? 'unknown error' : (message.message || message)).slice(0, 2000);
        if (!msg || msg === 'null' || msg === 'undefined') return;
        const ex = extra || {};
        const key = (ex.source || '') + '|' + msg.slice(0, 180);
        const now = Date.now();
        if (now - (__errLogThrottle.get(key) || 0) < 15000) return; // 1 per 15s per unique error
        __errLogThrottle.set(key, now);
        let platform = 'web';
        try { if (isDiscordActivity()) platform = 'discord'; else if (/electron/i.test(navigator.userAgent)) platform = 'electron'; } catch (_) {}
        const row = {
            level: ex.level || 'error',
            source: ex.source || 'manual',
            message: msg,
            stack: ex.stack ? String(ex.stack).slice(0, 8000) : null,
            app_version: __cachedAppVersion,
            platform,
            player: (() => { try { return getPlayerName() || null; } catch (_) { return null; } })(),
            url: (() => { try { return location.href; } catch (_) { return null; } })(),
            context: Object.assign({ mode: state && state.mode, ua: navigator.userAgent }, ex.context || {})
        };
        sbFetch('error_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([row]) }).catch(() => {});
    } catch (_) { /* logging must never break the app */ }
}
window.GTL_LOG_ERROR = logError;

let __errorLoggingInstalled = false;
function setupErrorLogging() {
    if (__errorLoggingInstalled) return;
    __errorLoggingInstalled = true;
    try { window.appWindow?.getVersion?.().then((v) => { __cachedAppVersion = v || null; }).catch(() => {}); } catch (_) {}
    window.addEventListener('error', (e) => {
        logError((e && (e.message || e.error)) || 'window error', {
            source: 'window.onerror',
            stack: e && e.error && e.error.stack,
            context: { filename: e && e.filename, lineno: e && e.lineno, colno: e && e.colno }
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r = e && e.reason;
        logError((r && (r.message || r)) || 'unhandled promise rejection', { source: 'unhandledrejection', stack: r && r.stack });
    });
    // Route console.error through the logger so caught-and-logged failures (exactly
    // the ones worth debugging) are captured too. logError never calls console.error,
    // so there is no recursion.
    const origErr = console.error.bind(console);
    console.error = function (...args) {
        origErr(...args);
        try { logError(args.map((a) => (a && a.stack) ? a.stack : String((a && a.message) ? a.message : a)).join(' '), { source: 'console.error' }); } catch (_) {}
    };
}

// Record a finished game into player_stats (games, multiplayer wins, seconds
// played, last activity). Best-effort — a failure must never affect gameplay.
function recordPlay(multiplayer, won, xp, perfect) {
    if (!supabaseConfigured()) { state.gameStartMs = null; return; }
    const seconds = state.gameStartMs ? Math.round((Date.now() - state.gameStartMs) / 1000) : 0;
    state.gameStartMs = null;
    const name = getPlayerName();
    if (!name) return;
    // record_progress also awards XP/level, updates the daily streak, and unlocks
    // achievements atomically, returning what was newly unlocked for a celebration.
    sbFetch('rpc/record_progress', {
        method: 'POST',
        body: JSON.stringify({
            p_player: name, p_seconds: seconds, p_multiplayer: !!multiplayer, p_won: !!won,
            p_xp: Math.max(0, Math.round(xp || 0)), p_perfect: !!perfect
        })
    }).then((res) => {
        const info = Array.isArray(res) ? res[0] : res;
        const unlocked = info && info.new_achievements;
        if (Array.isArray(unlocked) && unlocked.length) celebrateAchievements(unlocked);
    }).catch((e) => console.warn('record_progress failed:', e.message));
}

// True when the local player answered every question in the round correctly.
function isPerfectRound() {
    return state.round && state.round.length > 0 && state.correct === state.round.length;
}

// True when the local player has the (non-spectator) top score in the room.
function amIWinner() {
    const mp = window.GTL_MULTIPLAYER?.state;
    if (!mp || !Array.isArray(mp.players) || !mp.players.length) return false;
    const me = mp.players.find((p) => p.id === mp.playerId);
    if (!me || me.spectator) return false;
    const top = Math.max(...mp.players.filter((p) => !p.spectator).map((p) => p.score || 0));
    return top > 0 && me.score === top;
}

function submitScore(player, score, mode = state.mode, multiplayer = false) {
    return sbFetch('scores', {
        method: 'POST',
        headers: {
            Prefer: 'return=representation'
        },
        body: JSON.stringify([{
            player: safeDisplayName(player),
            score,
            mode,
            multiplayer,
            avatar: discordAvatarUrl(getDiscordProfile()) || null
        }])
    }).then((rows) => (Array.isArray(rows) ? rows[0] : null));
}

// Daily Challenge: submit today's score to the separate daily board. The unique
// (day,player) + resolution=ignore-duplicates means the FIRST score of the day
// stands and replays are silently ignored (no cheating a better result).
function submitDailyScore(player, score) {
    return sbFetch('daily_scores', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([{
            day: dailyDateKey(),
            player: safeDisplayName(player),
            score: Math.max(0, Math.round(score || 0)),
            avatar: discordAvatarUrl(getDiscordProfile()) || null
        }])
    });
}

async function fetchDailyTop(limit = 20) {
    const rows = await sbFetch(`daily_scores?select=id,player,score,avatar&day=eq.${dailyDateKey()}&order=score.desc&limit=${limit}`);
    return rows || [];
}

// Register every player's score from a finished multiplayer room in one insert,
// each flagged as a multiplayer result. return=minimal -> 204 (no body to parse).
function submitMpScores(rows) {
    if (!rows.length) return Promise.resolve(null);
    return sbFetch('scores', {
        method: 'POST',
        headers: {
            Prefer: 'return=minimal'
        },
        body: JSON.stringify(rows.map((row) => ({ ...row, player: safeDisplayName(row.player) })))
    });
}

// Which mode's leaderboard to show. Defaults to the play mode, but the leaderboard
// screen's own mode picker can point it elsewhere without leaving the screen.
function lbViewMode() {
    return (state.lbViewMode && MODES[state.lbViewMode]) ? state.lbViewMode : state.mode;
}

// Leaderboard time scope: all-time (default) or just the current week.
function lbScope() { return state.lbScope === 'week' ? 'week' : 'all'; }
// Start of the current week — Monday 00:00 UTC.
function weekStartIso() {
    const d = new Date();
    const backToMon = (d.getUTCDay() + 6) % 7; // 0 = Monday
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - backToMon)).toISOString();
}
// PostgREST filter fragment for the chosen scope (empty for all-time).
function lbScopeFilter() { return lbScope() === 'week' ? `&created_at=gte.${encodeURIComponent(weekStartIso())}` : ''; }

async function fetchTopScores(limit = 10) {
    // Pull a wide score-desc window, then keep only each player's single best row
    // so one person can't occupy several slots (deduped by case-insensitive name).
    const rows = await sbFetch(`scores?select=id,player,score,multiplayer,avatar&mode=eq.${encodeURIComponent(lbViewMode())}${lbScopeFilter()}&order=score.desc&limit=200`);
    const best = new Map();
    for (const r of rows || []) {
        const key = safeDisplayName(r.player).trim().toLowerCase();
        if (!best.has(key)) best.set(key, r); // score-desc → first seen is the best
    }
    return Array.from(best.values()).slice(0, limit);
}

async function fetchPersonalRank(score) {
    if (!supabaseConfigured() || score <= 0) return null;
    const c = window.SUPABASE_CONFIG;
    const url = `${c.url}/rest/v1/scores?select=id&mode=eq.${encodeURIComponent(lbViewMode())}${lbScopeFilter()}&score=gt.${score}`;
    const res = await fetch(url, {
        method: 'HEAD',
        headers: {
            apikey: c.anonKey,
            Authorization: `Bearer ${c.anonKey}`,
            Prefer: 'count=exact'
        }
    });
    if (!res.ok) return null;
    const range = res.headers.get('content-range') || '';
    const count = Number(range.split('/')[1]);
    return Number.isFinite(count) ? count + 1 : null;
}

const AVATARS = ['🧑🏽', '👩🏼', '🧑🏻', '👩🏻‍🦰', '🧔🏽', '👨🏾', '👩🏽‍🦱', '🧑🏼‍🎤', '👨🏻‍💻', '👩🏾‍💻'];

function avatarFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATARS[h % AVATARS.length];
}

// Per-player identity (color + icon) for multiplayer. The server assigns these
// at join time; these palettes are only a fallback for older rows.
const MP_FALLBACK_COLORS = ['#2ec5ff', '#19f0c4', '#ffd874', '#ff7a9c', '#b18cff',
    '#5fd0ff', '#25d07d', '#ff9f5a', '#f78fff', '#8cff6b', '#ff5470', '#74e0ff'
];
const MP_FALLBACK_ICONS = ['🦊', '🐼', '🦉', '🐙', '🦁', '🐯', '🐧', '🐸', '🦄', '🐢', '🦅', '🐲'];

function mpVisualOf(player) {
    const players = (window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state.players) || [];
    let idx = players.findIndex((p) => p.id === player.id);
    if (idx < 0) idx = 0;
    return {
        name: player.name,
        icon: player.icon || MP_FALLBACK_ICONS[idx % MP_FALLBACK_ICONS.length],
        color: player.color || MP_FALLBACK_COLORS[idx % MP_FALLBACK_COLORS.length]
    };
}

// Real Discord avatar for a room player, linking the room record to the live
// Activity identity. Returns a CDN URL or null (→ caller falls back to the emoji
// badge). The local player uses their own signed-in profile; everyone else is
// matched by the discord_user_id stored on their room_players row against the
// Activity's connected-participants list (they're all in the same voice channel).
// Room-leaderboard avatar: the real Discord photo when we can resolve it, else the
// player's assigned emoji icon, else a name-derived emoji. Passed to getRoomLeaderboard.
function mpRoomAvatarOf(player) {
    return mpDiscordAvatarUrl(player) || player.icon || avatarFor(player.name);
}
function mpDiscordAvatarUrl(player) {
    const da = window.DISCORD_ACTIVITY;
    if (!da) return null;
    const mp = window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state;
    if (mp && player.id === mp.playerId) {
        const own = discordAvatarUrl(getDiscordProfile());
        if (own) return own;
    }
    const did = player.discord_user_id;
    if (did && typeof da.participant === 'function') {
        const part = da.participant(did);
        if (part && part.avatar) return discordAvatarUrl({ id: part.id, avatar: part.avatar });
    }
    return null;
}

// The leaderboard-view mode picker is only meaningful when browsing the board
// (not on a real round's results, which must show the mode you just played).
function updateLbModeSwitch() {
    const wrap = $('#lb-mode-switch');
    if (!wrap) return;
    const show = state.viewOnly && supabaseConfigured();
    wrap.classList.toggle('hidden', !show);
    const sel = $('#lb-mode-select');
    if (sel) sel.value = lbViewMode();
}

// All-time / This-week toggle: shown on any real mode board (not the daily board).
function updateLbScopeSwitch() {
    const wrap = $('#lb-scope-switch');
    if (!wrap) return;
    wrap.classList.toggle('hidden', !(supabaseConfigured() && !state.daily));
    wrap.querySelectorAll('.lb-scope-btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.scope === lbScope());
    });
}

// The daily challenge shows its own board (today's daily_scores), not a mode board.
async function buildDailyLeaderboard() {
    const note = $('#lb-note');
    const playerName = getPlayerName();
    $('#lb-mode-switch')?.classList.add('hidden');
    $('#lb-scope-switch')?.classList.add('hidden');
    $('.results-sub').textContent = `${t('dailyChallenge')} · ${dailyDateKey()}`;

    if (!supabaseConfigured()) { note.className = 'lb-note'; note.textContent = ''; return; }
    note.className = 'lb-note';
    note.textContent = t('lbLoading');
    try {
        if (state.score > 0) { await submitDailyScore(playerName, state.score); markDailyDone(); }
        const top = await fetchDailyTop(20);
        const list = (top || []).map((r, index) => ({
            id: r.id, name: safeDisplayName(r.player),
            avatar: r.avatar || avatarFor(r.player), score: r.score, rank: index + 1, you: false
        }));
        const myKey = safeDisplayName(playerName).trim().toLowerCase();
        const myAvatarNow = discordAvatarUrl(getDiscordProfile());
        for (const p of list) {
            if (safeDisplayName(p.name).trim().toLowerCase() === myKey) {
                p.you = true;
                if (myAvatarNow) p.avatar = myAvatarNow;
                break;
            }
        }
        if (state.score > 0) {
            const mine = list.find((p) => p.you);
            const personal = $('#personal-result');
            personal.textContent = `${t('personalRank')}: ${mine ? `#${mine.rank}` : '—'} · ${state.score} pts`;
            personal.classList.remove('hidden');
        }
        renderLeaderboard(list);
        note.className = 'lb-note online';
        note.textContent = t('lbOnline');
    } catch (e) {
        console.error('Daily leaderboard error:', e);
        note.className = 'lb-note offline';
        note.textContent = t('lbOffline');
    }
}

async function buildResultsLeaderboard() {
    // Practice rounds aren't scored — no submit, no leaderboard.
    if (state.learn && !state.viewOnly) {
        $('#lb-mode-switch')?.classList.add('hidden');
        $('#lb-scope-switch')?.classList.add('hidden');
        $('#leaderboard').innerHTML = '';
        $('.results-sub').textContent = t('practiceRound');
        const note = $('#lb-note');
        note.className = 'lb-note';
        note.textContent = t('practiceNotSaved');
        return;
    }
    // Daily challenge results (played or just viewing today's board) use the daily board.
    if (state.daily) return buildDailyLeaderboard();
    // A real round's results always show the mode just played; only the standalone
    // leaderboard view lets you repoint the board to another mode.
    if (!state.viewOnly) state.lbViewMode = state.mode;
    updateLbModeSwitch();
    updateLbScopeSwitch();
    const note = $('#lb-note');
    const playerName = getPlayerName();

    if (supabaseConfigured()) {
        note.className = 'lb-note';
        note.textContent = t('lbLoading');
        try {
            // Only submit a real score; viewing scores (score 0) must not write a row.
            const me = state.score > 0 ? await submitScore(playerName, state.score) : null;
            const [top, personalRank] = await Promise.all([
                fetchTopScores(10),
                state.score > 0 ? fetchPersonalRank(state.score) : Promise.resolve(null)
            ]);
            const list = (top || []).map((r, index) => ({
                id: r.id,
                name: safeDisplayName(r.player),
                // Prefer the player's real profile photo; fall back to a
                // generated avatar when none was stored.
                avatar: r.avatar || avatarFor(r.player),
                score: r.score,
                multiplayer: !!r.multiplayer,
                rank: index + 1,
                you: false
            }));

            // Highlight the viewer's own entry even when just *browsing* the board
            // (no fresh score this session): match by case-insensitive display name.
            const myKey = safeDisplayName(playerName).trim().toLowerCase();
            if (myKey) {
                const myAvatarNow = discordAvatarUrl(getDiscordProfile());
                for (const p of list) {
                    if (safeDisplayName(p.name).trim().toLowerCase() === myKey) {
                        p.you = true;
                        if (myAvatarNow) p.avatar = myAvatarNow;
                        break;
                    }
                }
            }

            if (state.score > 0) {
                const myAvatar = discordAvatarUrl(getDiscordProfile()) || avatarFor(playerName);
                // Flag the player's row (already-flagged by name, else inserted id, else name+score).
                let mine = list.find((p) => p.you) || (me ? list.find((p) => p.id === me.id) : null);
                if (!mine) mine = list.find((p) => !p.you && p.name === playerName && p.score === state.score);
                if (mine) {
                    mine.you = true;
                    mine.avatar = myAvatar;
                } else list.push({
                    id: -1,
                    name: playerName,
                    avatar: myAvatar,
                    score: state.score,
                    rank: personalRank,
                    you: true
                });
            }

            if (state.score > 0) {
                const personal = $('#personal-result');
                personal.textContent = `${t('personalRank')}: ${personalRank ? `#${personalRank}` : '—'} · ${state.score} pts`;
                personal.classList.remove('hidden');
            }

            $('.results-sub').textContent = `${t('globalLeaderboard')} · ${modeLabel(lbViewMode())}`;
            renderLeaderboard(list);
            note.className = 'lb-note online';
            note.textContent = t('lbOnline');
            return;
        } catch (e) {
            console.error('Leaderboard error:', e);
            note.className = 'lb-note offline';
            note.textContent = t('lbOffline');
        }
    } else {
        note.className = 'lb-note';
        note.textContent = '';
    }

    // Offline / fallback: mock friends + the player.
    $('.results-sub').textContent = t('comparison');
    renderLeaderboard(FRIENDS.concat([{
        name: playerName,
        avatar: discordAvatarUrl(getDiscordProfile()) || '🧑‍💻',
        score: state.score,
        you: true
    }]));
}

function currentModeLabel() {
    const mode = MODES[state.mode] || MODES.languages;
    const lang = getLang();
    const title = mode.title?.[lang] || mode.title?.en || [];
    return Array.isArray(title) ? title.join(' ') : String(title || mode.key || '');
}

function renderLeaderboard(list) {
    const sorted = list.slice().sort((a, b) => b.score - a.score);
    let display = sorted.slice(0, 10);
    const youIdx = sorted.findIndex((p) => p.you);
    if (youIdx >= 10) {
        display = sorted.slice(0, 9);
        display.push(sorted[youIdx]);
    }
    const max = Math.max(...sorted.map((p) => p.score), 1);

    const lb = $('#leaderboard');
    lb.innerHTML = '';
    display.forEach((p, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
        const placementBadge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        const row = document.createElement('div');
        row.className = `lb-row ${rankClass}${p.you ? ' is-you' : ''}`;
        // Place number (1, 2, 3, …) shown at the start of every row.
        const rank = document.createElement('div');
        rank.className = 'lb-rank';
        rank.textContent = String(p.rank || i + 1);
        row.appendChild(rank);
        const label = document.createElement('div');
        label.className = 'lb-bar-fill';
        const displayName = safeDisplayName(p.name);
        label.textContent = `${displayName}${placementBadge ? ` ${placementBadge}` : ''} — ${p.score} pts`;
        if (p.multiplayer) {
            const mpTag = document.createElement('span');
            mpTag.className = 'lb-mp-tag';
            mpTag.textContent = ' 👥';
            mpTag.title = t('multiplayerScore');
            label.appendChild(mpTag);
        }
        if (p.you) {
            const tag = document.createElement('span');
            tag.className = 'lb-tag';
            tag.textContent = ' ' + t('you');
            label.appendChild(tag);
        }
        const wrap = document.createElement('div');
        wrap.className = 'lb-bar-wrap';
        const bg = document.createElement('div');
        bg.className = 'lb-bar-bg';
        wrap.appendChild(bg);
        wrap.appendChild(label);
        const avatar = document.createElement('div');
        avatar.className = 'lb-avatar';
        // A real Discord avatar URL renders as an image; anything else is emoji.
        if (typeof p.avatar === 'string' && /^https?:\/\//.test(p.avatar)) {
            const img = document.createElement('img');
            img.className = 'lb-avatar-img';
            img.src = p.avatar;
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            avatar.appendChild(img);
        } else {
            avatar.textContent = p.avatar;
        }
        if (p.color) {
            avatar.style.background = p.color + '22';
            avatar.style.borderColor = p.color;
        }
        row.appendChild(avatar);
        row.appendChild(wrap);
        row.setAttribute('role', 'listitem');
        row.setAttribute('aria-label', `${t('personalRank')} ${p.rank || i + 1}, ${displayName}, ${p.score} points${p.multiplayer ? `, ${t('multiplayerScore')}` : ''}`);
        if (supabaseConfigured() && !p.you && Number(p.id) > 0 && getAppSessionToken()) {
            const report = document.createElement('button');
            report.className = 'lb-report text-btn';
            report.type = 'button';
            report.textContent = t('report');
            report.addEventListener('click', (ev) => { ev.stopPropagation(); openReportDialog(p); });
            row.appendChild(report);
        }

        // Click a leaderboard row to open that player's profile (rank per mode).
        // Only meaningful online, where there are real ranked scores to show.
        if (supabaseConfigured()) {
            row.classList.add('is-clickable');
            row.tabIndex = 0;
            row.title = `${displayName} — ${t('openPlayerCard')}`;
            const open = (ev) => {
                if (ev.target.closest && ev.target.closest('.lb-report')) return;
                openProfileCard(p);
            };
            row.addEventListener('click', open);
            row.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                ev.preventDefault();
                openProfileCard(p);
            });
        }
        lb.appendChild(row);

        // Animate width. A 30% baseline keeps every bar wide enough for its label.
        const pct = 30 + 70 * (p.score / max);
        requestAnimationFrame(() => {
            setTimeout(() => {
                label.style.width = `${pct}%`;
            }, 60 + i * 120);
        });
    });
}

let reportTarget = null;

function openReportDialog(player) {
    reportTarget = player;
    $('#report-reason').value = 'offensive_name';
    $('#report-details').value = '';
    $('#report-error').classList.add('hidden');
    openDialog($('#report-dialog'), $('#report-reason'));
}

async function submitLeaderboardReport() {
    const profile = getDiscordProfile();
    const token = getAppSessionToken();
    if (!reportTarget?.id || !profile?.id || !token || !supabaseConfigured()) return;
    const reason = $('#report-reason').value;
    const details = $('#report-details').value.trim().slice(0, 250);
    const allowed = ['offensive_name', 'impersonation', 'spam_other'];
    if (!allowed.includes(reason)) return;
    const button = $('#report-submit');
    button.disabled = true;
    $('#report-error').classList.add('hidden');
    try {
        const response = await fetch(`${appApiPrefix()}/api/report`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                score_id: reportTarget.id,
                reason,
                details: details || null
            })
        });
        if (!response.ok) throw new Error(`Report ${response.status}: ${await response.text()}`);
        closeDialog($('#report-dialog'));
        $('#lb-note').textContent = t('reportSuccess');
        announce(t('reportSuccess'));
    } catch (error) {
        const duplicate = /409|23505|duplicate/i.test(String(error));
        const message = duplicate ? t('reportDuplicate') : t('reportFailed');
        const box = $('#report-error');
        box.textContent = message;
        box.classList.remove('hidden');
        announce(message);
    } finally {
        button.disabled = false;
    }
}

// Encode the current mode + settings + score into a compact custom_id (max 64
// chars) that rides along a Discord challenge deep link. Example:
// "m=gamedev&d=hard&q=10&s=570".
function buildChallengePayload() {
    return [
        `m=${state.mode}`,
        `d=${getSettings().difficulty}`,
        `q=${getSettings().questions}`,
        `s=${Math.max(0, state.score | 0)}`
    ].join('&');
}

// Parse a challenge custom_id back into { mode, difficulty, questions, score }.
// Returns null when the string carries no usable challenge.
function parseChallengePayload(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const out = {};
    raw.split('&').forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k && v != null) out[k] = v;
    });
    const mode = MODES[out.m] ? out.m : null;
    const questions = [5, 10, 15, 20].includes(Number(out.q)) ? Number(out.q) : null;
    const difficulty = ['all', 'easy', 'medium', 'hard'].includes(out.d) ? out.d : null;
    const score = Number.isFinite(Number(out.s)) ? Math.max(0, Number(out.s) | 0) : null;
    if (!mode && score == null) return null;
    return { mode, questions, difficulty, score };
}

// Read a challenge off the web URL (?challenge=<payload>) — the link a shared
// "Challenge a friend" produces on the plain web build.
function getChallengeFromUrl() {
    try {
        const p = new URLSearchParams(location.search).get('challenge');
        return p ? parseChallengePayload(decodeURIComponent(p)) : null;
    } catch {
        return null;
    }
}

// A challenged friend launches with these preset — mirror the challenger's mode
// and settings and remember the score to beat.
function applyChallengeSettings(info) {
    if (info.mode) {
        state.mode = info.mode;
        localStorage.setItem('gtl_mode', info.mode);
    }
    const cur = getSettings();
    if (info.difficulty) cur.difficulty = info.difficulty;
    if (info.questions) cur.questions = info.questions;
    store.settings = cur;
    // Remember the score + mode to beat so we can grade the round afterwards and
    // clear the challenge cleanly if the player wanders off to another mode.
    state.challenge = { score: info.score != null ? info.score : 0, mode: info.mode || state.mode };
    state.challengeTarget = info.score;
}

function hideChallengeBanner() {
    state.challenge = null;
    $('#challenge-banner')?.classList.add('hidden');
}

// On the results screen, if this round was played against a friend's challenge,
// show a "beaten / not beaten" verdict and turn the challenge button into a
// "challenge them back" action. A no-op (and label reset) for normal rounds.
function renderChallengeVerdict(viewOnly) {
    const el = $('#challenge-result');
    const btn = $('#btn-challenge');
    const isChallenge = !viewOnly && !!state.challenge && !state.multiplayer && !state.learn
        && !state.daily && state.mode === state.challenge.mode;
    if (!isChallenge) {
        el?.classList.add('hidden');
        if (btn) btn.textContent = t('challenge');
        return;
    }
    const target = Math.max(0, state.challenge.score | 0);
    const won = state.score > target;
    if (el) {
        el.classList.remove('hidden');
        el.classList.toggle('won', won);
        el.classList.toggle('lost', !won);
        el.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'cr-headline';
        h.textContent = won ? t('challengeWon') : t('challengeLost');
        const p = document.createElement('div');
        p.className = 'cr-sub';
        p.textContent = (won ? t('challengeWonSub') : t('challengeLostSub'))
            .replace('{you}', String(state.score))
            .replace('{target}', String(target));
        el.appendChild(h);
        el.appendChild(p);
    }
    if (btn) btn.textContent = t('challengeBack');
}

function challengeBannerText(info) {
    const modeName = modeLabel(info.mode || state.mode);
    const score = info.score != null ? info.score : 0;
    return getLang() === 'ar'
        ? `🎯 لقد تم تحدّيك! تجاوز ${score} نقطة في وضع «${modeName}».`
        : `🎯 You've been challenged! Beat ${score} points in ${modeName} mode.`;
}

function showChallengeBanner(info) {
    const el = $('#challenge-banner');
    if (!el || !info) return;
    el.innerHTML = '';
    const msg = document.createElement('span');
    msg.className = 'challenge-banner-text';
    msg.textContent = challengeBannerText(info);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'challenge-banner-x';
    x.setAttribute('aria-label', t('challengeDismiss'));
    x.textContent = '✕';
    x.addEventListener('click', hideChallengeBanner);
    el.appendChild(msg);
    el.appendChild(x);
    el.classList.remove('hidden');
}

// Public web address of the game. On the plain web build that's the current
// origin; inside Discord/Electron the origin is a proxy/file, so fall back to
// the deployed site so the shared link is always playable in a browser.
// ---------- Link out to the SolidJS rewrite ----------
// Its own deployment, sharing this game's Supabase data and Discord app.
const NEW_VERSION_URL = 'https://guess-the-language-chi.vercel.app/v2/';

// The SolidJS rewrite ships inside THIS deployment at /v2/, so it needs no Discord
// URL mapping — same origin everywhere. Carrying location.search over hands it
// frame_id / instance_id, so inside Discord it boots as a REAL Activity (SDK
// handshake, voice-channel room, presence) rather than a plain page in the iframe.
function openNewVersion() {
    if (isDiscordEmbedded()) {
        const base = location.pathname.startsWith('/.proxy') ? '/.proxy/v2/' : '/v2/';
        location.href = base + location.search;
        return;
    }
    // Web build: /v2/ is served from this same origin.
    if (document.documentElement.classList.contains('platform-web')) {
        location.href = '/v2/';
        return;
    }
    // Electron ships no copy of the rewrite, so open the public site instead.
    openExternalUrl(NEW_VERSION_URL);
}

const GAME_PUBLIC_URL = 'https://guess-the-language-chi.vercel.app/';
function gameShareBaseUrl() {
    if (document.documentElement.classList.contains('platform-web')) {
        return (location.origin + location.pathname).replace(/index\.html?$/i, '');
    }
    return GAME_PUBLIC_URL;
}

// A shareable link that opens the game preloaded with this challenge (same mode
// & settings, plus the score to beat).
function buildChallengeUrl() {
    const base = gameShareBaseUrl().replace(/\/+$/, '/');
    return `${base}?challenge=${encodeURIComponent(buildChallengePayload())}`;
}

// Reveal the challenge link on the results screen as selectable text so the
// player can grab it even if the clipboard copy is blocked.
function showChallengeLink(url) {
    const el = $('#challenge-link');
    if (!el) return;
    el.value = url;
    el.classList.remove('hidden');
    el.focus();
    el.select();
}

function challengeFriend() {
    const url = buildChallengeUrl();
    const da = window.DISCORD_ACTIVITY;
    // Inside a Discord Activity, open the native share sheet so the player can
    // DM the challenge (score + settings + link) straight to a friend.
    if (isDiscordActivity() && da && typeof da.shareLink === 'function') {
        const msg = `${challengeText(state.score)}\n${url}`;
        const p = da.shareLink(msg, buildChallengePayload());
        if (p && typeof p.then === 'function') {
            showChallengeLink(url);
            p.then(
                (res) => {
                    if (res && (res.didSendMessage || res.didCopyLink)) {
                        flashButton('#btn-challenge', t('challengeSent'));
                    }
                },
                (err) => {
                    console.error('shareLink failed:', err);
                    flashButton('#btn-challenge', t('challengeFailed'));
                }
            );
            return;
        }
    }
    // Web / Electron: copy the link to the clipboard and show it on screen.
    showChallengeLink(url);
    navigator.clipboard ?.writeText(url).then(
        () => flashButton('#btn-challenge', t('challengeLinkCopied')),
        () => {}
    );
}

function flashButton(sel, msg) {
    const b = $(sel);
    const old = b.innerHTML;
    b.innerHTML = msg;
    setTimeout(() => {
        b.innerHTML = old;
    }, 1600);
}

// ============================================================
//  Discord rich presence + player card
// ============================================================
// Two views onto the same facts — "which round, what score, which mode, and can
// I join?":
//   * Discord's profile card, published with setActivity() (details / state /
//     party size / join secret). This is what a member sees after clicking the
//     player in Discord.
//   * The in-app player card, opened by clicking a row in the lobby / in-game
//     player list.

// The "of N" in Discord's party badge must match the Activity's real capacity:
// Developer Portal -> Activities -> Settings -> "Maximum Participants", set to 12
// to match the 12-slot colour/icon palette the server assigns players from
// (_player_color / _player_icon in schema-multiplayer.sql) — past 12 players start
// sharing an identity, so that is the game's real ceiling. Changing it in the
// portal means changing it here, or overriding in discord-config.js. Note this
// caps the Activity only — a code-joined web room can exceed it, which is why the
// badge grows to fit the actual player count below.
const MP_PARTY_MAX = Number(window.DISCORD_CONFIG?.maxParticipants) || 12;

// Rich Presence art asset key (Developer Portal -> Rich Presence -> Art Assets).
// Gives the profile card the game's image instead of just the app icon; an
// unknown key simply renders no image, so a stale value is harmless.
const PRESENCE_IMAGE = window.DISCORD_CONFIG?.presenceImage || '8-modeselect';

// Wall-clock start of the current round, so Discord can show an elapsed timer.
// Must stay stable while the round runs — a moving value would defeat the
// payload de-duplication in discord-activity.js.
let presenceStartedAt = 0;

function canPublishPresence() {
    return Boolean(window.DISCORD_ACTIVITY?.canSetActivity);
}

function presenceEnabled() {
    return canPublishPresence() && getSettings().discordPresence !== false;
}

// Room-wide question counter. `rooms.question_index` is 0-based and shared by
// everyone in the room, so this is the round every player is on.
function mpRoundInfo() {
    const room = window.GTL_MULTIPLAYER?.state?.room || null;
    const total = (room?.round_refs || []).length;
    if (!room || !total) return { room, total, current: 0 };
    return { room, total, current: Math.min((room.question_index || 0) + 1, total) };
}

function presenceScoreLine(score) {
    return `${t('playerCardScore')} ${score}`;
}

// The payload behind the profile card, or null to publish nothing.
function buildPresenceActivity() {
    if (!presenceEnabled()) return null;

    const onGame = screens.game.classList.contains('active');
    const onResults = screens.results.classList.contains('active');
    const activity = { type: 0, instance: true };
    if (presenceStartedAt) activity.timestamps = { start: Math.floor(presenceStartedAt / 1000) };
    // Hover text on the card image names the mode the player is on.
    const shownMode = modeLabel(
        (state.multiplayer && window.GTL_MULTIPLAYER.state.room?.mode) || state.mode
    );
    if (PRESENCE_IMAGE) {
        activity.assets = { large_image: PRESENCE_IMAGE, large_text: shownMode };
    }

    if (state.multiplayer) {
        const mp = window.GTL_MULTIPLAYER.state;
        const room = mp.room;
        const players = mp.players || [];
        const active = players.filter((p) => !p.spectator).length;
        const { total, current } = mpRoundInfo();

        activity.details = `${shownMode} • ${t('presenceRoom')}`;
        if (room?.status === 'finished' || onResults) {
            activity.state = `${t('presenceResults')} • ${presenceScoreLine(state.score)}`;
        } else if (room?.status === 'playing' && onGame && total) {
            activity.state = state.spectator
                ? `${t('presenceSpectating')} • ${t('playerCardRound')} ${current}/${total}`
                : `${t('playerCardRound')} ${current}/${total} • ${presenceScoreLine(state.score)}`;
        } else {
            activity.state = t('presenceLobby');
        }

        // `party` is what makes Discord render the "(2 of 12)" badge; the id must be
        // identical for everyone in the room so the badge counts the group rather
        // than each player separately. `secrets.join` is what adds "Ask to Join".
        if (room?.id) {
            activity.party = {
                id: `gtl-room-${room.id}`,
                size: [Math.max(active, 1), Math.max(active, MP_PARTY_MAX)]
            };
            if (room.code) activity.secrets = { join: `room:${room.code}` };
        }
        return activity;
    }

    activity.details = `${shownMode} • ${t('presenceSolo')}`;
    if (onResults) {
        activity.state = `${t('presenceResults')} • ${presenceScoreLine(state.score)}`;
    } else if (onGame) {
        const total = state.round.length;
        activity.state = total
            ? `${t('playerCardRound')} ${Math.min(state.index + 1, total)}/${total} • ${presenceScoreLine(state.score)}`
            : presenceScoreLine(state.score);
    } else {
        activity.state = t('presenceMenu');
    }
    // A solo player has no room to hand out, so no join secret — but others in the
    // voice channel can still launch into the Activity, so keep the party badge.
    const instanceId = window.DISCORD_ACTIVITY?.instanceId;
    if (instanceId) activity.party = { id: `gtl-solo-${instanceId}`, size: [1, MP_PARTY_MAX] };
    return activity;
}

// Refresh the profile card. Safe (and cheap) to call on every state change —
// discord-activity.js coalesces these to respect Discord's rate limit.
function pushPresence() {
    if (!canPublishPresence()) return;
    const activity = buildPresenceActivity();
    if (activity) window.DISCORD_ACTIVITY.setActivity(activity);
    else window.DISCORD_ACTIVITY.clearActivity();
}

function markPresenceRoundStart() {
    presenceStartedAt = Date.now();
    pushPresence();
}

// ============================================================
//  Live presence heartbeat (feeds the admin "who's playing now" view)
// ============================================================
function currentPlatform() {
    try {
        if (isDiscordActivity()) return 'discord';
        if (/electron/i.test(navigator.userAgent)) return 'electron';
    } catch (_) {}
    return 'web';
}
function currentActivity() {
    const s = state.currentScreen;
    if (s === 'game') return 'playing';
    if (s === 'lobby' || (window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state && window.GTL_MULTIPLAYER.state.room)) return 'lobby';
    return 'home';
}
// Best-effort presence ping. Silent on failure — never affects gameplay.
function sendHeartbeat() {
    try {
        if (!supabaseConfigured()) return;
        const name = getPlayerName();
        if (!name) return;
        if (document.hidden) return;
        const prof = getDiscordProfile();
        sbFetch('rpc/heartbeat', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
                p_player: name,
                p_discord_id: (prof && prof.id) || null,
                p_guild_id: (window.DISCORD_ACTIVITY && window.DISCORD_ACTIVITY.guildId) || null,
                p_channel_id: (window.DISCORD_ACTIVITY && window.DISCORD_ACTIVITY.channelId) || null,
                p_mode: state.mode || null,
                p_activity: currentActivity(),
                p_platform: currentPlatform()
            })
        }).catch(() => {});
    } catch (_) {}
}
let __heartbeatTimer = null;
function startHeartbeat() {
    if (__heartbeatTimer) return;
    sendHeartbeat();
    __heartbeatTimer = setInterval(sendHeartbeat, 25000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sendHeartbeat(); });
}

// ============================================================
//  Admin panel — gated by a signed `adm` claim in the session token
// ============================================================
function b64urlDecode(str) {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return atob(s);
}
// Read (not verify — the server verifies) the session token's claims so the UI can
// decide whether to show the admin entry point. Real enforcement is server-side.
function sessionClaims() {
    try {
        const tok = getAppSessionToken();
        if (!tok) return null;
        return JSON.parse(b64urlDecode(tok.split('.')[0]));
    } catch (_) { return null; }
}
function isAdmin() {
    const c = sessionClaims();
    return !!(c && c.adm);
}

async function adminApi(action, extra) {
    const token = getAppSessionToken();
    if (!token) throw new Error('no session');
    const res = await fetch(`${appApiPrefix()}/api/admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action }, extra || {}))
    });
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!res.ok) throw new Error((data && data.error) || `admin ${res.status}`);
    return data;
}

function updateAdminButton() {
    const btn = $('#btn-admin');
    if (btn) btn.classList.toggle('hidden', !isAdmin());
}

let __adminTab = 'reports';
function openAdminPanel() {
    if (!isAdmin()) return;
    $('#admin-modal').classList.remove('hidden');
    $('#admin-title').textContent = t('adminTitle');
    renderAdminTabs();
    loadAdminTab(__adminTab);
}
function closeAdminPanel() { $('#admin-modal').classList.add('hidden'); }

function renderAdminTabs() {
    const wrap = $('#admin-tabs');
    if (!wrap) return;
    const tabs = [
        ['reports', t('adminReports')],
        ['users', t('adminUsers')],
        ['live', t('adminLive')],
        ['bans', t('adminBans')]
    ];
    wrap.innerHTML = '';
    tabs.forEach(([key, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'admin-tab' + (key === __adminTab ? ' is-active' : '');
        b.textContent = label;
        b.onclick = () => loadAdminTab(key);
        wrap.appendChild(b);
    });
}

async function loadAdminTab(tab) {
    __adminTab = tab;
    renderAdminTabs();
    const body = $('#admin-body');
    body.innerHTML = `<p class="admin-msg">${t('adminLoading')}</p>`;
    try {
        if (tab === 'reports') return renderAdminReports(await adminApi('reports'));
        if (tab === 'users') return renderAdminUsers();
        if (tab === 'live') return renderAdminLive(await adminApi('live'));
        if (tab === 'bans') return renderAdminBans(await adminApi('banned'));
    } catch (e) {
        body.innerHTML = `<p class="admin-msg admin-err">${t('adminError')}</p>`;
    }
}

// A destructive button that must be clicked twice: the first click arms it
// (shows "Confirm?"), the second within 3.5s runs the action. Works everywhere,
// unlike window.confirm() which Discord's iframe can suppress.
function armButton(btn, run) {
    if (btn.dataset.armed === '1') { run(); return; }
    const original = btn.textContent;
    btn.dataset.armed = '1';
    btn.textContent = t('adminConfirm');
    btn.classList.add('is-armed');
    const reset = () => { btn.dataset.armed = ''; btn.textContent = original; btn.classList.remove('is-armed'); };
    btn._armReset = reset;
    setTimeout(() => { if (btn.dataset.armed === '1') reset(); }, 3500);
}

function adminActionBtn(label, cls, handler, danger) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-act ' + cls;
    b.textContent = label;
    b.onclick = () => {
        if (danger) {
            armButton(b, async () => { await runAdmin(b, handler); });
        } else {
            runAdmin(b, handler);
        }
    };
    return b;
}

async function runAdmin(btn, handler) {
    btn.disabled = true;
    try {
        await handler();
        btn.textContent = t('adminDone');
        setTimeout(() => loadAdminTab(__adminTab), 500);
    } catch (e) {
        btn.disabled = false;
        if (btn._armReset) btn._armReset();
        btn.textContent = t('adminError');
    }
}

function renderAdminReports(data) {
    const body = $('#admin-body');
    const reports = (data && data.reports) || [];
    if (!reports.length) { body.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
    body.innerHTML = '';
    reports.forEach((r) => {
        const card = document.createElement('div');
        card.className = 'admin-row admin-report status-' + (r.status || 'open');
        const who = r.score ? safeDisplayName(r.score.player) : ('#' + r.score_id);
        const meta = r.score ? `${r.score.score} · ${modeLabel(r.score.mode)}` : '';
        const head = document.createElement('div');
        head.className = 'admin-row-main';
        head.innerHTML = `<div class="admin-row-name">${escapeHtml(who)} <span class="admin-badge">${r.status || 'open'}</span></div>` +
            `<div class="admin-row-sub">${escapeHtml(meta)} · ${escapeHtml(r.reason || '')}${r.details ? ' — ' + escapeHtml(r.details) : ''}</div>`;
        card.appendChild(head);
        const acts = document.createElement('div');
        acts.className = 'admin-row-acts';
        if (r.score) {
            acts.appendChild(adminActionBtn(t('adminDeleteScore'), 'danger', () => adminApi('delete_score', { id: r.score_id }), true));
            acts.appendChild(adminActionBtn(t('adminBan'), 'danger', () => adminApi('ban', { player: r.score.player, reason: r.reason }), true));
        }
        if (r.status === 'open') {
            acts.appendChild(adminActionBtn(t('adminResolve'), 'ghost', () => adminApi('resolve_report', { id: r.id, status: 'resolved' })));
            acts.appendChild(adminActionBtn(t('adminDismiss'), 'ghost', () => adminApi('resolve_report', { id: r.id, status: 'dismissed' })));
        }
        card.appendChild(acts);
        body.appendChild(card);
    });
}

function renderAdminUsers(preload) {
    const body = $('#admin-body');
    body.innerHTML = `<div class="admin-search"><input type="text" id="admin-user-search" placeholder="${t('adminSearch')}" /></div><div id="admin-user-list"></div>`;
    const input = $('#admin-user-search');
    let timer = null;
    const run = async () => {
        const list = $('#admin-user-list');
        list.innerHTML = `<p class="admin-msg">${t('adminLoading')}</p>`;
        try {
            const data = await adminApi('users', { search: input.value.trim() });
            const users = (data && data.users) || [];
            if (!users.length) { list.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
            list.innerHTML = '';
            users.forEach((u) => {
                const row = document.createElement('div');
                row.className = 'admin-row';
                const seen = u.last_seen ? timeAgo(u.last_seen) : '';
                row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name">${escapeHtml(safeDisplayName(u.player))}${u.banned ? ' <span class="admin-badge ban">ban</span>' : ''}</div>` +
                    `<div class="admin-row-sub">Lv ${u.level || 1} · ${u.games || 0} games · 🔥${u.day_streak || 0} · ${escapeHtml(seen)}</div></div>`;
                const acts = document.createElement('div');
                acts.className = 'admin-row-acts';
                acts.appendChild(adminActionBtn(t('adminReset'), 'danger', () => adminApi('reset_profile', { player: u.player }), true));
                if (u.banned) acts.appendChild(adminActionBtn(t('adminUnban'), 'ghost', () => adminApi('unban', { player: u.player })));
                else acts.appendChild(adminActionBtn(t('adminBan'), 'danger', () => adminApi('ban', { player: u.player, reason: 'admin' }), true));
                row.appendChild(acts);
                list.appendChild(row);
            });
        } catch (e) {
            list.innerHTML = `<p class="admin-msg admin-err">${t('adminError')}</p>`;
        }
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 300); });
    run();
}

function renderAdminLive(data) {
    const body = $('#admin-body');
    const live = (data && data.live) || [];
    if (!live.length) { body.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
    body.innerHTML = '';
    const actLabel = { home: t('adminActivityHome'), lobby: t('adminActivityLobby'), playing: t('adminActivityPlaying') };
    live.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        const server = p.guild_id ? `${t('adminServer')}: ${escapeHtml(p.guild_id)}` : t('adminNoServer');
        row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name">${escapeHtml(safeDisplayName(p.player))} <span class="admin-badge live">${escapeHtml(actLabel[p.activity] || p.activity || '')}</span></div>` +
            `<div class="admin-row-sub">${escapeHtml(modeLabel(p.mode || ''))} · ${escapeHtml(p.platform || '')} · ${server} · ${escapeHtml(timeAgo(p.updated_at))}</div></div>`;
        const acts = document.createElement('div');
        acts.className = 'admin-row-acts';
        acts.appendChild(adminActionBtn(t('adminBan'), 'danger', () => adminApi('ban', { player: p.player, reason: 'admin' }), true));
        row.appendChild(acts);
        body.appendChild(row);
    });
}

function renderAdminBans(data) {
    const body = $('#admin-body');
    const banned = (data && data.banned) || [];
    if (!banned.length) { body.innerHTML = `<p class="admin-msg">${t('adminEmpty')}</p>`; return; }
    body.innerHTML = '';
    banned.forEach((b) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        row.innerHTML = `<div class="admin-row-main"><div class="admin-row-name">${escapeHtml(b.player)}</div>` +
            `<div class="admin-row-sub">${escapeHtml(b.reason || '')} · ${t('adminBannedBy')} ${escapeHtml(b.banned_by || '')} · ${escapeHtml(timeAgo(b.created_at))}</div></div>`;
        const acts = document.createElement('div');
        acts.className = 'admin-row-acts';
        acts.appendChild(adminActionBtn(t('adminUnban'), 'ghost', () => adminApi('unban', { player: b.player })));
        row.appendChild(acts);
        body.appendChild(row);
    });
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function timeAgo(iso) {
    try {
        const then = new Date(iso).getTime();
        const s = Math.max(0, Math.round((Date.now() - then) / 1000));
        if (s < 60) return `${s}s`;
        if (s < 3600) return `${Math.round(s / 60)}m`;
        if (s < 86400) return `${Math.round(s / 3600)}h`;
        return `${Math.round(s / 86400)}d`;
    } catch (_) { return ''; }
}

// A member pressed "Ask to Join" on someone's profile card: Discord launches the
// Activity for them and hands over the secret we published. If the voice-channel
// auto-join already landed them in that room there is nothing to do; otherwise
// join it by code.
async function handleDiscordActivityJoin(secret) {
    const match = /^room:([A-Za-z0-9]{4})$/.exec(String(secret || ''));
    if (!match) return;
    const code = match[1].toUpperCase();
    const mp = window.GTL_MULTIPLAYER?.state;
    if (mp?.room?.code === code) return;
    if (!mpOnline()) return;

    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinRoom(code, getPlayerName());
        state.multiplayer = true;
        state.viewOnly = false;
        state.mpSyncKey = '';
        const joined = window.GTL_MULTIPLAYER.state;
        renderLobby(joined.room, joined.players);
        showScreen('lobby');
        pushPresence();
    } catch (err) {
        // Rooms already in progress reject a join-by-code; the player is normally
        // in via the voice instance anyway, so just tell them.
        console.error('Ask-to-Join failed:', err);
        announce(err.message || t('joinRequestFailed'));
    }
}

// ---------- In-app player card ----------

// room_players.id of the player whose card is open, so live score/round updates
// can refresh it in place.
let playerCardId = null;

// The freshest row for a player id — list row closures outlive a re-render.
function currentPlayerRow(playerId) {
    return (window.GTL_MULTIPLAYER?.state?.players || []).find((p) => p.id === playerId) || null;
}

// Status of one room_players row, as a localized label.
function playerStatusLabel(player, room) {
    if (room?.status === 'finished') return t('statusFinished');
    if (player.spectator) return t('statusSpectating');
    if (room?.status === 'playing') return t('statusPlaying');
    return t('statusLobby');
}

function setPlayerCardRow(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value;
}

// Clicking a row in #lobby-players / #mp-game-players lands here.
// Admin controls on ANY player card (leaderboard profile, lobby, in-game). Shown
// only to admins and never for your own card. Ban / full-reset, with a click-twice
// confirm; on success the card closes and a visible leaderboard refreshes.
function cardAdminBtn(label, handler) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-act danger';
    b.textContent = label;
    b.onclick = () => armButton(b, async () => {
        b.disabled = true;
        try {
            await handler();
            b.textContent = t('adminDone');
            setTimeout(() => {
                closePlayerCard();
                if (state.currentScreen === 'results' && typeof buildResultsLeaderboard === 'function') buildResultsLeaderboard();
            }, 500);
        } catch (e) {
            b.disabled = false;
            if (b._armReset) b._armReset();
            b.textContent = t('adminError');
        }
    });
    return b;
}
function renderCardAdminControls(name, isYou) {
    const box = $('#player-card-admin');
    if (!box) return;
    const who = safeDisplayName(name);
    if (!isAdmin() || isYou || !who) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'pca-label';
    label.textContent = t('adminButton');
    box.appendChild(label);
    box.appendChild(cardAdminBtn(t('adminBan'), () => adminApi('ban', { player: name, reason: 'admin' })));
    box.appendChild(cardAdminBtn(t('adminReset'), () => adminApi('reset_profile', { player: name })));
    box.classList.remove('hidden');
}

function openPlayerCard(player) {
    const dlg = $('#player-card');
    if (!dlg || !player) return;
    // Room context: live-progress rows on. The profile stats + rankings are shown
    // too (loaded below), so a lobby card is the player's full profile + live round.
    $('#player-card-room')?.classList.remove('hidden');
    $('#btn-player-card-follow')?.classList.add('hidden'); // follow lives on profile cards
    $('#player-card-friends')?.classList.add('hidden');
    const titleEl = $('#player-card-title'); if (titleEl) titleEl.textContent = t('playerCardTitle');
    const hintEl = $('#player-card-hint'); if (hintEl) hintEl.textContent = t('playerCardHint');
    const mp = window.GTL_MULTIPLAYER.state;
    const room = mp.room || null;
    const { total, current } = mpRoundInfo();
    const vis = mpVisualOf(player);
    const isYou = player.id === mp.playerId;

    // Prefer the player's real Discord avatar when they're a connected participant
    // of this Activity; otherwise use the emoji identity the server assigned.
    const participant = window.DISCORD_ACTIVITY?.participant?.(player.discord_user_id) || null;
    const avatarUrl = participant ? discordAvatarUrl(participant) : null;
    const img = $('#player-card-avatar-img');
    const emoji = $('#player-card-avatar');
    if (avatarUrl) {
        img.src = avatarUrl;
        img.classList.remove('hidden');
        emoji.classList.add('hidden');
    } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        emoji.classList.remove('hidden');
        emoji.textContent = vis.icon;
        emoji.style.background = vis.color + '22';
        emoji.style.boxShadow = 'inset 0 0 0 2px ' + vis.color;
    }

    setPlayerCardRow('#player-card-name', safeDisplayName(player.name) + (isYou ? ` ${t('you')}` : ''));
    $('#player-card-host').classList.toggle('hidden', !player.is_host);
    setPlayerCardRow('#player-card-mode', modeLabel(room?.mode || state.mode));
    // No round to report before the game starts, and a spectator isn't in one.
    const noRound = !total || room?.status === 'lobby';
    setPlayerCardRow('#player-card-round', noRound ? '—' : `${room?.status === 'finished' ? total : current} / ${total}`);
    setPlayerCardRow('#player-card-score', String(player.score ?? 0));
    setPlayerCardRow('#player-card-correct', String(player.correct ?? 0));
    setPlayerCardRow('#player-card-streak', String(player.streak ?? 0));
    setPlayerCardRow('#player-card-status', playerStatusLabel(player, room));

    // "Ability to join": inside Discord, Discord's own invite sheet pulls people
    // into this Activity's voice channel — and the voice-channel auto-join drops
    // them straight into this room. On the web, share the room code instead.
    const invite = $('#btn-player-card-invite');
    if (invite) {
        const canInvite = isDiscordActivity() || !!room?.code;
        invite.classList.toggle('hidden', !canInvite);
        invite.textContent = isDiscordActivity() ? t('inviteToRoom') : t('copyCode');
    }
    // Host-only: promote another (non-host, non-spectator) player to host in the lobby.
    const mkHost = $('#btn-player-card-makehost');
    if (mkHost) {
        const canPromote = mp.isAdmin && !isYou && !player.is_host && !player.spectator && room?.status === 'lobby';
        mkHost.classList.toggle('hidden', !canPromote);
        mkHost.textContent = `👑 ${t('makeHost')}`;
        mkHost.onclick = async () => {
            try { await window.GTL_MULTIPLAYER.makeHost(player.id); closePlayerCard(); }
            catch (e) { const b = $('#player-card-error'); if (b) { b.textContent = e.message || 'error'; b.classList.remove('hidden'); } }
        };
    }
    $('#player-card-error')?.classList.add('hidden');
    renderCardAdminControls(player.name, isYou);

    // Load the player's global profile (stats + per-mode rankings) once per open —
    // not on every realtime refresh, which would re-fetch and flicker.
    const isNewOpen = playerCardId !== player.id;
    playerCardId = player.id;
    // No-ops when the card is already open, so refreshes don't steal focus.
    openDialog(dlg, $('#btn-player-card-close'));
    if (isNewOpen) loadPlayerProfileSections(safeDisplayName(player.name));
}

// Keep an open card in step with the realtime room feed.
function refreshPlayerCard() {
    if (!playerCardId) return;
    const row = currentPlayerRow(playerCardId);
    if (!row) {
        closePlayerCard();
        return;
    }
    openPlayerCard(row);
}

function closePlayerCard() {
    playerCardId = null;
    const dlg = $('#player-card');
    if (dlg?.open) closeDialog(dlg);
}

// Open the same card as a *profile* (from the leaderboard, home, anywhere a name
// is shown): the player's avatar plus their best score & rank in every mode.
// `entry` is a leaderboard/score shape { name, avatar?, you? } — not a room row.
// ---------- Friends / following (names are self-asserted, like scores) ----------
let myFollowsCache = null; // Set of followee names for the current player
async function loadMyFollows(force) {
    if (!supabaseConfigured()) return new Set();
    const me = safeDisplayName(getPlayerName());
    if (!me) return new Set();
    if (myFollowsCache && !force) return myFollowsCache;
    try {
        const rows = await sbFetch(`follows?select=followee&follower=eq.${encodeURIComponent(me)}`);
        myFollowsCache = new Set((rows || []).map((r) => safeDisplayName(r.followee)));
    } catch (e) { myFollowsCache = new Set(); }
    return myFollowsCache;
}
function isFollowing(name) { return !!(myFollowsCache && myFollowsCache.has(safeDisplayName(name))); }
async function followPlayer(name) {
    const me = safeDisplayName(getPlayerName());
    const who = safeDisplayName(name);
    if (!me || !who || me === who) return;
    (myFollowsCache = myFollowsCache || new Set()).add(who);
    try {
        await sbFetch('follows', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([{ follower: me, followee: who }]) });
    } catch (e) { console.warn('follow failed:', e.message); }
}
async function unfollowPlayer(name) {
    const me = safeDisplayName(getPlayerName());
    const who = safeDisplayName(name);
    if (!me || !who) return;
    if (myFollowsCache) myFollowsCache.delete(who);
    try {
        await sbFetch(`follows?follower=eq.${encodeURIComponent(me)}&followee=eq.${encodeURIComponent(who)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    } catch (e) { console.warn('unfollow failed:', e.message); }
}
async function setupFollowButton(name, isYou) {
    const btn = $('#btn-player-card-follow');
    if (!btn) return;
    const me = safeDisplayName(getPlayerName());
    const who = safeDisplayName(name);
    const show = supabaseConfigured() && !isYou && me && who && me !== who;
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    await loadMyFollows();
    const paint = () => {
        btn.textContent = isFollowing(who) ? `✓ ${t('following')}` : `➕ ${t('follow')}`;
        btn.classList.toggle('is-following', isFollowing(who));
    };
    paint();
    btn.onclick = async () => {
        if (isFollowing(who)) await unfollowPlayer(who); else await followPlayer(who);
        paint();
    };
}
// The current player's following list (each with their best score), on their profile.
async function renderFollowingList() {
    const wrap = $('#player-card-friends');
    const list = $('#player-card-friends-list');
    if (!wrap || !list) return;
    if (!supabaseConfigured()) { wrap.classList.add('hidden'); return; }
    await loadMyFollows(true);
    const names = [...(myFollowsCache || [])];
    if (!names.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    $('#player-card-friends-title').textContent = `${t('followingTitle')} · ${names.length}`;
    list.innerHTML = `<p class="player-card-rankings-empty">${t('lbLoading')}</p>`;
    const rows = await Promise.all(names.slice(0, 20).map(async (n) => {
        try {
            const r = await sbFetch(`scores?select=score,avatar&player=eq.${encodeURIComponent(n)}&order=score.desc&limit=1`);
            return { name: n, score: r && r[0] ? r[0].score : 0, avatar: r && r[0] ? r[0].avatar : null };
        } catch (e) { return { name: n, score: 0, avatar: null }; }
    }));
    rows.sort((a, b) => b.score - a.score);
    list.innerHTML = '';
    rows.forEach((r) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'friend-row';
        const av = document.createElement('span'); av.className = 'friend-av';
        if (typeof r.avatar === 'string' && /^https?:\/\//.test(r.avatar)) {
            const im = document.createElement('img'); im.src = r.avatar; im.alt = ''; im.referrerPolicy = 'no-referrer'; av.appendChild(im);
        } else { av.textContent = avatarFor(r.name); }
        const nm = document.createElement('span'); nm.className = 'friend-name'; nm.textContent = safeDisplayName(r.name);
        const sc = document.createElement('span'); sc.className = 'friend-score'; sc.textContent = fmtNum(r.score);
        row.append(av, nm, sc);
        row.addEventListener('click', () => openProfileCard({ name: r.name, avatar: r.avatar || undefined }));
        list.appendChild(row);
    });
}

async function openProfileCard(entry) {
    const dlg = $('#player-card');
    if (!dlg || !entry || !entry.name) return;
    playerCardId = null; // not tied to a live room row
    const isYou = !!entry.you;

    $('#player-card-title').textContent = t('profileTitle');
    $('#player-card-hint').textContent = t('profileHint');
    $('#player-card-name').textContent = safeDisplayName(entry.name) + (isYou ? ` ${t('you')}` : '');
    $('#player-card-host').classList.add('hidden');

    // Avatar: a real photo URL wins; otherwise the generated emoji for the name.
    const img = $('#player-card-avatar-img');
    const emoji = $('#player-card-avatar');
    let url = (typeof entry.avatar === 'string' && /^https?:\/\//.test(entry.avatar)) ? entry.avatar : null;
    if (!url && isYou) url = discordAvatarUrl(getDiscordProfile());
    if (url) {
        img.src = url; img.classList.remove('hidden'); emoji.classList.add('hidden');
    } else {
        img.removeAttribute('src'); img.classList.add('hidden'); emoji.classList.remove('hidden');
        emoji.textContent = (typeof entry.avatar === 'string' && entry.avatar) ? entry.avatar : avatarFor(entry.name);
        emoji.style.background = ''; emoji.style.boxShadow = '';
    }

    // Profile context: hide the live-room rows + invite, show stats + rankings.
    $('#player-card-room').classList.add('hidden');
    $('#btn-player-card-invite').classList.add('hidden');
    $('#btn-player-card-makehost')?.classList.add('hidden'); // room-only control
    $('#player-card-error').classList.add('hidden');
    $('#player-card-friends').classList.add('hidden'); // reset; shown only on your own profile
    renderCardAdminControls(entry.name, isYou);

    openDialog(dlg, $('#btn-player-card-close'));
    loadPlayerProfileSections(entry.name);
    setupFollowButton(entry.name, isYou);
    if (isYou) renderFollowingList();
}

// Populate the shared player card's profile sections (stats + per-mode rankings +
// online/last-seen) for `name`. Used by the standalone profile card and, alongside
// the live-room rows, by the in-lobby player card. Best-effort and self-cancelling
// if the card is closed before the fetches resolve.
async function loadPlayerProfileSections(name) {
    const dlg = $('#player-card');
    const statsBox = $('#player-card-profile-stats');
    const rankWrap = $('#player-card-rankings');
    const list = $('#player-card-rankings-list');
    if (!dlg || !statsBox || !rankWrap || !list) return;
    statsBox.classList.remove('hidden');
    statsBox.innerHTML = '';
    rankWrap.classList.remove('hidden');
    list.innerHTML = `<p class="player-card-rankings-empty">${supabaseConfigured() ? t('lbLoading') : '—'}</p>`;

    if (!supabaseConfigured()) { list.innerHTML = `<p class="player-card-rankings-empty">—</p>`; return; }
    try {
        const [stats, rows, activity] = await Promise.all([
            fetchPlayerStats(name),
            fetchPlayerRankings(name),
            fetchPlayerActivity(name)
        ]);
        if (!dlg.open) return; // closed/reopened meanwhile
        const ranks = rows.filter((r) => r.best != null && r.rank != null).map((r) => r.rank);
        const bestRank = ranks.length ? Math.min(...ranks) : null;
        renderProfileStats(statsBox, stats, bestRank, activity);
        renderProfileRankings(list, rows);

        // Online (active in the last few minutes) or last-seen timestamp.
        const lastSeen = $('#player-card-lastseen');
        const lastIso = (activity && activity.last_seen) || stats.lastPlayed;
        if (lastSeen && lastIso) {
            const online = isRecentlyActive(lastIso);
            lastSeen.textContent = online ? `🟢 ${t('online')}` : `${t('lastSeen')}: ${formatLastPlayed(lastIso)}`;
            lastSeen.classList.toggle('is-online', online);
            lastSeen.classList.remove('hidden');
        }
    } catch (e) {
        list.innerHTML = `<p class="player-card-rankings-empty">${t('lbOffline')}</p>`;
    }
}

async function fetchPlayerActivity(name) {
    const clean = safeDisplayName(name);
    try {
        const rows = await sbFetch(`player_stats?select=games,mp_games,wins,seconds,last_seen,xp,level,day_streak,best_day_streak,perfect_games,achievements&player=eq.${encodeURIComponent(clean)}&limit=1`);
        return (rows && rows[0]) || null;
    } catch {
        return null;
    }
}

// "Online" proxy: active within the last 3 minutes (no true presence tracking).
function isRecentlyActive(iso) {
    try {
        return (Date.now() - new Date(iso).getTime()) < 3 * 60 * 1000;
    } catch (e) {
        return false;
    }
}

// Aggregate profile stats derived from the player's score rows across all modes.
// (Win-rate / skill rating aren't tracked server-side, so only honest, derivable
// numbers are shown.)
async function fetchPlayerStats(name) {
    const clean = safeDisplayName(name);
    const rows = await sbFetch(`scores?select=score,multiplayer,mode,created_at&player=eq.${encodeURIComponent(clean)}&limit=1000`) || [];
    const games = rows.length;
    const best = games ? Math.max(...rows.map((r) => r.score)) : 0;
    const total = rows.reduce((sum, r) => sum + (r.score || 0), 0);
    const avg = games ? Math.round(total / games) : 0;
    const mp = rows.filter((r) => r.multiplayer).length;
    const modes = new Set(rows.map((r) => r.mode)).size;
    const lastPlayed = rows.reduce((max, r) => (r.created_at && r.created_at > max ? r.created_at : max), '');
    return { games, best, avg, total, mp, modes, lastPlayed };
}

// ---------- Progression: XP / levels / achievements (Phase 2) ----------
// Level curve mirrors the server: level = floor(sqrt(xp/1000)) + 1.
function levelFromXp(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 1000)) + 1); }
function xpForLevel(level) { return Math.pow(Math.max(1, level) - 1, 2) * 1000; }
function levelTitle(level) {
    if (level >= 11) return t('titleGuru');
    if (level >= 9) return t('titleExpert');
    if (level >= 7) return t('titleHacker');
    if (level >= 5) return t('titleCoder');
    if (level >= 3) return t('titleApprentice');
    return t('titleNovice');
}

// Every achievement the profile can display (id + emoji). Names come from i18n
// (ach_<id>). The server (record_progress) is the source of truth for unlocks.
const ACHIEVEMENTS = [
    { id: 'rookie', icon: '🎮' }, { id: 'dedicated', icon: '🔁' }, { id: 'centurion', icon: '💯' },
    { id: 'first_win', icon: '🥇' }, { id: 'champion', icon: '🏆' }, { id: 'perfect', icon: '✨' },
    { id: 'flawless', icon: '🌟' }, { id: 'streak3', icon: '🔥' }, { id: 'streak7', icon: '⚡' },
    { id: 'marathon', icon: '⏱️' }, { id: 'level5', icon: '🚀' }, { id: 'level10', icon: '👑' }
];

function celebrateAchievements(ids) {
    try {
        const names = ids.map((id) => t('ach_' + id) || id).join('  ·  ');
        showAchievementPop(`🏆 ${t('achievementUnlocked')}`, names);
        try { sfx.finish(); } catch (_) {}
    } catch (_) {}
}

// A brief top-of-screen banner when new achievements unlock at the end of a round.
function showAchievementPop(title, body) {
    let el = document.getElementById('achievement-pop');
    if (!el) {
        el = document.createElement('div');
        el.id = 'achievement-pop';
        el.className = 'achievement-pop';
        el.setAttribute('role', 'status');
        el.innerHTML = '<div class="ach-pop-title"></div><div class="ach-pop-body"></div>';
        document.body.appendChild(el);
    }
    el.querySelector('.ach-pop-title').textContent = title;
    el.querySelector('.ach-pop-body').textContent = body;
    el.classList.add('show');
    if (el._t) clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 5200);
    announce(`${title}. ${body}`);
}

// Level + title + XP progress bar + daily streak, spanning the profile grid top.
function renderLevelBar(box, activity) {
    const xp = Number(activity && activity.xp) || 0;
    const level = (activity && activity.level) || levelFromXp(xp);
    const base = xpForLevel(level);
    const span = Math.max(1, xpForLevel(level + 1) - base);
    const pct = Math.max(0, Math.min(100, Math.round(((xp - base) / span) * 100)));
    const streak = (activity && activity.day_streak) || 0;
    const bar = document.createElement('div');
    bar.className = 'pcs-levelbar';
    bar.innerHTML =
        `<div class="pcs-lvl-top">` +
        `<span class="pcs-lvl-badge">${t('levelShort')} ${level}</span>` +
        `<span class="pcs-lvl-title">${levelTitle(level)}</span>` +
        (streak >= 2 ? `<span class="pcs-streak" title="${t('dayStreak')}">🔥 ${streak}</span>` : '') +
        `</div>` +
        `<div class="pcs-xpbar"><div class="pcs-xpfill" style="width:${pct}%"></div></div>` +
        `<div class="pcs-xptext">${fmtNum(Math.max(0, xp - base))} / ${fmtNum(span)} XP</div>`;
    box.appendChild(bar);
}

// The full achievement grid: earned badges lit, the rest dimmed.
function renderAchievements(box, activity) {
    const earned = new Set((activity && Array.isArray(activity.achievements)) ? activity.achievements : []);
    const wrap = document.createElement('div');
    wrap.className = 'pcs-ach';
    const title = document.createElement('div');
    title.className = 'pcs-ach-title';
    title.textContent = `${t('achievementsTitle')} · ${earned.size}/${ACHIEVEMENTS.length}`;
    const grid = document.createElement('div');
    grid.className = 'pcs-ach-grid';
    ACHIEVEMENTS.forEach((a) => {
        const item = document.createElement('div');
        item.className = 'pcs-ach-item' + (earned.has(a.id) ? ' is-earned' : '');
        const name = t('ach_' + a.id) || a.id;
        item.title = name;
        item.innerHTML = `<span class="pcs-ach-icon">${a.icon}</span><span class="pcs-ach-name"></span>`;
        item.querySelector('.pcs-ach-name').textContent = name;
        grid.appendChild(item);
    });
    wrap.appendChild(title);
    wrap.appendChild(grid);
    box.appendChild(wrap);
}

// `bestRank` (min rank across modes) comes from the rankings fetch, so the whole
// profile costs no extra query. `null` when the player has no ranked score.
function renderProfileStats(box, stats, bestRank, activity) {
    box.innerHTML = '';
    renderLevelBar(box, activity);
    const mpGames = activity ? activity.mp_games : 0;
    const wins = activity ? activity.wins : 0;
    const perfect = activity ? activity.perfect_games : 0;
    const winRate = mpGames > 0 ? `${Math.round((wins / mpGames) * 100)}%` : '—';
    const hours = activity && activity.seconds ? `${(activity.seconds / 3600).toFixed(1)}h` : '0h';
    const cells = [
        { label: t('statBestRank'), value: bestRank ? `#${bestRank}` : '—', hero: true },
        { label: t('statBest'), value: fmtNum(stats.best) },
        { label: t('statGames'), value: fmtNum(stats.games) },
        { label: t('statWinRate'), value: winRate },
        { label: t('statHours'), value: hours },
        { label: t('statAvg'), value: fmtNum(stats.avg) },
        { label: t('statMp'), value: fmtNum(mpGames || stats.mp) },
        { label: t('statPerfect'), value: fmtNum(perfect) }
    ];
    cells.forEach((c) => {
        const cell = document.createElement('div');
        cell.className = 'pcs-cell' + (c.hero ? ' pcs-hero' : '');
        const v = document.createElement('strong');
        v.className = 'pcs-value';
        v.textContent = c.value;
        const l = document.createElement('span');
        l.className = 'pcs-label';
        l.textContent = c.label;
        cell.appendChild(v);
        cell.appendChild(l);
        box.appendChild(cell);
    });
    renderAchievements(box, activity);
}

// Compact thousands (35490 -> "35,490"), keeping small numbers plain.
function fmtNum(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US');
}

// Absolute date + time of the player's most recent score (their last activity).
function formatLastPlayed(iso) {
    try {
        return new Date(iso).toLocaleString(getLang() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
        return '—';
    }
}

const RANKABLE_MODES = ['languages', 'cybersecurity', 'devops', 'network', 'gamedev', 'algorithms', 'all'];

// The player's best score + rank in every mode (approximate rank: count of score
// rows above their best, +1 — same method as the personal rank on results).
async function fetchPlayerRankings(name) {
    const clean = safeDisplayName(name);
    return Promise.all(RANKABLE_MODES.map(async (mode) => {
        try {
            const rows = await sbFetch(`scores?select=score&mode=eq.${encodeURIComponent(mode)}&player=eq.${encodeURIComponent(clean)}&order=score.desc&limit=1`);
            const best = rows && rows[0] ? rows[0].score : null;
            const rank = best != null ? await countScoresAbove(mode, best) : null;
            return { mode, best, rank };
        } catch {
            return { mode, best: null, rank: null };
        }
    }));
}

async function countScoresAbove(mode, score) {
    const c = window.SUPABASE_CONFIG;
    const url = `${c.url}/rest/v1/scores?select=id&mode=eq.${encodeURIComponent(mode)}&score=gt.${score}`;
    const res = await fetch(url, {
        method: 'HEAD',
        headers: { apikey: c.anonKey, Authorization: `Bearer ${c.anonKey}`, Prefer: 'count=exact' }
    });
    if (!res.ok) return null;
    const count = Number((res.headers.get('content-range') || '').split('/')[1]);
    return Number.isFinite(count) ? count + 1 : null;
}

function renderProfileRankings(list, rows) {
    list.innerHTML = '';
    const ranked = (rows || []).filter((r) => r.best != null);
    if (!ranked.length) {
        const p = document.createElement('p');
        p.className = 'player-card-rankings-empty';
        p.textContent = t('noRankings');
        list.appendChild(p);
        return;
    }
    rows.forEach((r) => {
        if (r.best == null) return;
        const row = document.createElement('div');
        row.className = 'player-card-rank-row';
        const m = document.createElement('span');
        m.className = 'pcr-mode';
        m.textContent = modeLabel(r.mode);
        const medal = r.rank === 1 ? ' 🥇' : r.rank === 2 ? ' 🥈' : r.rank === 3 ? ' 🥉' : '';
        const rk = document.createElement('span');
        rk.className = 'pcr-rank';
        rk.textContent = (r.rank ? `#${r.rank}` : '—') + medal;
        const sc = document.createElement('span');
        sc.className = 'pcr-score';
        sc.textContent = `${r.best} pts`;
        row.appendChild(m);
        row.appendChild(rk);
        row.appendChild(sc);
        list.appendChild(row);
    });
}

// Invite others into the room this card belongs to.
async function invitePlayersToRoom() {
    const room = window.GTL_MULTIPLAYER.state.room;
    if (isDiscordActivity()) {
        try {
            await window.DISCORD_ACTIVITY.openInviteDialog();
            return;
        } catch (err) {
            console.error('openInviteDialog failed:', err);
            const box = $('#player-card-error');
            if (box) {
                box.textContent = t('inviteFailed');
                box.classList.remove('hidden');
            }
            return;
        }
    }
    if (room?.code) {
        navigator.clipboard?.writeText(room.code).then(
            () => flashButton('#btn-player-card-invite', t('codeCopied')),
            () => {}
        );
    }
}

// Lobby "Invite to this room" button — available to every player, not just the
// host. Inside Discord it opens the native Activity invite sheet (pulls people
// into this voice channel's room); a server's AutoMod can't block it because it
// isn't a text message or a discord.gg link. On the web it copies the room code.
async function inviteFromLobby() {
    const room = window.GTL_MULTIPLAYER.state.room;
    const note = $('#lobby-invite-note');
    const showNote = (msg) => {
        if (!note) return;
        note.textContent = msg;
        note.classList.remove('hidden');
    };
    if (isDiscordActivity()) {
        try {
            await window.DISCORD_ACTIVITY.openInviteDialog();
        } catch (err) {
            console.error('openInviteDialog failed:', err);
            showNote(t('inviteFailed'));
        }
        return;
    }
    if (room?.code) {
        navigator.clipboard?.writeText(room.code).then(
            () => { flashButton('#btn-lobby-invite', t('codeCopied')); showNote(t('inviteShareCode')); },
            () => showNote(room.code)
        );
    }
}

// ============================================================
//  Multiplayer UI
// ============================================================
function mpOnline() {
    return window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.configured();
}

// True when the local player joined a room mid-game (server-flagged spectator):
// they watch the round but can't answer, and their score doesn't count.
function amSpectator() {
    const mp = window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.state;
    if (!mp) return false;
    const me = mp.players.find((p) => p.id === mp.playerId);
    return !!(me && me.spectator);
}

function refreshMultiplayerButtons() {
    const on = mpOnline();
    const discord = isDiscordActivity();
    const mpRow = document.querySelector('.home-mp-actions');
    if (mpRow) mpRow.classList.toggle('hidden', discord);

    // In a Discord Activity the Host/Join row is hidden; instead offer a single
    // "Create Room" button (with a matching hint) as a fallback for when a room
    // wasn't created automatically. We only render the home screen in Discord
    // when auto-join didn't already drop us into a shared room, so surfacing the
    // button here is exactly the "not auto-created" case.
    const discordNote = $('#discord-mp-note');
    const discordHost = $('#btn-discord-host');
    if (discord) {
        if (discordNote) {
            discordNote.textContent = on ? t('discordCreateHint') : t('discordMpUnavailable');
            discordNote.classList.remove('hidden');
        }
        if (discordHost) {
            discordHost.classList.toggle('hidden', !on);
            discordHost.disabled = !(on && canPlay());
        }
    } else {
        if (discordNote) discordNote.classList.add('hidden');
        if (discordHost) discordHost.classList.add('hidden');
    }
    // Hosting or joining needs an online connection plus a playable identity
    // (a name, or a Discord sign-in where that's required).
    const ready = canPlay();
    const authLocked = requiresDiscordLogin() && !isDiscordLinked();
    const enable = on && (ready || authLocked);
    $('#btn-host').disabled = !enable;
    $('#btn-join').disabled = !enable;
    $('#btn-host').classList.toggle('auth-locked', authLocked);
    $('#btn-join').classList.toggle('auth-locked', authLocked);
    $('#btn-host').textContent = authLocked ? `🔒 ${t('hostRoom').replace(/^\S+\s*/, '')}` : t('hostRoom');
    $('#btn-join').textContent = authLocked ? `🔒 ${t('joinRoom').replace(/^\S+\s*/, '')}` : t('joinRoom');
    if (!enable || authLocked) {
        const msg = !ready
            ? (requiresDiscordLogin() ? t('loginDiscordToPlay') : t('nameRequired'))
            : t('mpNeedOnline');
        $('#btn-host').title = msg;
        $('#btn-join').title = msg;
    } else {
        $('#btn-host').removeAttribute('title');
        $('#btn-join').removeAttribute('title');
    }
}

function modeLabel(mode) {
    const map = {
        languages: 'modeLanguages',
        cybersecurity: 'modeCyber',
        devops: 'modeDevops',
        network: 'modeNetwork',
        gamedev: 'modeGamedev',
        algorithms: 'modeAlgo',
        all: 'modeAll'
    };
    return t(map[mode] || 'modeLanguages');
}

function renderMpPlayerList(containerSel, players, {
    compact,
    showKick
}) {
    const el = $(containerSel);
    el.innerHTML = '';
    const mp = window.GTL_MULTIPLAYER.state;
    players.forEach((p) => {
        const vis = mpVisualOf(p);
        const row = document.createElement('div');
        row.className = `mp-player-row${p.id === mp.playerId ? ' is-you' : ''}`;
        const av = document.createElement('div');
        av.className = 'mp-player-avatar';
        av.style.boxShadow = 'inset 0 0 0 2px ' + vis.color;
        const avatarUrl = mpDiscordAvatarUrl(p);
        if (avatarUrl) {
            const img = document.createElement('img');
            img.className = 'mp-player-avatar-img';
            img.alt = '';
            img.src = avatarUrl;
            // If the real avatar 404s, degrade to the coloured emoji badge.
            img.addEventListener('error', () => {
                img.remove();
                av.textContent = vis.icon;
                av.style.background = vis.color + '22';
            });
            av.appendChild(img);
        } else {
            av.textContent = vis.icon;
            av.style.background = vis.color + '22';
        }
        const name = document.createElement('div');
        name.className = 'mp-player-name';
        name.textContent = safeDisplayName(p.name) + (p.id === mp.playerId ? ` ${t('you')}` : '');
        row.appendChild(av);
        row.appendChild(name);
        if (p.is_host) {
            const badge = document.createElement('span');
            badge.className = 'mp-host-badge';
            badge.textContent = t('adminBadge');
            row.appendChild(badge);
        }
        const sc = document.createElement('div');
        sc.className = 'mp-player-score';
        sc.textContent = String(p.score);
        row.appendChild(sc);
        if (showKick && mp.isAdmin && !p.is_host) {
            const kick = document.createElement('button');
            kick.className = 'mp-kick-btn';
            kick.title = t('kickPlayer');
            kick.textContent = '×';
            kick.addEventListener('click', (ev) => {
                // The row itself opens the player card — don't do both.
                ev.stopPropagation();
                window.GTL_MULTIPLAYER.kickPlayer(p.id).catch((e) => console.error(e));
            });
            row.appendChild(kick);
        }
        if (compact) {
            name.textContent = safeDisplayName(p.name);
        }

        // Clicking a player opens their card: round, score, mode and how to invite.
        row.classList.add('is-clickable');
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.title = `${safeDisplayName(p.name)} — ${t('openPlayerCard')}`;
        row.addEventListener('click', () => openPlayerCard(currentPlayerRow(p.id) || p));
        row.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            openPlayerCard(currentPlayerRow(p.id) || p);
        });
        el.appendChild(row);
    });
}

function syncMpHudFromPlayers() {
    const me = window.GTL_MULTIPLAYER.state.players.find((p) => p.id === window.GTL_MULTIPLAYER.state.playerId);
    if (!me) return;
    state.score = me.score;
    state.correct = me.correct;
    state.streak = me.streak;
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak || 0);
    updateScore();
    updateCorrect();
    updateStreakPill();
    renderMpPlayerList('#mp-game-players', window.GTL_MULTIPLAYER.state.players, {
        compact: true,
        showKick: false
    });
}

function renderLobby(room, players) {
    const discord = isDiscordActivity();
    const label = $('#lobby-label');
    if (label) label.textContent = discord ? t('discordVoiceRoom') : t('roomCode');
    $('#lobby-code').textContent = discord ? t('discordVoiceRoomHint') : (room?.code || '----');
    renderLobbySettings(room);
    renderMpPlayerList('#lobby-players', players, {
        compact: false,
        showKick: room ?.status === 'lobby'
    });

    const isAdmin = window.GTL_MULTIPLAYER.state.isAdmin;
    $('#lobby-wait').classList.toggle('hidden', isAdmin);
    $('#lobby-admin').classList.toggle('hidden', !isAdmin);
    $('#btn-copy-code').classList.toggle('hidden', !isAdmin || discord);

    // "Invite to this room" — shown to everyone when there's something to invite
    // with: the native Activity dialog in Discord, or a shareable code on the web.
    const invite = $('#btn-lobby-invite');
    if (invite) {
        const canInvite = discord || !!room?.code;
        invite.classList.toggle('hidden', !canInvite);
        invite.textContent = discord ? t('inviteToRoom') : t('copyCode');
    }
    $('#lobby-invite-note')?.classList.add('hidden');

    // Inside Discord a lone player may start a solo round; code rooms still want
    // at least two players before the host can start.
    const activeCount = players.filter((p) => !p.spectator).length;
    const minPlayers = isDiscordActivity() ? 1 : 2;
    const canStart = isAdmin && activeCount >= minPlayers && room ?.status === 'lobby';
    $('#btn-lobby-start').disabled = !canStart;
}

// Host-editable game settings in the lobby (feature: "the owner can change the
// settings"). Non-hosts see a read-only summary line.
function renderLobbySettings(room) {
    const isAdmin = window.GTL_MULTIPLAYER.state.isAdmin;
    const inLobby = !room || room.status === 'lobby';
    const box = $('#lobby-settings');
    if (box) box.classList.toggle('hidden', !(isAdmin && inLobby));

    const s = Object.assign({}, defaultSettings, (room && room.settings) || {});
    const mode = room && MODES[room.mode] ? room.mode : 'languages';

    const timer = s.timer || 'auto';
    if (isAdmin && inLobby && box) {
        $('#lobby-mode-select').value = mode;
        $('#lobby-questions').value = String(s.questions);
        $('#lobby-difficulty').value = s.difficulty;
        $('#lobby-timer').value = String(timer);
        $('#lobby-sound').checked = !!getSettings().sound;
    }

    const diff = s.difficulty === 'all' ? t('diffAll') : diffLabel(s.difficulty);
    const timerLabel = timer === 'auto' ? t('timerAuto') : `${timer}s`;
    $('#lobby-mode').textContent = `${modeLabel(mode)}  •  ${diff}  •  ${s.questions} Q  •  ${timerLabel}`;
}

// Host changed mode / questions / difficulty / timer — push to the room.
function pushLobbySettings() {
    const mode = $('#lobby-mode-select').value;
    const timerVal = $('#lobby-timer').value;
    const settings = {
        questions: Number($('#lobby-questions').value),
        difficulty: $('#lobby-difficulty').value,
        timer: timerVal === 'auto' ? 'auto' : Number(timerVal),
        feedbackDelay: getSettings().feedbackDelay
    };
    window.GTL_MULTIPLAYER.updateRoomSettings(mode, settings)
        .catch((e) => {
            console.error(e);
            announce(e.message);
        });
}

function showMpGameChrome(room) {
    $('#mp-game-strip').classList.remove('hidden');
    $('#mp-room-code').textContent = room.code;
    $('#btn-end').classList.toggle('hidden', !window.GTL_MULTIPLAYER.state.isAdmin);
    // A spectator (joined mid-game) can't end the round, but must be able to leave
    // whenever they want — give them their own Leave button in the game chrome.
    $('#btn-mp-leave')?.classList.toggle('hidden', !amSpectator());
    updateInGameProfile();
    renderMpPlayerList('#mp-game-players', window.GTL_MULTIPLAYER.state.players, {
        compact: true,
        showKick: false
    });
}

function hideMpGameChrome() {
    $('#mp-game-strip').classList.add('hidden');
    $('#btn-end').classList.remove('hidden');
    $('#btn-mp-leave')?.classList.add('hidden');
}

function showMultiplayerQuestion(room) {
    const refs = room.round_refs || [];
    const ref = refs[room.question_index];
    if (!ref) return;

    const raw = window.GTL_MULTIPLAYER.resolveQuestion(ref, state.allQuestions);
    if (!raw) return;

    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    state.answered = false;
    state.mpChosen = null;
    state.index = room.question_index;
    state.mpRound = refs;
    hideMpStatus();

    const cur = normalizeQuestion(raw, {
        optionSeed: ref.optionSeed
    });
    state.current = cur;
    $('#q-current').textContent = String(state.index + 1);
    $('#q-total').textContent = String(refs.length);
    $('#correct-total').textContent = String(refs.length);

    const dEl = $('#code-difficulty');
    dEl.dataset.diff = cur.difficulty;
    dEl.textContent = diffLabel(cur.difficulty);

    const codeEl = $('#code-snippet');
    const panel = codeEl.parentElement;
    if (cur.panelIsCode) {
        panel.classList.remove('as-text');
        panel.setAttribute('dir', 'ltr');
        codeEl.innerHTML = highlight(cur.panelText);
    } else {
        panel.classList.add('as-text');
        panel.setAttribute('dir', 'auto');
        codeEl.textContent = cur.panelText;
    }

    const qt = $('#question-text');
    if (cur.questionText) {
        qt.classList.remove('hidden');
        qt.textContent = cur.questionText;
    } else {
        qt.classList.add('hidden');
        qt.textContent = '';
    }

    hideToast();
    // Spectators (joined mid-game) watch the round with the answer UI locked.
    renderQuestionUI(cur, state.spectator);
    if (state.spectator) {
        document.querySelectorAll('#options-grid button').forEach((b) => { b.disabled = true; });
        showSpectatorBanner();
    }
    state.questionTime = ref.duration || timeForDifficulty(cur.difficulty);
    state.questionStartedAt = Date.now();
    syncMpHudFromPlayers();
    startTimerFromServer();
}

function showSpectatorBanner() {
    const el = $('#mp-status');
    if (!el) return;
    el.textContent = t('spectating');
    el.classList.remove('hidden');
}

async function showMultiplayerReveal(room) {
    // If this question's options were never rendered (a dropped/coalesced realtime
    // update), sync the display to the current question first — otherwise the
    // reveal would run against a stale question and stale option buttons.
    if (!state.current || state.index !== room.question_index) {
        showMultiplayerQuestion(room);
    }
    if (!state.current) return;
    hideMpStatus();
    clearTimer();
    const cur = state.current;
    const ans = cur.answer;
    const chosen = state.mpChosen;

    // Fill-in-the-blank reveal: mark the typed input, show the answer. Grading is
    // canonical-only to match the server's scoring.
    if (cur.style === 'fill') {
        const input = $('#fill-input');
        const submit = $('#fill-submit');
        const ok = !state.spectator && isFillCorrect(cur, chosen, true);
        if (input) {
            input.disabled = true;
            input.classList.remove('fill-correct', 'fill-wrong');
            if (!state.spectator) input.classList.add(ok ? 'fill-correct' : 'fill-wrong');
        }
        if (submit) submit.disabled = true;
        if (state.spectator) {
            showFeedback('good', ans, cur.explanation[getLang()]);
        } else if (ok) {
            sfx.correct();
            showFeedback('good', t('correct'), cur.explanation[getLang()]);
        } else if (normFill(chosen)) {
            sfx.wrong();
            showFeedback('bad', `${t('wrong')} ${ans}.`, cur.explanation[getLang()]);
        } else {
            sfx.wrong();
            showFeedback('bad', `${t('timeUp')} ${ans}.`, cur.explanation[getLang()]);
        }
        if (!state.spectator && !state.roundHistory.some((item) => item.questionIndex === state.index)) {
            recordRoundAnswer(cur, chosen, ok, 0, !normFill(chosen));
        }
        state.answered = true;
        return;
    }

    const buttons = Array.from(document.querySelectorAll('#options-grid button'));

    // Reset every option to a clean slate so only THIS question's answer (and the
    // player's own pick) get highlighted — never a leftover from a previous turn.
    buttons.forEach((b) => {
        b.disabled = true;
        b.classList.remove('correct', 'wrong', 'shake', 'mp-selected');
    });
    buttons.forEach((b) => {
        if (b.dataset.answer === ans) b.classList.add('correct');
    });
    if (chosen && chosen !== ans) {
        const mine = buttons.find((b) => b.dataset.answer === chosen);
        if (mine) mine.classList.add('wrong', 'shake');
    }

    // Local result feedback (the key-gated caller runs this once per reveal).
    if (state.spectator) {
        // A watcher just sees the correct answer, no pass/fail sound.
        showFeedback('good', ans, cur.explanation[getLang()]);
        state.answered = true;
    } else if (chosen && chosen === ans) {
        sfx.correct();
        showFeedback('good', t('correct'), cur.explanation[getLang()]);
    } else if (chosen) {
        sfx.wrong();
        showFeedback('bad', `${t('wrong')} ${ans}.`, cur.explanation[getLang()]);
    } else {
        sfx.wrong();
        showFeedback('bad', `${t('timeUp')} ${ans}.`, cur.explanation[getLang()]);
    }
    if (!state.spectator && !state.roundHistory.some((item) => item.questionIndex === state.index)) {
        recordRoundAnswer(cur, chosen, chosen === ans, 0, !chosen);
    }
    state.answered = true;

    // Show what every player picked, tagged with their colour + icon + name.
    try {
        const answers = await window.GTL_MULTIPLAYER.fetchAnswers(room.question_index);
        renderRevealChips(answers);
    } catch (e) {
        console.error('fetchAnswers:', e);
    }
}

// Decorate each option button with chips for the players who chose it.
function renderRevealChips(answers) {
    const players = window.GTL_MULTIPLAYER.state.players;
    const byId = {};
    players.forEach((p) => {
        byId[p.id] = p;
    });

    document.querySelectorAll('#options-grid .mp-answer-chips').forEach((el) => el.remove());
    const buttons = Array.from(document.querySelectorAll('#options-grid button'));

    const groups = {};
    answers.forEach((a) => {
        (groups[a.answer] = groups[a.answer] || []).push(a.player_id);
    });

    buttons.forEach((btn) => {
        const ids = groups[btn.dataset.answer] || [];
        if (!ids.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'mp-answer-chips';
        ids.forEach((pid) => {
            const p = byId[pid];
            if (!p) return;
            const vis = mpVisualOf(p);
            const chip = document.createElement('span');
            chip.className = 'mp-answer-chip';
            chip.title = vis.name;
            chip.style.background = vis.color + '22';
            chip.style.boxShadow = 'inset 0 0 0 1px ' + vis.color;
            const ic = document.createElement('span');
            ic.className = 'mp-chip-ic';
            ic.textContent = vis.icon;
            const nm = document.createElement('span');
            nm.className = 'mp-chip-nm';
            nm.textContent = vis.name;
            nm.style.color = vis.color;
            chip.appendChild(ic);
            chip.appendChild(nm);
            wrap.appendChild(chip);
        });
        btn.appendChild(wrap);
    });
}

// Build the multiplayer scoreboard. Keeps the room alive so "Play again" works.
function renderMpResults() {
    const mpState = window.GTL_MULTIPLAYER.state;
    const players = mpState.players;
    showScreen('results');

    $('.final-score').classList.remove('hidden');
    $('.results-correct').classList.remove('hidden');
    $('#result-stats').classList.remove('hidden');
    $('#answer-review').classList.remove('hidden');
    $('#personal-result').classList.add('hidden');
    $('#btn-challenge').classList.add('hidden');
    $('#btn-replay').classList.remove('hidden');
    $('#btn-replay').textContent = t('backToLobby'); // -> room lobby (stays in room)
    $('#btn-menu').textContent = t('leaveRoom'); // "Leave" -> main menu

    const me = players.find((p) => p.id === mpState.playerId);
    countUp($('#final-score'), me ? me.score : 0, 900);
    $('#results-correct').textContent = String(me ? me.correct : 0);
    $('#results-total').textContent = String(
        (state.mpRound && state.mpRound.length) ||
        (mpState.room && mpState.room.round_refs && mpState.room.round_refs.length) || 0
    );
    state.correct = me ? me.correct : 0;
    state.score = me ? me.score : 0;
    state.round = new Array(Number($('#results-total').textContent) || state.roundHistory.length);
    renderRoundSummary();
    $('.results-sub').textContent = t('roomResults');
    renderLeaderboard(window.GTL_MULTIPLAYER.getRoomLeaderboard(mpRoomAvatarOf));
    $('#lb-note').className = 'lb-note';
    $('#lb-note').textContent = '';

    if (!state.mpResultsShown) {
        sfx.finish();
        state.mpResultsShown = true;
        registerMpScores();
        // Log my play-time + a multiplayer win if I finished top of the room, plus XP.
        if (!state.spectator) recordPlay(true, amIWinner(), state.score, isPerfectRound());
    }
}

// Register every player's final score in the global leaderboard, flagged as a
// multiplayer result. The host submits once for the whole room (one row each).
function registerMpScores() {
    if (!supabaseConfigured()) return;
    const mpState = window.GTL_MULTIPLAYER.state;
    if (!mpState.isAdmin) return;
    const mode = (mpState.room && mpState.room.mode) || state.mode;
    const rows = mpState.players
        // Never post a 0 (or negative) result to the global board — a player who
        // scored nothing shouldn't create a "— 0 pts" leaderboard entry.
        .filter((p) => (p.score || 0) > 0 && !p.spectator)
        .map((p) => ({
            player: p.name,
            score: p.score,
            mode,
            multiplayer: true,
            // Persist each player's real Discord photo so EVERYONE sees it on the
            // board later (not just the local player via the live render override).
            // The host resolves it from the shared Activity participants; null → emoji.
            avatar: mpDiscordAvatarUrl(p) || null
        }));
    if (!rows.length) return;
    submitMpScores(rows).catch((e) => console.error('register mp scores:', e));
}

// "Play again": host resets the room to its lobby; everyone else returns to the
// lobby and waits for the host to start the next round.
function mpPlayAgain() {
    const mpState = window.GTL_MULTIPLAYER.state;
    state.mpResultsShown = false;
    state.mpSyncKey = '';
    if (mpState.isAdmin) {
        window.GTL_MULTIPLAYER.restartRoom().catch((e) => {
            console.error(e);
            announce(e.message);
        });
    } else {
        renderLobby(mpState.room, mpState.players);
        showScreen('lobby');
    }
}

function handleMultiplayerUpdate(room, players) {
    if (!room) return;

    if (room.status === 'lobby') {
        // Fresh lobby, or back from a finished game via "Play again". Everyone in
        // the lobby is a full player again (spectator flags were cleared server-side).
        state.multiplayer = true;
        state.mpSyncKey = '';
        state.mpResultsShown = false;
        state.spectator = false;
        state.roundHistory = [];
        state.bestStreak = 0;
        clearTimer();
        hideMpStatus();
        hideMpGameChrome();
        renderLobby(room, players);
        if (!screens.lobby.classList.contains('active')) showScreen('lobby');
        presenceStartedAt = 0;
        pushPresence();
        refreshPlayerCard();
        return;
    }

    if (room.status === 'closed') {
        // Room was removed before the game started (host left / cleaned up).
        if (!state.multiplayer) return;
        window.GTL_MULTIPLAYER.teardown();
        returnHome();
        return;
    }

    if (room.status === 'finished') {
        if (!state.multiplayer) return;
        clearTimer();
        hideMpStatus();
        hideMpGameChrome();
        if (!screens.results.classList.contains('active')) {
            renderMpResults();
        } else {
            // Already on the scoreboard — just refresh standings without re-animating.
            renderLeaderboard(window.GTL_MULTIPLAYER.getRoomLeaderboard(mpRoomAvatarOf));
        }
        pushPresence();
        refreshPlayerCard();
        return;
    }

    if (room.status === 'playing') {
        state.multiplayer = true;
        state.mpResultsShown = false;
        state.spectator = amSpectator();
        if (!state.gameStartMs) state.gameStartMs = Date.now(); // play-time tracking
        const key = `${room.question_index}|${room.phase}`;
        if (key !== state.mpSyncKey) {
            state.mpSyncKey = key;
            if (!screens.game.classList.contains('active')) showScreen('game');
            showMpGameChrome(room);
            if (room.phase === 'question') {
                showMultiplayerQuestion(room);
            } else if (room.phase === 'reveal') {
                showMultiplayerReveal(room);
            }
            // Stamp the round start once, on the first question of the round, so the
            // Discord card shows a stable elapsed timer.
            if (!presenceStartedAt || room.question_index === 0) presenceStartedAt = Date.now();
        }
        syncMpHudFromPlayers();
        pushPresence();
        refreshPlayerCard();
    }
}

// Leave multiplayer and reload the selected single-player bank (multiplayer
// overwrites state.allQuestions with the full 'all' set).
function returnHome() {
    state.multiplayer = false;
    state.mpResultsShown = false;
    state.mpSyncKey = '';
    clearTimer();
    hideMpStatus();
    hideMpGameChrome();
    closePlayerCard();
    // Drop the round's elapsed timer BEFORE the screen change, so the presence
    // push that showScreen() triggers already describes a player in the menu.
    presenceStartedAt = 0;
    showScreen('home');
    selectMode(state.mode);
    pushPresence();
}

// Multiplayer rounds can use any bank (the host picks the mode), so always load
// the full set — refs carry their own bank and resolve regardless of mode.
async function loadAllBanks() {
    try {
        state.allQuestions = await window.gameAPI.getQuestions('all');
    } catch (e) {
        console.error('Failed to load question banks:', e);
    }
}

// Re-apply everything that depends on the Discord identity. Called when the
// Activity handshake finishes AFTER boot's bounded wait elapsed (a cold
// /api/token start on first launch can push it past the timeout). Without this
// the player has to close & relaunch the Activity just to get their name read.
function onDiscordSessionReady() {
    if (!isDiscordActivity()) return;
    syncDiscordNameField();
    refreshMultiplayerButtons();
    updateAdminButton();
    sendHeartbeat();
    // If we fell through to Home solo because the identity wasn't ready in time,
    // join the voice-channel room now — but never hijack a challenge landing.
    const onHome = $('#screen-home') && $('#screen-home').classList.contains('active');
    const hasChallenge = !!parseChallengePayload(window.DISCORD_ACTIVITY.customId);
    if (onHome && !state.multiplayer && !hasChallenge) {
        autoJoinDiscordVoiceRoom().finally(hideBootLoading);
    } else {
        hideBootLoading();
    }
}

async function autoJoinDiscordVoiceRoom() {
    if (!isDiscordActivity() || !mpOnline()) return false;
    // Guard against a double join if boot() and the late self-heal both fire.
    if (state.autoJoinInFlight) return false;
    state.autoJoinInFlight = true;
    try {
        return await autoJoinDiscordVoiceRoomInner();
    } finally {
        state.autoJoinInFlight = false;
    }
}

async function autoJoinDiscordVoiceRoomInner() {
    if (!isDiscordActivity() || !mpOnline()) return false;

    const instanceId = window.DISCORD_ACTIVITY.instanceId;
    const userId = window.DISCORD_ACTIVITY.user?.id;
    if (!instanceId || !userId) return false;

    const note = $('#discord-mp-note');
    if (note) {
        note.textContent = t('discordJoining');
        note.classList.remove('hidden');
    }

    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinDiscordRoom(
            instanceId,
            state.mode,
            getSettings(),
            getPlayerName(),
            userId
        );
        state.multiplayer = true;
        state.viewOnly = false;
        state.mpSyncKey = '';
        const mp = window.GTL_MULTIPLAYER.state;
        state.spectator = amSpectator();
        // Joined a game already in progress → spectate: let the realtime sync
        // render the live question rather than forcing the (wrong) lobby view.
        if (mp.room && mp.room.status === 'playing') {
            handleMultiplayerUpdate(mp.room, mp.players);
        } else {
            renderLobby(mp.room, mp.players);
            showScreen('lobby');
        }
        return true;
    } catch (err) {
        console.error('Discord voice room join failed:', err);
        if (note) note.textContent = t('discordMpUnavailable');
        return false;
    }
}

// Discord "Back to Lobby": (re)join the voice-channel's shared room and land in
// its lobby. Works even after a game ended and the player was sent Home — the
// room is keyed to the voice-channel instance, so it can always be re-entered.
async function enterDiscordLobby() {
    if (!isDiscordActivity() || !mpOnline()) return;
    const btn = $('#btn-discord-host');
    if (btn) btn.disabled = true;
    try {
        const ok = await autoJoinDiscordVoiceRoom();
        if (!ok) {
            const note = $('#discord-mp-note');
            if (note) {
                note.textContent = t('returnLobbyFailed');
                note.classList.remove('hidden');
            }
            return;
        }
        // Rejoined a finished room as host → reset it to the lobby so a new round
        // can start; guests will follow via the realtime 'lobby' update.
        const mp = window.GTL_MULTIPLAYER;
        if (mp.state.isAdmin && mp.state.room && mp.state.room.status === 'finished') {
            try {
                await mp.restartRoom();
                renderLobby(mp.state.room, mp.state.players);
            } catch (e) {
                console.error('restart on return-to-lobby:', e);
            }
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function hostRoomFlow() {
    if (!mpOnline()) return;
    if (!requireNameToInteract()) return;
    saveSettingsFromUI();
    const name = getPlayerName();
    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.hostRoom(state.mode, getSettings(), name);
        state.multiplayer = true;
        state.viewOnly = false;
        showScreen('lobby');
        renderLobby(window.GTL_MULTIPLAYER.state.room, window.GTL_MULTIPLAYER.state.players);
    } catch (e) {
        console.error(e);
        showAuthError(t('mpHostFail') + ': ' + e.message);
    }
}

function openJoinModal() {
    if (!mpOnline()) return;
    if (!requireNameToInteract()) return;
    saveSettingsFromUI();
    $('#join-code').value = '';
    $('#join-error').classList.add('hidden');
    openDialog($('#join-modal'), $('#join-code'));
}

function closeJoinModal() {
    closeDialog($('#join-modal'));
}

async function confirmJoinRoom() {
    const code = window.GTL_MULTIPLAYER.normalizeCode($('#join-code').value);
    if (code.length !== 4) {
        $('#join-error').textContent = t('roomCode');
        $('#join-error').classList.remove('hidden');
        return;
    }
    const btn = $('#btn-join-confirm');
    const prevLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = t('joining'); }
    $('#join-error').classList.add('hidden');
    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinRoom(code, getPlayerName());
        closeJoinModal();
        state.multiplayer = true;
        state.viewOnly = false;
        state.spectator = amSpectator();
        const mp = window.GTL_MULTIPLAYER.state;
        if (mp.room && mp.room.status === 'playing') {
            handleMultiplayerUpdate(mp.room, mp.players);
        } else {
            showScreen('lobby');
            renderLobby(mp.room, mp.players);
        }
    } catch (e) {
        $('#join-error').textContent = t('mpJoinFail') + ': ' + e.message;
        $('#join-error').classList.remove('hidden');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = prevLabel || t('joinConfirm'); }
    }
}

async function lobbyStartGame() {
    const room = window.GTL_MULTIPLAYER.state.room;
    const settings = Object.assign({}, getSettings(), (room && room.settings) || {}, {
        mode: (room && room.mode) || state.mode
    });
    const built = window.GTL_MULTIPLAYER.buildRoundForRoom(state.allQuestions, settings);
    state.mpRound = built.roundRefs;
    try {
        await window.GTL_MULTIPLAYER.startRoom(built.roundRefs, built.answerKeys);
    } catch (e) {
        console.error(e);
        announce(e.message);
    }
}

async function leaveMultiplayer() {
    await window.GTL_MULTIPLAYER.leaveRoom();
    returnHome();
}

function onMpKicked() {
    announce(t('mpKicked'));
    window.GTL_MULTIPLAYER.teardown();
    returnHome();
}

// ============================================================
//  Wire up the UI
// ============================================================
function bindEvents() {
    // window controls
    $('#tb-min').addEventListener('click', () => window.appWindow ?.minimize());
    $('#tb-max').addEventListener('click', () => window.appWindow ?.toggleMaximize());
    $('#tb-close').addEventListener('click', () => window.appWindow ?.close());

    // language switch (home toggle + lobby toggle + settings dropdown)
    document.querySelectorAll('.lang-switch button').forEach((b) => {
        b.addEventListener('click', () => setLang(b.dataset.setlang));
    });

    // Leave the room if the player closes the window, refreshes, or navigates
    // away — a keepalive beacon still flushes while the renderer is unloading.
    const leaveOnUnload = () => {
        try {
            window.GTL_MULTIPLAYER.leaveBeacon();
        } catch (e) {
            /* unloading */ }
    };
    window.addEventListener('pagehide', leaveOnUnload);
    window.addEventListener('beforeunload', leaveOnUnload);

    // mode cards — select in place (stay on the home page)
    document.querySelectorAll('#mode-grid .mode-card').forEach((card) => {
        card.addEventListener('click', () => selectMode(card.dataset.mode));
    });

    // home actions
    $('#btn-start').addEventListener('click', () => startGame());
    $('#btn-host').addEventListener('click', hostRoomFlow);
    $('#btn-discord-host').addEventListener('click', enterDiscordLobby);
    $('#btn-join').addEventListener('click', openJoinModal);
    $('#btn-join-confirm').addEventListener('click', confirmJoinRoom);
    $('#btn-join-cancel').addEventListener('click', closeJoinModal);
    $('#join-code').addEventListener('input', (e) => {
        e.target.value = window.GTL_MULTIPLAYER.normalizeCode(e.target.value);
    });
    $('#btn-copy-code').addEventListener('click', () => {
        const code = $('#lobby-code').textContent;
        navigator.clipboard ?.writeText(code).then(
            () => flashButton('#btn-copy-code', t('codeCopied')),
            () => {}
        );
    });
    $('#btn-lobby-start').addEventListener('click', lobbyStartGame);
    // Host-only lobby settings (mode / questions / difficulty push to the room;
    // sound is a per-client preference).
    $('#lobby-mode-select').addEventListener('change', pushLobbySettings);
    $('#lobby-questions').addEventListener('change', pushLobbySettings);
    $('#lobby-difficulty').addEventListener('change', pushLobbySettings);
    $('#lobby-timer').addEventListener('change', pushLobbySettings);
    $('#lobby-sound').addEventListener('change', () => {
        const cur = store.settings;
        cur.sound = $('#lobby-sound').checked;
        store.settings = cur;
    });
    $('#btn-lobby-end').addEventListener('click', () => {
        if (window.GTL_MULTIPLAYER.state.room ?.status === 'lobby') {
            leaveMultiplayer();
        } else {
            window.GTL_MULTIPLAYER.endRoom().catch((e) => console.error(e));
        }
    });
    $('#btn-lobby-leave').addEventListener('click', leaveMultiplayer);
    $('#btn-lobby-invite').addEventListener('click', inviteFromLobby);
    $('#ui-scale-minus')?.addEventListener('click', () => nudgeUiScale(-UI_SCALE_STEP));
    $('#ui-scale-plus')?.addEventListener('click', () => nudgeUiScale(UI_SCALE_STEP));
    $('#lb-mode-select')?.addEventListener('change', (e) => {
        state.lbViewMode = e.target.value;
        buildResultsLeaderboard();
    });
    $('#lb-scope-switch')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.lb-scope-btn');
        if (!btn) return;
        state.lbScope = btn.dataset.scope === 'week' ? 'week' : 'all';
        updateLbScopeSwitch();
        buildResultsLeaderboard();
    });
    // Click your name/avatar on Home to open your own profile (rank per mode).
    const homeProfile = $('#home-profile');
    if (homeProfile) {
        homeProfile.classList.add('is-clickable');
        homeProfile.tabIndex = 0;
        homeProfile.setAttribute('role', 'button');
        const openSelf = () => openProfileCard({ name: getPlayerName(), avatar: discordAvatarUrl(getDiscordProfile()) || undefined, you: true });
        homeProfile.addEventListener('click', openSelf);
        homeProfile.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            openSelf();
        });
    }
    $('#btn-friends').addEventListener('click', viewLeaderboard);
    $('#btn-daily')?.addEventListener('click', () => {
        // Already played today → just show today's board; otherwise start the challenge.
        if (isDailyDone()) viewDailyResults();
        else startDailyChallenge();
    });
    $('#btn-settings').addEventListener('click', openSettingsPanel);
    $('#btn-admin')?.addEventListener('click', openAdminPanel);
    $('#admin-close')?.addEventListener('click', closeAdminPanel);
    $('#admin-modal')?.addEventListener('click', (e) => { if (e.target === $('#admin-modal')) closeAdminPanel(); });
    $('#set-close').addEventListener('click', () => {
        saveSettingsFromUI();
        const selectedLanguage = $('#set-language').value;
        closeDialog($('#settings-panel'));
        setLang(selectedLanguage);
    });
    $('#set-name').addEventListener('input', () => {
        $('#set-name').removeAttribute('aria-invalid');
        $('#settings-error').classList.add('hidden');
        updateStartButtonState();
    });
    $('#btn-discord-login')?.addEventListener('click', startDiscordLogin);
    $('#btn-discord-logout')?.addEventListener('click', discordLogout);
    $('#home-login-cta')?.addEventListener('click', startDiscordLogin);
    $('#auth-retry')?.addEventListener('click', startDiscordLogin);

    // about
    $('#btn-about').addEventListener('click', () => {
        closeDialog($('#settings-panel'), false);
        openAbout();
    });
    $('#about-close').addEventListener('click', () => closeDialog($('#about-panel')));
    document.querySelectorAll('.about-link, .about-legal-link').forEach((b) => {
        b.addEventListener('click', (event) => {
            event.preventDefault();
            // Buttons carry data-url; the legal <a> links carry an href (already
            // resolved to an absolute URL by the browser).
            openExternalUrl(b.dataset.url || b.href);
        });
    });

    // game — end the quiz early
    $('#btn-end').addEventListener('click', () => openDialog($('#end-dialog'), $('#btn-end-cancel')));
    $('#btn-end-confirm').addEventListener('click', () => {
        closeDialog($('#end-dialog'));
        endQuiz();
    });
    $('#btn-end-cancel').addEventListener('click', () => closeDialog($('#end-dialog')));
    // Spectator's own exit — leave the room and return home immediately.
    $('#btn-mp-leave')?.addEventListener('click', () => leaveMultiplayer());
    $('#btn-next').addEventListener('click', advanceAfterFeedback);
    $('#btn-fifty')?.addEventListener('click', useFifty);

    // Desktop: answer with number keys (1–4) or letters (a–d) while a choice
    // question is open. Typing into the fill-in box is never intercepted, and
    // Enter on the focused "Next" button keeps its native behaviour.
    document.addEventListener('keydown', onGameKeydown);

    // fill-in-the-blank answer (submit button + Enter both submit the form)
    $('#fill-form').addEventListener('submit', (e) => {
        e.preventDefault();
        submitFill();
    });

    $('#report-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.submitter?.value === 'cancel') closeDialog($('#report-dialog'));
        else submitLeaderboardReport();
    });

    // Player card (opened by clicking a row in the lobby / in-game player list).
    $('#btn-player-card-close')?.addEventListener('click', () => closeDialog($('#player-card')));
    $('#btn-player-card-invite')?.addEventListener('click', invitePlayersToRoom);
    // Covers every close path (button, Esc, backdrop) so live refreshes stop.
    $('#player-card')?.addEventListener('close', () => { playerCardId = null; });

    // "Show my game on Discord" — apply the moment it's toggled rather than on save.
    $('#set-presence')?.addEventListener('change', () => {
        const cur = store.settings;
        cur.discordPresence = $('#set-presence').checked;
        store.settings = cur;
        pushPresence();
    });

    // A member pressed "Ask to Join" on this game's Discord profile card.
    window.addEventListener('discord-activity-join', (e) => {
        handleDiscordActivityJoin(e.detail?.secret);
    });
    // Connected-participant list changed → an open card may gain a real avatar.
    window.addEventListener('discord-participants', () => refreshPlayerCard());

    [$('#settings-panel'), $('#about-panel'), $('#join-modal'), $('#end-dialog'), $('#report-dialog'), $('#player-card')].forEach((dialog) => {
        if (!dialog) return;
        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            if (dialog === $('#settings-panel')) applySettingsToUI();
            closeDialog(dialog);
        });
        dialog.addEventListener('click', (e) => {
            if (e.target !== dialog) return;
            if (dialog === $('#settings-panel')) applySettingsToUI();
            closeDialog(dialog);
        });
    });

    // results
    $('#btn-challenge').addEventListener('click', challengeFriend);
    $('#btn-replay').addEventListener('click', () => {
        if (state.multiplayer) mpPlayAgain(); // back to the lobby
        else if (state.daily) startDailyChallenge(); // same set; only the first score counts
        else if (state.learn) startPractice();
        else startGame();
    });
    $('#btn-practice')?.addEventListener('click', startPractice);
    $('#btn-new-version')?.addEventListener('click', openNewVersion);
    $('#btn-lobby-new-version')?.addEventListener('click', openNewVersion);
    $('#btn-share-card')?.addEventListener('click', shareResultCard);
    $('#btn-menu').addEventListener('click', () => {
        if (state.multiplayer) {
            leaveMultiplayer(); // leave the room -> main menu
        } else {
            showScreen('home');
            renderHome();
        }
    });

    // keyboard: number keys select the matching option
    document.addEventListener('keydown', (e) => {
        if (!screens.game.classList.contains('active') || state.answered) return;
        const n = parseInt(e.key, 10);
        const buttons = document.querySelectorAll('#options-grid button');
        if (n >= 1 && n <= buttons.length) buttons[n - 1].click();
    });
}

function refreshMenu() {
    $('#menu-highscore-val').textContent = String(store.highScore(state.mode));
}

// Open the leaderboard from the home page (view only — does not submit a score).
function viewLeaderboard() {
    clearTimer();
    if (state.advanceTimer) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    state.score = 0;
    state.correct = 0;
    state.round = [];
    state.viewOnly = true;
    state.daily = false; // this is the mode leaderboard, not the daily board
    state.lbViewMode = state.mode; // open the board on the current mode; switchable in place
    endGame();
}

// Show today's daily board without replaying (used when the player already played today).
function viewDailyResults() {
    state.score = 0;
    state.correct = 0;
    state.round = [];
    state.viewOnly = true;
    state.daily = true;
    endGame();
}

// Populate and show the About dialog (version + total question count).
async function openAbout() {
    const panel = $('#about-panel');
    $('#about-count').textContent = '…';
    openDialog(panel, $('#about-close'));
    try {
        const all = await window.gameAPI.getQuestions('all');
        $('#about-count').textContent = String(all.length);
    } catch {
        $('#about-count').textContent = '—';
    }
    try {
        const v = await window.appWindow ?.getVersion ?.();
        if (v) $('#about-version').textContent = 'v' + v;
    } catch {
        /* ignore */ }
}

// Open an external URL the right way for the current platform: through the
// Discord SDK inside an Activity (plain window.open is sandboxed there), a new
// browser tab on the web, or the OS browser via Electron's shell.
function openExternalUrl(url) {
    if (!url || typeof url !== 'string') return;
    const da = window.DISCORD_ACTIVITY;
    // Discord Activity: external links must go through the SDK (window.open is
    // sandboxed inside the iframe).
    if (da?.active && typeof da.openExternal === 'function') {
        try {
            const r = da.openExternal(url);
            if (r && typeof r.then === 'function') r.catch((e) => console.warn('openExternalLink:', e));
        } catch (e) {
            console.warn('openExternalLink:', e);
        }
        return;
    }
    // Electron desktop: hand off to the OS browser.
    const isWeb = document.documentElement.classList.contains('platform-web');
    if (!isWeb && window.appWindow && typeof window.appWindow.openExternal === 'function') {
        window.appWindow.openExternal(url);
        return;
    }
    // Web: a synthetic <a target="_blank"> click opens a real tab — unlike
    // window.open(...) with a features string, it isn't treated as a popup and
    // so isn't blocked.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Select a mode in place: highlight it, load its bank, enable Start. Stays home.
async function selectMode(mode) {
    state.mode = MODES[mode] ? mode : 'languages';
    localStorage.setItem('gtl_mode', state.mode);
    // Switching away from the challenged mode means the player opted out — drop the
    // pending challenge so the banner and end-of-round verdict don't linger.
    if (state.challenge && state.mode !== state.challenge.mode) hideChallengeBanner();
    renderHome();

    const startBtn = $('#btn-start');
    startBtn.removeAttribute('data-i18n');
    startBtn.disabled = true;
    startBtn.textContent = t('loading');
    try {
        state.allQuestions = await window.gameAPI.getQuestions(state.mode);
    } catch (err) {
        console.error('Failed to load questions:', err);
        state.allQuestions = [];
    }
    if (state.allQuestions.length) {
        updateStartButtonState();
    } else {
        startBtn.removeAttribute('data-i18n');
        startBtn.disabled = true;
        startBtn.textContent = t('loadFail');
    }
}

// ============================================================
//  Boot
// ============================================================
async function boot() {
    // Capture errors to the database from the very first line, before any UI wiring.
    setupErrorLogging();
    // Wire up the UI FIRST so the app is always interactive. The Discord Activity
    // handshake (SDK ready / OAuth / token fetch) has no internal timeout, so if
    // it stalls we must NOT let it block bindEvents — otherwise the page renders
    // but every control is dead ("it does nothing").
    bindEvents();
    applyUiScale(effectiveScale(), hasManualScale()); // manual zoom, else auto-fit the width
    if (window.GTL_MULTIPLAYER) {
        window.GTL_MULTIPLAYER.onUpdate = handleMultiplayerUpdate;
        window.GTL_MULTIPLAYER.onKicked = onMpKicked;
    }
    const savedMode = localStorage.getItem('gtl_mode');
    if (savedMode && MODES[savedMode]) state.mode = savedMode;
    applyLanguage();

    // Inside Discord, show a loading veil while the handshake + auto-join run, so
    // the player sees a spinner rather than a flash of Home before the lobby.
    const bootInDiscord = isDiscordEmbedded();
    if (bootInDiscord) {
        showBootLoading();
        setTimeout(hideBootLoading, 12000); // never let it stick if init never resolves
    }

    // Give the Discord Activity a bounded window to finish initialising; fall
    // through to the normal app if it stalls so the UI is never frozen.
    let discordReadyInTime = false;
    if (window.DISCORD_ACTIVITY?.ready) {
        try {
            await Promise.race([
                Promise.resolve(window.DISCORD_ACTIVITY.ready).then(() => { discordReadyInTime = true; }),
                new Promise((resolve) => setTimeout(resolve, 8000))
            ]);
        } catch (err) {
            console.warn('Discord Activity init:', err);
        }
    }

    // Cold first launches (cold /api/token + OAuth) sometimes finish the handshake
    // AFTER the bounded wait above — the identity would then be missing and the
    // player would have to close & relaunch just to get their name read. If the
    // handshake didn't land in time, re-apply the Discord-dependent UI (name,
    // multiplayer buttons, room join) the moment it does. Self-heals without a
    // relaunch.
    if (!discordReadyInTime && window.DISCORD_ACTIVITY?.ready?.then) {
        window.DISCORD_ACTIVITY.ready.then((session) => {
            if (session) onDiscordSessionReady();
        }).catch(() => {});
    }

    // Complete a "Login with Discord" if we were just redirected back with a code
    // (sets the leaderboard name before the settings UI is populated).
    await handleDiscordOAuthReturn();

    // A friend who launched from a "Challenge a friend" DM/link arrives with the
    // challenger's mode + settings + score — in Discord via the Activity
    // custom_id, on the web via a ?challenge= URL param. Preload those and land on
    // the home screen (with a "beat my score" banner) instead of auto-joining.
    const challengeInfo =
        (isDiscordActivity() ? parseChallengePayload(window.DISCORD_ACTIVITY.customId) : null)
        || getChallengeFromUrl();
    if (challengeInfo) applyChallengeSettings(challengeInfo);

    applySettingsToUI();
    refreshMultiplayerButtons();

    if (isDiscordActivity() && !challengeInfo) {
        const joined = await autoJoinDiscordVoiceRoom();
        if (joined) { hideBootLoading(); return; }
    }

    // Reveal Home. Keep the veil up only when we're still inside Discord waiting
    // on a late handshake that will auto-join us — onDiscordSessionReady lifts it
    // then (or the 12s safety timeout does).
    const awaitingLateJoin = bootInDiscord && !challengeInfo && !isDiscordActivity();
    if (!awaitingLateJoin) hideBootLoading();
    showScreen('home');
    selectMode(state.mode);
    updateAdminButton();
    startHeartbeat();
    if (challengeInfo) showChallengeBanner(challengeInfo);
    else setTimeout(maybeShowOnboarding, 500); // first-run welcome (once)
}

function showBootLoading() { $('#boot-loading')?.classList.remove('hidden'); }
function hideBootLoading() { $('#boot-loading')?.classList.add('hidden'); }

// Interface scaling — 4K displays render the Activity very small, so let the player
// zoom the whole UI. Uses Chromium's `zoom` (Electron / Discord / Chrome are all
// Chromium), persisted across launches.
const UI_SCALE_MIN = 0.8, UI_SCALE_MAX = 2.0, UI_SCALE_STEP = 0.1;
// The content is laid out around this width, then scaled up to fill wider windows
// (the Discord Activity panel is very wide, leaving the game tiny and centered).
const AUTOFIT_REF = 900;
// Manual override is a DISTINCT flag (not just the presence of gtl_ui_scale, which
// older builds auto-persisted for everyone) so existing users still get auto-fit.
function hasManualScale() { return localStorage.getItem('gtl_ui_manual') === '1'; }
function getUiScale() {
    const v = parseFloat(localStorage.getItem('gtl_ui_scale'));
    return Number.isFinite(v) ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, v)) : 1;
}
// Auto scale-to-fill for wide viewports; never shrinks below 1 (narrow screens keep
// their normal responsive layout). Only used when the player hasn't set a manual zoom.
function autoFitScale() {
    try {
        const w = window.innerWidth || document.documentElement.clientWidth || 1000;
        return Math.min(UI_SCALE_MAX, Math.max(1, Math.round((w / AUTOFIT_REF) * 100) / 100));
    } catch (e) { return 1; }
}
function effectiveScale() { return hasManualScale() ? getUiScale() : autoFitScale(); }
// Re-fit when the window resizes (Discord panel resize, window drag) — but only
// while the player is on auto (no manual zoom set).
let __autofitTimer = null;
function applyAutoFit() {
    if (hasManualScale()) return;
    applyUiScale(autoFitScale(), false);
}
window.addEventListener('resize', () => {
    if (__autofitTimer) clearTimeout(__autofitTimer);
    __autofitTimer = setTimeout(applyAutoFit, 150);
});
function applyUiScale(scale, persist = true) {
    const s = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(scale * 100) / 100));
    const root = document.documentElement;
    const app = document.getElementById('app');
    const scaled = Math.abs(s - 1) > 0.001;
    // Responsive scaling (not plain `zoom`): transform-scale #app while dividing its
    // layout width by the same factor, so content REFLOWS into the narrower effective
    // width and always fits horizontally — no clipped buttons. Taller enlarged content
    // scrolls vertically. Applied INLINE (the equivalent CSS rule was being dropped by
    // a cascade quirk against the media-query #app rules); the class drives the body /
    // screen scroll overrides.
    root.style.zoom = '';
    root.style.setProperty('--ui-scale', String(s));
    root.classList.toggle('ui-scaled', scaled);
    if (app) {
        if (scaled) {
            app.style.transformOrigin = '0 0';
            app.style.transform = `scale(${s})`;
            app.style.width = `calc(100% / ${s})`;
            app.style.minHeight = `calc((100vh - var(--tb-h, 0px)) / ${s})`;
            app.style.height = 'auto';
            app.style.overflow = 'visible';
            app.style.display = 'block';
        } else {
            for (const p of ['transformOrigin', 'transform', 'width', 'minHeight', 'height', 'overflow', 'display']) {
                app.style[p] = '';
            }
        }
    }
    if (persist) localStorage.setItem('gtl_ui_scale', String(s));
    const label = $('#ui-scale-value');
    if (label) label.textContent = Math.round(s * 100) + '%';
    return s;
}
// Manual +/- from Settings sets a persistent override (turns auto-fit off).
function nudgeUiScale(delta) {
    try { localStorage.setItem('gtl_ui_manual', '1'); } catch (e) {}
    applyUiScale(effectiveScale() + delta, true);
}
// Reset back to automatic width-fitting.
function resetUiScale() {
    try { localStorage.removeItem('gtl_ui_manual'); localStorage.removeItem('gtl_ui_scale'); } catch (e) {}
    applyUiScale(autoFitScale(), false);
}

boot();
