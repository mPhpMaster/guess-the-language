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
        name: 'C++',
        glyph: 'C++',
        color: 'linear-gradient(135deg,#6aa9e0,#2b69b3)'
    },
    {
        name: 'Java',
        glyph: '☕',
        color: 'linear-gradient(135deg,#f89820,#c8442b)'
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
        endQuiz: 'End',
        correctLabel: 'Correct:',
        aboutTitle: 'About',
        aboutDesc: 'A bilingual (EN / AR) IT quiz game: programming languages, cybersecurity, DevOps & networking.',
        aboutQuestions: 'Questions:',
        close: 'Close',
        start: '▶  Start',
        friends: '👥  Friends & Scores',
        settings: '⚙  Settings',
        bestScore: 'Best score:',
        settingsTitle: 'Settings',
        settingLanguage: 'Language',
        settingName: 'Your leaderboard name',
        settingNameDiscord: 'Your name (from Discord)',
        settingQuestions: 'Questions per round',
        settingSound: 'Sound effects',
        settingDifficulty: 'Difficulty',
        diffAll: 'All',
        diffEasy: 'Easy',
        diffMedium: 'Medium',
        diffHard: 'Hard',
        save: 'Save & Close',
        score: 'Score:',
        question: 'Question',
        finalScore: 'Final Score:',
        comparison: 'Friends Comparison',
        globalLeaderboard: '🏆 Global Leaderboard',
        challenge: '🔗  Challenge a friend',
        replay: '🔄  Play again',
        backMenu: '🏠  Main menu',
        you: '(YOU)',
        lbLoading: 'Loading leaderboard…',
        lbOnline: '🌐 Global leaderboard (Supabase)',
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
        modeAll: 'All (Mixed)',
        modeAllDesc: 'Everything: all five banks together',
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
        loginDiscord: '💬  Login with Discord',
        loginDiscordToPlay: 'Sign in with Discord to play',
        logoutDiscord: '🚪  Log out',
        discordLinkedAs: 'Signed in as',
        discordLoginFailed: 'Discord login failed. Please try again.',
        roomCode: 'Room code',
        copyCode: 'Copy',
        playersTitle: 'Players',
        waitingHost: 'Waiting for host…',
        startGame: '▶  Start Game',
        endRoom: 'End Room',
        endGame: 'End Game',
        leaveRoom: 'Leave',
        joinConfirm: 'Join',
        adminBadge: 'Host',
        kickPlayer: 'Remove',
        roomResults: 'Room Results',
        mpNeedOnline: 'Multiplayer requires Supabase — see README',
        mpJoinFail: 'Could not join room',
        mpHostFail: 'Could not create room',
        codeCopied: '✅ Code copied!',
        mpKicked: 'You were removed from the room',
        waitingOpponents: '⏳ Waiting for opponents…',
        lobbySettings: 'Game settings',
        settingTimer: 'Time per question',
        timerAuto: 'Auto (by difficulty)',
        multiplayerScore: 'Multiplayer score',
        nameRequired: 'Please enter your name before starting the game.',
        nameTaken: 'That name is already taken on the leaderboard. Please choose another one.',
        leaderboardFor: 'Leaderboard for'
    },
    ar: {
        appTitle: 'خمّن اللغة',
        homeSub: 'اختر نمطاً وتغلّب على المؤقّت',
        langPrompt: 'ما هذه اللغة؟',
        endQuiz: 'إنهاء',
        correctLabel: 'الإجابات الصحيحة:',
        aboutTitle: 'حول التطبيق',
        aboutDesc: 'لعبة اختبارات تقنية بالعربية والإنجليزية: لغات البرمجة والأمن السيبراني وDevOps والشبكات.',
        aboutQuestions: 'عدد الأسئلة:',
        close: 'إغلاق',
        start: '▶  ابدأ اللعب',
        friends: '👥  الأصدقاء والنتائج',
        settings: '⚙  الإعدادات',
        bestScore: 'أفضل نتيجة:',
        settingsTitle: 'الإعدادات',
        settingLanguage: 'اللغة',
        settingName: 'اسمك في لوحة الصدارة',
        settingNameDiscord: 'اسمك (من Discord)',
        settingQuestions: 'عدد الأسئلة في الجولة',
        settingSound: 'المؤثرات الصوتية',
        settingDifficulty: 'الصعوبة',
        diffAll: 'الكل',
        diffEasy: 'سهل',
        diffMedium: 'متوسط',
        diffHard: 'صعب',
        save: 'حفظ وإغلاق',
        score: 'النقاط:',
        question: 'سؤال',
        finalScore: 'النتيجة النهائية:',
        comparison: 'مقارنة الأصدقاء',
        globalLeaderboard: '🏆 لوحة الصدارة العالمية',
        challenge: '🔗  تحدَّ صديقاً',
        replay: '🔄  إعادة اللعب',
        backMenu: '🏠  القائمة الرئيسية',
        you: '(أنت)',
        lbLoading: 'جارٍ تحميل لوحة الصدارة…',
        lbOnline: '🌐 لوحة الصدارة العالمية (Supabase)',
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
        modeAll: 'الكل (مدمج)',
        modeAllDesc: 'كل شيء: البنوك الخمسة معاً',
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
        loginDiscord: '💬  تسجيل الدخول عبر Discord',
        loginDiscordToPlay: 'سجّل الدخول عبر Discord للّعب',
        logoutDiscord: '🚪  تسجيل الخروج',
        discordLinkedAs: 'مسجّل الدخول باسم',
        discordLoginFailed: 'فشل تسجيل الدخول عبر Discord. حاول مرة أخرى.',
        roomCode: 'رمز الغرفة',
        copyCode: 'نسخ',
        playersTitle: 'اللاعبون',
        waitingHost: 'بانتظار المضيف…',
        startGame: '▶  بدء اللعب',
        endRoom: 'إنهاء الغرفة',
        endGame: 'إنهاء اللعبة',
        leaveRoom: 'مغادرة',
        joinConfirm: 'انضم',
        adminBadge: 'مضيف',
        kickPlayer: 'إزالة',
        roomResults: 'نتائج الغرفة',
        mpNeedOnline: 'اللعب الجماعي يتطلب Supabase — راجع README',
        mpJoinFail: 'تعذّر الانضمام للغرفة',
        mpHostFail: 'تعذّر إنشاء الغرفة',
        codeCopied: '✅ تم نسخ الرمز!',
        mpKicked: 'تمت إزالتك من الغرفة',
        waitingOpponents: '⏳ بانتظار الخصوم…',
        lobbySettings: 'إعدادات اللعبة',
        settingTimer: 'مدة كل سؤال',
        timerAuto: 'تلقائي (حسب الصعوبة)',
        multiplayerScore: 'نتيجة جماعية',
        nameRequired: 'يرجى إدخال اسمك قبل بدء اللعبة.',
        nameTaken: 'هذا الاسم مستخدم بالفعل في لوحة الصدارة. يرجى اختيار اسم آخر.',
        leaderboardFor: 'لوحة الصدارة لـ'
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
    all: {
        key: 'all',
        icon: '🎲',
        title: {
            en: ['All', 'Mixed Quiz'],
            ar: ['الكل', 'اختبار شامل']
        },
        desc: {
            en: 'Everything mixed: all five banks together',
            ar: 'كل شيء مدمج: البنوك الخمسة معاً'
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
        c.classList.toggle('selected', c.dataset.mode === state.mode);
    });
    refreshMenu();
    refreshMultiplayerButtons();
}

// ---------- Persistent settings / high score ----------
const store = {
    highScore(mode) {
        return Number(localStorage.getItem(`gtl_highscore_${mode}`) || 0);
    },
    setHighScore(mode, v) {
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
    name: ''
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
    mpResultsShown: false
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
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
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

const sfx = {
    correct() {
        note(659, 0, 0.16, 0.12);
        note(988, 0.10, 0.24, 0.10);
    }, // soft rising chime
    wrong() {
        note(311, 0, 0.20, 0.10);
        note(233, 0.11, 0.30, 0.08);
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

// On the plain web build a Discord sign-in is required before playing (inside an
// Activity you're already signed in; Electron can't do the OAuth redirect).
function requiresDiscordLogin() {
    return document.documentElement.classList.contains('platform-web') && !isDiscordActivity();
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

function discordAvatarUrl(user) {
    if (user && user.id && user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    }
    return null;
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
            if (nameEl) nameEl.textContent = profile.name;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
    const cta = $('#home-login-cta');
    if (cta) cta.classList.toggle('hidden', !(requiresDiscordLogin() && !isDiscordLinked()));
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
    const area = web && configured && !isDiscordActivity();
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
    try {
        window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {
        /* ignore */
    }

    if (!savedState || savedState !== params.get('state')) {
        console.warn('Discord OAuth state mismatch — ignoring callback');
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
        localStorage.setItem('gtl_discord_user', JSON.stringify({ id: user.id, name, avatar: user.avatar || null }));
        return true;
    } catch (e) {
        console.error('Discord login:', e);
        alert(t('discordLoginFailed'));
        return false;
    }
}

function applySettingsToUI() {
    const s = getSettings();
    $('#set-language').value = getLang();
    if (!isDiscordActivity()) {
        $('#set-name').value = s.name || '';
    }
    $('#set-questions').value = String(s.questions);
    $('#set-sound').checked = !!s.sound;
    $('#set-difficulty').value = s.difficulty;
    syncDiscordNameField();
    updateDiscordLoginButton();
    updateHomeProfile();
    updateStartButtonState();
}

function saveSettingsFromUI() {
    // Guard against an empty / non-option #set-questions value writing a
    // 0-question round: fall back to the current or default question count.
    const q = Number($('#set-questions').value);
    store.settings = {
        name: isDiscordLinked()
            ? (getSettings().name || '')
            : sanitizeName($('#set-name').value),
        questions: q > 0 ? q : (getSettings().questions || defaultSettings.questions),
        sound: $('#set-sound').checked,
        difficulty: $('#set-difficulty').value
    };
    updateStartButtonState();
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
    if (isDiscordActivity()) {
        return getDiscordDisplayName() || 'User';
    }
    const name = getPlayerNameInputValue();
    return name || 'User';
}

function openSettingsPanel() {
    $('#settings-panel').classList.remove('hidden');
    $('#about-panel').classList.add('hidden');
    const nameInput = $('#set-name');
    if (nameInput) {
        nameInput.focus();
        nameInput.select();
    }
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

    const lower = candidate.toLowerCase();
    const isReturningName = lower && previousName && lower === previousName;

    if (supabaseConfigured() && !isReturningName) {
        try {
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
        startBtn.disabled = !(hasQuestions && canPlay());
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
    alert(t('nameRequired'));
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

function scoreAnswer(timeLeft, streakAfter) {
    const multiplier = streakAfter >= 3 ? 1.5 : 1;
    return Math.round((100 + 10 * Math.max(0, timeLeft)) * multiplier);
}

function timeForDifficulty(d) {
    return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
}

function buildRoundFromPool(pool, settings) {
    let filtered = pool;
    if (settings.difficulty !== 'all') filtered = pool.filter((q) => q.difficulty === settings.difficulty);
    if (filtered.length === 0) filtered = pool;
    return shuffle(filtered).slice(0, Math.min(settings.questions, filtered.length));
}

function buildRound() {
    state.round = buildRoundFromPool(state.allQuestions, getSettings());
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
        alert(nameCheck.message || t('nameRequired'));
        return;
    }

    buildRound();
    state.index = 0;
    state.score = 0;
    state.correct = 0;
    state.streak = 0;
    state.viewOnly = false;
    state.selectedAnswer = null;
    updateScore();
    updateCorrect();
    updateStreakPill();
    $('#q-total').textContent = String(state.round.length);
    $('#correct-total').textContent = String(state.round.length);
    updateInGameProfile();
    showScreen('game');
    nextQuestion();
}

// Turn a raw question into a uniform shape for rendering. The type is detected
// per-question (by its fields) so the "All" mode can mix both kinds in a round.
function normalizeQuestion(q, opts) {
    const optionSeed = opts && opts.optionSeed != null ? opts.optionSeed : null;
    const isCyber = Array.isArray(q.options) && q.answer != null;
    if (isCyber) {
        const hasCmd = !!(q.codeSnippet && q.codeSnippet.trim().length);
        return {
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
    return {
        style: 'languages',
        panelText: q.codeSnippet,
        panelIsCode: true,
        questionText: t('langPrompt'),
        options: LANGUAGES.map((l) => ({
            label: l.name,
            glyph: l.glyph,
            color: l.color
        })),
        answer: q.correctLanguage,
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
    renderOptions(cur, false);
    // window.__GTL_QTIME is a headless-test seam to shorten the countdown; it is
    // undefined in normal play, so real games always use the per-difficulty time.
    state.questionTime = (typeof window.__GTL_QTIME === 'number' && window.__GTL_QTIME > 0)
        ? window.__GTL_QTIME
        : timeForDifficulty(cur.difficulty);
    startTimer(state.questionTime);
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

function onAnswer(chosen, btn) {
    if (state.answered) return;
    state.selectedAnswer = chosen;
    clearSelectedOption();
    if (btn) {
        btn.classList.add('selected');
    }
    // Once a choice is locked in, don't make the player wait out a long timer:
    // if more than 2s remain, fast-forward the countdown to 2s (the answer stays
    // changeable during that window, then resolves).
    if (state.timeLeft > 2) {
        state.timeLeft = 2;
        updateTimerDisplay();
        setRing(state.timeLeft / state.questionTime);
    }
}

function resolveCurrentQuestion(chosen, timedOut = false) {
    if (state.answered) return;
    state.answered = true;
    clearTimer();
    const cur = state.current;
    const correct = chosen === cur.answer;
    const buttons = Array.from(document.querySelectorAll('#options-grid button'));
    buttons.forEach((b) => {
        b.disabled = true;
        b.classList.remove('selected');
    });
    buttons.forEach((b) => {
        if (b.dataset.answer === cur.answer) b.classList.add('correct');
    });

    if (correct) {
        state.streak += 1;
        state.correct += 1;
        const gained = scoreAnswer(state.timeLeft, state.streak);
        state.score += gained;
        sfx.correct();
        updateScore(true);
        updateCorrect();
        showToast(`${t('correct')} +${gained}${state.streak >= 3 ? '  ' + t('streakBonus') : ''}  —  ${cur.explanation[getLang()]}`, 'good');
    } else {
        state.streak = 0;
        if (chosen) {
            const selectedBtn = Array.from(buttons).find((b) => b.dataset.answer === chosen);
            if (selectedBtn) {
                selectedBtn.classList.add('wrong', 'shake');
            }
        }
        sfx.wrong();
        showToast(`${t('wrong')} ${cur.answer}.  ${cur.explanation[getLang()]}`, 'bad');
    }

    updateStreakPill();
    if (state.multiplayer) return;
    state.index += 1;
    state.advanceTimer = setTimeout(nextQuestion, 1900);
}

function onAnswerMultiplayer(chosen, btn) {
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
    const hadPick = !!state.selectedAnswer;
    // resolveCurrentQuestion already shows the correct/wrong feedback (and
    // handles the streak + score) for whatever the player picked. Only when
    // NOTHING was picked do we replace it with the red "time's up" message.
    resolveCurrentQuestion(state.selectedAnswer, true);
    if (!hadPick && !state.multiplayer) {
        showToast(`${t('timeUp')} ${cur.answer}.  ${cur.explanation[getLang()]}`, 'bad');
    }
    updateStreakPill();
}

function onTimeoutMultiplayer() {
    if (state.answered) return;
    state.answered = true;
    state.mpChosen = '';
    document.querySelectorAll('#options-grid button').forEach((b) => {
        b.disabled = true;
    });
    // The shared deadline has passed; the reveal follows almost immediately.
    showMpWaiting();
    window.GTL_MULTIPLAYER.submitAnswer('', 0)
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

function showToast(text, kind) {
    const t = $('#answer-toast');
    t.textContent = text;
    t.className = `toast show ${kind}`;
}

function hideToast() {
    $('#answer-toast').className = 'toast';
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
    $('#btn-replay').classList.remove('hidden');
    $('#btn-replay').textContent = t('replay');
    $('#btn-menu').textContent = t('backMenu');
    $('.results-sub').textContent = `${t('leaderboardFor')} ${currentModeLabel()}`;

    if (!viewOnly) {
        countUp($('#final-score'), state.score, 900);
        $('#results-correct').textContent = String(state.correct);
        $('#results-total').textContent = String(state.round.length);
    }
    await buildResultsLeaderboard();
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
    return res.status === 204 ? null : res.json();
}

function submitScore(player, score, mode = state.mode, multiplayer = false) {
    return sbFetch('scores', {
        method: 'POST',
        headers: {
            Prefer: 'return=representation'
        },
        body: JSON.stringify([{
            player,
            score,
            mode,
            multiplayer
        }])
    }).then((rows) => (Array.isArray(rows) ? rows[0] : null));
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
        body: JSON.stringify(rows)
    });
}

function fetchTopScores(limit = 10) {
    return sbFetch(`scores?select=id,player,score,multiplayer&mode=eq.${state.mode}&order=score.desc&limit=${limit}`);
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

async function buildResultsLeaderboard() {
    const note = $('#lb-note');
    const playerName = getPlayerName();

    if (supabaseConfigured()) {
        note.className = 'lb-note';
        note.textContent = t('lbLoading');
        try {
            // Only submit a real score; viewing scores (score 0) must not write a row.
            const me = state.score > 0 ? await submitScore(playerName, state.score) : null;
            const top = await fetchTopScores(10);
            const list = (top || []).map((r) => ({
                id: r.id,
                name: r.player,
                avatar: avatarFor(r.player),
                score: r.score,
                multiplayer: !!r.multiplayer,
                you: false
            }));
            if (state.score > 0) {
                const myAvatar = discordAvatarUrl(getDiscordProfile()) || avatarFor(playerName);
                // Flag the player's row (by inserted id, else by name+score heuristic).
                let mine = me ? list.find((p) => p.id === me.id) : null;
                if (!mine) mine = list.find((p) => !p.you && p.name === playerName && p.score === state.score);
                if (mine) {
                    mine.you = true;
                    mine.avatar = myAvatar;
                } else list.push({
                    id: -1,
                    name: playerName,
                    avatar: myAvatar,
                    score: state.score,
                    you: true
                });
            }

            $('.results-sub').textContent = t('globalLeaderboard');
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
        const label = document.createElement('div');
        label.className = 'lb-bar-fill';
        label.textContent = `${p.name}${placementBadge ? ` ${placementBadge}` : ''} — ${p.score} pts`;
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

function challengeFriend() {
    const text = challengeText(state.score);
    navigator.clipboard ?.writeText(text).then(
        () => flashButton('#btn-challenge', t('challengeCopied')),
        () => flashButton('#btn-challenge', String(state.score))
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
//  Multiplayer UI
// ============================================================
function mpOnline() {
    return window.GTL_MULTIPLAYER && window.GTL_MULTIPLAYER.configured();
}

function refreshMultiplayerButtons() {
    const on = mpOnline();
    const discord = isDiscordActivity();
    const mpRow = document.querySelector('.home-mp-actions');
    if (mpRow) mpRow.classList.toggle('hidden', discord);
    const discordNote = $('#discord-mp-note');
    if (discordNote) discordNote.classList.toggle('hidden', !discord);
    // Hosting or joining needs an online connection plus a playable identity
    // (a name, or a Discord sign-in where that's required).
    const ready = canPlay();
    const enable = on && ready;
    $('#btn-host').disabled = !enable;
    $('#btn-join').disabled = !enable;
    if (!enable) {
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
        av.textContent = vis.icon;
        av.style.background = vis.color + '22';
        av.style.boxShadow = 'inset 0 0 0 2px ' + vis.color;
        const name = document.createElement('div');
        name.className = 'mp-player-name';
        name.textContent = p.name + (p.id === mp.playerId ? ` ${t('you')}` : '');
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
            kick.addEventListener('click', () => {
                window.GTL_MULTIPLAYER.kickPlayer(p.id).catch((e) => console.error(e));
            });
            row.appendChild(kick);
        }
        if (compact) {
            name.textContent = p.name;
            row.title = `${p.name}: ${p.score}`;
        }
        el.appendChild(row);
    });
}

function syncMpHudFromPlayers() {
    const me = window.GTL_MULTIPLAYER.state.players.find((p) => p.id === window.GTL_MULTIPLAYER.state.playerId);
    if (!me) return;
    state.score = me.score;
    state.correct = me.correct;
    state.streak = me.streak;
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

    const canStart = isAdmin && players.length >= 2 && room ?.status === 'lobby';
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
        timer: timerVal === 'auto' ? 'auto' : Number(timerVal)
    };
    window.GTL_MULTIPLAYER.updateRoomSettings(mode, settings)
        .catch((e) => {
            console.error(e);
            alert(e.message);
        });
}

function showMpGameChrome(room) {
    $('#mp-game-strip').classList.remove('hidden');
    $('#mp-room-code').textContent = room.code;
    $('#btn-end').classList.toggle('hidden', !window.GTL_MULTIPLAYER.state.isAdmin);
    updateInGameProfile();
    renderMpPlayerList('#mp-game-players', window.GTL_MULTIPLAYER.state.players, {
        compact: true,
        showKick: false
    });
}

function hideMpGameChrome() {
    $('#mp-game-strip').classList.add('hidden');
    $('#btn-end').classList.remove('hidden');
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
    renderOptions(cur, false);
    state.questionTime = ref.duration || timeForDifficulty(cur.difficulty);
    syncMpHudFromPlayers();
    startTimerFromServer();
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
    if (chosen && chosen === ans) {
        sfx.correct();
        showToast(`${t('correct')}  —  ${cur.explanation[getLang()]}`, 'good');
    } else if (chosen) {
        sfx.wrong();
        showToast(`${t('wrong')} ${ans}.  ${cur.explanation[getLang()]}`, 'bad');
    } else {
        sfx.wrong();
        showToast(`${t('timeUp')} ${ans}.  ${cur.explanation[getLang()]}`, 'bad');
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
    $('#btn-challenge').classList.add('hidden');
    $('#btn-replay').classList.remove('hidden');
    $('#btn-replay').textContent = t('replay'); // "Play again" -> back to lobby
    $('#btn-menu').textContent = t('leaveRoom'); // "Leave" -> main menu

    const me = players.find((p) => p.id === mpState.playerId);
    countUp($('#final-score'), me ? me.score : 0, 900);
    $('#results-correct').textContent = String(me ? me.correct : 0);
    $('#results-total').textContent = String(
        (state.mpRound && state.mpRound.length) ||
        (mpState.room && mpState.room.round_refs && mpState.room.round_refs.length) || 0
    );
    $('.results-sub').textContent = t('roomResults');
    renderLeaderboard(window.GTL_MULTIPLAYER.getRoomLeaderboard(avatarFor));
    $('#lb-note').className = 'lb-note';
    $('#lb-note').textContent = '';

    if (!state.mpResultsShown) {
        sfx.finish();
        state.mpResultsShown = true;
        registerMpScores();
    }
}

// Register every player's final score in the global leaderboard, flagged as a
// multiplayer result. The host submits once for the whole room (one row each).
function registerMpScores() {
    if (!supabaseConfigured()) return;
    const mpState = window.GTL_MULTIPLAYER.state;
    if (!mpState.isAdmin) return;
    const mode = (mpState.room && mpState.room.mode) || state.mode;
    const rows = mpState.players.map((p) => ({
        player: p.name,
        score: p.score,
        mode,
        multiplayer: true
    }));
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
            alert(e.message);
        });
    } else {
        renderLobby(mpState.room, mpState.players);
        showScreen('lobby');
    }
}

function handleMultiplayerUpdate(room, players) {
    if (!room) return;

    if (room.status === 'lobby') {
        // Fresh lobby, or back from a finished game via "Play again".
        state.multiplayer = true;
        state.mpSyncKey = '';
        state.mpResultsShown = false;
        clearTimer();
        hideMpStatus();
        hideMpGameChrome();
        renderLobby(room, players);
        if (!screens.lobby.classList.contains('active')) showScreen('lobby');
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
            renderLeaderboard(window.GTL_MULTIPLAYER.getRoomLeaderboard(avatarFor));
        }
        return;
    }

    if (room.status === 'playing') {
        state.multiplayer = true;
        state.mpResultsShown = false;
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
        }
        syncMpHudFromPlayers();
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
    showScreen('home');
    selectMode(state.mode);
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

async function autoJoinDiscordVoiceRoom() {
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
        renderLobby(window.GTL_MULTIPLAYER.state.room, window.GTL_MULTIPLAYER.state.players);
        showScreen('lobby');
        return true;
    } catch (err) {
        console.error('Discord voice room join failed:', err);
        if (note) note.textContent = t('discordMpUnavailable');
        return false;
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
        alert(t('mpHostFail') + ': ' + e.message);
    }
}

function openJoinModal() {
    if (!mpOnline()) return;
    if (!requireNameToInteract()) return;
    saveSettingsFromUI();
    $('#join-code').value = '';
    $('#join-error').classList.add('hidden');
    $('#join-modal').classList.remove('hidden');
}

function closeJoinModal() {
    $('#join-modal').classList.add('hidden');
}

async function confirmJoinRoom() {
    const code = window.GTL_MULTIPLAYER.normalizeCode($('#join-code').value);
    if (code.length !== 4) {
        $('#join-error').textContent = t('roomCode');
        $('#join-error').classList.remove('hidden');
        return;
    }
    try {
        await loadAllBanks();
        await window.GTL_MULTIPLAYER.joinRoom(code, getPlayerName());
        closeJoinModal();
        state.multiplayer = true;
        state.viewOnly = false;
        showScreen('lobby');
        renderLobby(window.GTL_MULTIPLAYER.state.room, window.GTL_MULTIPLAYER.state.players);
    } catch (e) {
        $('#join-error').textContent = t('mpJoinFail') + ': ' + e.message;
        $('#join-error').classList.remove('hidden');
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
        alert(e.message);
    }
}

async function leaveMultiplayer() {
    await window.GTL_MULTIPLAYER.leaveRoom();
    returnHome();
}

function onMpKicked() {
    alert(t('mpKicked'));
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
    $('#set-language').addEventListener('change', () => setLang($('#set-language').value));

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
    $('#btn-friends').addEventListener('click', viewLeaderboard);
    $('#btn-settings').addEventListener('click', () => {
        $('#about-panel').classList.add('hidden');
        applySettingsToUI();
        $('#settings-panel').classList.toggle('hidden');
    });
    $('#set-close').addEventListener('click', () => {
        saveSettingsFromUI();
        $('#settings-panel').classList.add('hidden');
        applyLanguage();
    });
    $('#set-name').addEventListener('input', () => updateStartButtonState());
    $('#btn-discord-login')?.addEventListener('click', startDiscordLogin);
    $('#btn-discord-logout')?.addEventListener('click', discordLogout);
    $('#home-login-cta')?.addEventListener('click', startDiscordLogin);

    // about
    $('#btn-about').addEventListener('click', () => {
        $('#settings-panel').classList.add('hidden');
        openAbout();
    });
    $('#about-close').addEventListener('click', () => $('#about-panel').classList.add('hidden'));
    document.querySelectorAll('.about-link, .about-legal-link').forEach((b) => {
        b.addEventListener('click', (event) => {
            event.preventDefault();
            // Buttons carry data-url; the legal <a> links carry an href (already
            // resolved to an absolute URL by the browser).
            openExternalUrl(b.dataset.url || b.href);
        });
    });

    // game — end the quiz early
    $('#btn-end').addEventListener('click', endQuiz);

    // results
    $('#btn-challenge').addEventListener('click', challengeFriend);
    $('#btn-replay').addEventListener('click', () => {
        if (state.multiplayer) mpPlayAgain(); // back to the lobby
        else startGame();
    });
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
    endGame();
}

// Populate and show the About dialog (version + total question count).
async function openAbout() {
    const panel = $('#about-panel');
    $('#about-count').textContent = '…';
    panel.classList.remove('hidden');
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
        startBtn.setAttribute('data-i18n', 'start'); // let language switches keep it in sync
        startBtn.textContent = t('start');
    } else {
        startBtn.textContent = t('loadFail');
    }
}

// ============================================================
//  Boot
// ============================================================
async function boot() {
    // Wire up the UI FIRST so the app is always interactive. The Discord Activity
    // handshake (SDK ready / OAuth / token fetch) has no internal timeout, so if
    // it stalls we must NOT let it block bindEvents — otherwise the page renders
    // but every control is dead ("it does nothing").
    bindEvents();
    if (window.GTL_MULTIPLAYER) {
        window.GTL_MULTIPLAYER.onUpdate = handleMultiplayerUpdate;
        window.GTL_MULTIPLAYER.onKicked = onMpKicked;
    }
    const savedMode = localStorage.getItem('gtl_mode');
    if (savedMode && MODES[savedMode]) state.mode = savedMode;
    applyLanguage();

    // Give the Discord Activity a bounded window to finish initialising; fall
    // through to the normal app if it stalls so the UI is never frozen.
    if (window.DISCORD_ACTIVITY?.ready) {
        try {
            await Promise.race([
                window.DISCORD_ACTIVITY.ready,
                new Promise((resolve) => setTimeout(resolve, 8000))
            ]);
        } catch (err) {
            console.warn('Discord Activity init:', err);
        }
    }

    // Complete a "Login with Discord" if we were just redirected back with a code
    // (sets the leaderboard name before the settings UI is populated).
    await handleDiscordOAuthReturn();

    applySettingsToUI();
    refreshMultiplayerButtons();

    if (isDiscordActivity()) {
        const joined = await autoJoinDiscordVoiceRoom();
        if (joined) return;
    }

    showScreen('home');
    selectMode(state.mode);
}

boot();