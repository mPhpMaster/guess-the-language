'use strict';

/* ============================================================
   Guess the Programming Language — renderer / game logic
   ============================================================ */

// ---------- The six fixed answer options (order matches mockup) ----------
const LANGUAGES = [
  { name: 'Python',     glyph: '🐍',  color: 'linear-gradient(135deg,#4f8fc0,#2b5b87)' },
  { name: 'JavaScript', glyph: 'JS',  color: 'linear-gradient(135deg,#f7df1e,#e0c500)' },
  { name: 'C++',        glyph: 'C++', color: 'linear-gradient(135deg,#6aa9e0,#2b69b3)' },
  { name: 'Java',       glyph: '☕',  color: 'linear-gradient(135deg,#f89820,#c8442b)' },
  { name: 'Rust',       glyph: '🦀',  color: 'linear-gradient(135deg,#e8b18a,#b7560f)' },
  { name: 'Go',         glyph: '🐹',  color: 'linear-gradient(135deg,#7fd5ea,#00add8)' }
];

// ---------- Mock friends for the comparison screen ----------
const FRIENDS = [
  { name: 'Ahmed', avatar: '🧔🏽', score: 2450 },
  { name: 'Sarah', avatar: '👩🏼', score: 2180 },
  { name: 'Omar',  avatar: '🧑🏻', score: 1920 },
  { name: 'Layla', avatar: '👩🏻‍🦰', score: 1750 }
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
    settingQuestions: 'Questions per round',
    settingSound: 'Sound effects',
    settingDifficulty: 'Difficulty',
    diffAll: 'All', diffEasy: 'Easy', diffMedium: 'Medium', diffHard: 'Hard',
    save: 'Save & Close',
    score: 'Score:',
    question: 'Question',
    finalScore: 'Final Score:',
    comparison: 'Friends Comparison',
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
    modeAll: 'All (Mixed)',
    modeAllDesc: 'Everything: all four banks together',
    changeMode: 'Modes',
    diff: { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
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
    settingQuestions: 'عدد الأسئلة في الجولة',
    settingSound: 'المؤثرات الصوتية',
    settingDifficulty: 'الصعوبة',
    diffAll: 'الكل', diffEasy: 'سهل', diffMedium: 'متوسط', diffHard: 'صعب',
    save: 'حفظ وإغلاق',
    score: 'النقاط:',
    question: 'سؤال',
    finalScore: 'النتيجة النهائية:',
    comparison: 'مقارنة الأصدقاء',
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
    modeAll: 'الكل (مدمج)',
    modeAllDesc: 'كل شيء: البنوك الأربعة معاً',
    changeMode: 'الأنماط',
    diff: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' }
  }
};

// ---------- Game modes ----------
const MODES = {
  languages: {
    key: 'languages',
    icon: '💻',
    title: { en: ['Guess the', 'Programming Language'], ar: ['خمِّن', 'لغة البرمجة'] },
    desc: {
      en: 'Identify the language from the snippet before time runs out',
      ar: 'خمّن لغة البرمجة من مقتطف الكود قبل انتهاء الوقت'
    }
  },
  cybersecurity: {
    key: 'cybersecurity',
    icon: '🛡️',
    title: { en: ['Cyber', 'Security Quiz'], ar: ['اختبار', 'الأمن السيبراني'] },
    desc: {
      en: 'Identify tools, malware, Nmap, Metasploit & more',
      ar: 'تعرّف على الأدوات والبرمجيات الخبيثة وNmap وMetasploit والمزيد'
    }
  },
  devops: {
    key: 'devops',
    icon: '♾️',
    title: { en: ['DevOps', 'Quiz'], ar: ['اختبار', 'DevOps'] },
    desc: {
      en: 'Docker, Kubernetes, CI/CD, Git, Terraform & cloud',
      ar: 'Docker وKubernetes وCI/CD وGit وTerraform والسحابة'
    }
  },
  network: {
    key: 'network',
    icon: '🌐',
    title: { en: ['Networking', 'Quiz'], ar: ['اختبار', 'الشبكات'] },
    desc: {
      en: 'OSI, TCP/IP, DNS, routing, subnetting & protocols',
      ar: 'OSI وTCP/IP وDNS والتوجيه والتقسيم والبروتوكولات'
    }
  },
  all: {
    key: 'all',
    icon: '🎲',
    title: { en: ['All', 'Mixed Quiz'], ar: ['الكل', 'اختبار شامل'] },
    desc: {
      en: 'Everything mixed: all four banks together',
      ar: 'كل شيء مدمج: البنوك الأربعة معاً'
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
  return getLang() === 'ar'
    ? `حصلت على ${score} نقطة في لعبة "خمّن اللغة"! هل تستطيع التغلب عليّ؟`
    : `I scored ${score} points in "Guess the Language"! Can you beat me?`;
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
}

// Highlight the active mode card and show its best score on the home page.
function renderHome() {
  document.querySelectorAll('#mode-grid .mode-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.mode === state.mode);
  });
  refreshMenu();
}

// ---------- Persistent settings / high score ----------
const store = {
  highScore(mode) { return Number(localStorage.getItem(`gtl_highscore_${mode}`) || 0); },
  setHighScore(mode, v) { localStorage.setItem(`gtl_highscore_${mode}`, String(v)); },
  get settings() {
    try { return JSON.parse(localStorage.getItem('gtl_settings')) || {}; }
    catch { return {}; }
  },
  set settings(v) { localStorage.setItem('gtl_settings', JSON.stringify(v)); }
};

const defaultSettings = { questions: 10, sound: true, difficulty: 'all', name: '' };

// ---------- Game state ----------
const state = {
  mode: 'languages',
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
  answered: false,
  current: null
};

// ---------- DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const screens = {
  home: $('#screen-home'),
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
  'def','class','return','import','from','as','with','async','await','lambda','for','in','if','elif',
  'else','while','print','None','True','False','not','and','or','is','pass','yield','try','except','finally',
  'const','let','var','function','=>','new','export','default','document','console','typeof','this','null',
  'undefined','void','public','private','protected','static','final','class','interface','extends','implements',
  'package','main','func','go','defer','chan','map','struct','type','range','fn','let','mut','match','impl',
  'trait','use','pub','enum','where','include','template','typename','namespace','using','virtual','auto',
  'int','float','double','char','bool','string','String','vector','make_unique','throws','override','super'
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
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    g.gain.linearRampToValueAtTime(peak, t0 + 0.025);       // gentle fade-in
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);  // smooth fade-out
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  } catch (_) { /* audio not available — ignore */ }
}

const sfx = {
  correct() { note(659, 0, 0.16, 0.12); note(988, 0.10, 0.24, 0.10); }, // soft rising chime
  wrong()   { note(311, 0, 0.20, 0.10); note(233, 0.11, 0.30, 0.08); }, // soft descending
  tick()    { /* per-second ticking removed — it was distracting */ },
  finish()  { [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.13, 0.30, 0.09)); } // gentle arpeggio
};

// ============================================================
//  Settings
// ============================================================
function getSettings() {
  return Object.assign({}, defaultSettings, store.settings);
}

function applySettingsToUI() {
  const s = getSettings();
  $('#set-language').value = getLang();
  $('#set-name').value = s.name || '';
  $('#set-questions').value = String(s.questions);
  $('#set-sound').checked = !!s.sound;
  $('#set-difficulty').value = s.difficulty;
}

function saveSettingsFromUI() {
  store.settings = {
    name: $('#set-name').value.trim().slice(0, 24),
    questions: Number($('#set-questions').value),
    sound: $('#set-sound').checked,
    difficulty: $('#set-difficulty').value
  };
}

// Player name used on the leaderboard. Defaults to "User".
function getPlayerName() {
  const s = getSettings();
  if (s.name && s.name.trim()) return s.name.trim().slice(0, 24);
  return 'User';
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

function timeForDifficulty(d) {
  return d === 'hard' ? 12 : d === 'medium' ? 14 : 15;
}

function buildRound() {
  const s = getSettings();
  let pool = state.allQuestions;
  if (s.difficulty !== 'all') pool = pool.filter((q) => q.difficulty === s.difficulty);
  if (pool.length === 0) pool = state.allQuestions;
  state.round = shuffle(pool).slice(0, Math.min(s.questions, pool.length));
}

// ============================================================
//  Game flow
// ============================================================
function startGame() {
  buildRound();
  state.index = 0;
  state.score = 0;
  state.correct = 0;
  state.streak = 0;
  state.viewOnly = false;
  updateScore();
  updateCorrect();
  updateStreakPill();
  $('#q-total').textContent = String(state.round.length);
  $('#correct-total').textContent = String(state.round.length);
  showScreen('game');
  nextQuestion();
}

// Turn a raw question into a uniform shape for rendering. The type is detected
// per-question (by its fields) so the "All" mode can mix both kinds in a round.
function normalizeQuestion(q) {
  const isCyber = Array.isArray(q.options) && q.answer != null;
  if (isCyber) {
    const hasCmd = !!(q.codeSnippet && q.codeSnippet.trim().length);
    return {
      style: 'cyber',
      panelText: hasCmd ? q.codeSnippet : q.question[getLang()],
      panelIsCode: hasCmd,
      questionText: hasCmd ? q.question[getLang()] : '',
      options: q.options.map((o) => ({ label: o })),
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
    options: LANGUAGES.map((l) => ({ label: l.name, glyph: l.glyph, color: l.color })),
    answer: q.correctLanguage,
    difficulty: q.difficulty,
    explanation: q.explanation
  };
}

function nextQuestion() {
  clearTimer();
  if (state.advanceTimer) { clearTimeout(state.advanceTimer); state.advanceTimer = null; }
  state.answered = false;
  if (state.index >= state.round.length) { endGame(); return; }

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
  if (cur.questionText) { qt.classList.remove('hidden'); qt.textContent = cur.questionText; }
  else { qt.classList.add('hidden'); qt.textContent = ''; }

  hideToast();
  renderOptions(cur, false);
  state.questionTime = timeForDifficulty(cur.difficulty);
  startTimer(state.questionTime);
}

function renderOptions(cur, disabled) {
  const grid = $('#options-grid');
  grid.innerHTML = '';
  grid.classList.toggle('cyber', cur.style === 'cyber');
  grid.classList.toggle('languages', cur.style === 'languages');
  cur.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.dataset.answer = opt.label;
    btn.disabled = !!disabled;
    if (cur.style === 'languages') {
      btn.className = 'lang-btn';
      btn.innerHTML =
        `<span class="lang-icon" style="background:${opt.color}">${opt.glyph}</span>` +
        `<span class="lang-name">${opt.label}</span>`;
    } else {
      btn.className = 'opt-btn';
      btn.textContent = opt.label;
    }
    btn.addEventListener('click', () => onAnswer(opt.label, btn));
    grid.appendChild(btn);
  });
}

function onAnswer(chosen, btn) {
  if (state.answered) return;
  state.answered = true;
  clearTimer();

  const cur = state.current;
  const correct = chosen === cur.answer;
  const buttons = document.querySelectorAll('#options-grid button');
  buttons.forEach((b) => { b.disabled = true; });
  buttons.forEach((b) => { if (b.dataset.answer === cur.answer) b.classList.add('correct'); });

  if (correct) {
    state.streak += 1;
    state.correct += 1;
    const multiplier = state.streak >= 3 ? 1.5 : 1;
    const base = 100 + 10 * state.timeLeft;
    const gained = Math.round(base * multiplier);
    state.score += gained;
    sfx.correct();
    updateScore(true);
    updateCorrect();
    showToast(`${t('correct')} +${gained}${multiplier > 1 ? '  ' + t('streakBonus') : ''}  —  ${cur.explanation[getLang()]}`, 'good');
  } else {
    state.streak = 0;
    if (btn) { btn.classList.add('wrong', 'shake'); }
    sfx.wrong();
    showToast(`${t('wrong')} ${cur.answer}.  ${cur.explanation[getLang()]}`, 'bad');
  }

  updateStreakPill();
  state.index += 1;
  state.advanceTimer = setTimeout(nextQuestion, 1900);
}

// ---------- Timer ----------
function startTimer(seconds) {
  state.timeLeft = seconds;
  updateTimerDisplay();
  setRing(1);
  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    updateTimerDisplay();
    setRing(state.timeLeft / state.questionTime);
    if (state.timeLeft <= 5 && state.timeLeft > 0) sfx.tick();
    if (state.timeLeft <= 0) {
      clearTimer();
      onTimeout();
    }
  }, 1000);
}

function onTimeout() {
  if (state.answered) return;
  state.answered = true;
  const cur = state.current;
  state.streak = 0;
  document.querySelectorAll('#options-grid button').forEach((b) => {
    b.disabled = true;
    if (b.dataset.answer === cur.answer) b.classList.add('correct');
  });
  sfx.wrong();
  showToast(`${t('timeUp')} ${cur.answer}.  ${cur.explanation[getLang()]}`, 'bad');
  updateStreakPill();
  state.index += 1;
  state.advanceTimer = setTimeout(nextQuestion, 1900);
}

// End the round early and show the results so far.
function endQuiz() {
  clearTimer();
  if (state.advanceTimer) { clearTimeout(state.advanceTimer); state.advanceTimer = null; }
  endGame();
}

function clearTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
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
      [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
      { duration: 350, easing: 'ease-out' }
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

  // In view-only mode (opened from "Friends & Scores") hide the score lines.
  $('.final-score').classList.toggle('hidden', viewOnly);
  $('.results-correct').classList.toggle('hidden', viewOnly);
  $('#btn-challenge').classList.toggle('hidden', viewOnly);
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

function submitScore(player, score) {
  return sbFetch('scores', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ player, score, mode: state.mode }])
  }).then((rows) => (Array.isArray(rows) ? rows[0] : null));
}

function fetchTopScores(limit = 10) {
  return sbFetch(`scores?select=id,player,score&mode=eq.${state.mode}&order=score.desc&limit=${limit}`);
}

const AVATARS = ['🧑🏽', '👩🏼', '🧑🏻', '👩🏻‍🦰', '🧔🏽', '👨🏾', '👩🏽‍🦱', '🧑🏼‍🎤', '👨🏻‍💻', '👩🏾‍💻'];
function avatarFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
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
        id: r.id, name: r.player, avatar: avatarFor(r.player), score: r.score, you: false
      }));
      if (state.score > 0) {
        // Flag the player's row (by inserted id, else by name+score heuristic).
        let mine = me ? list.find((p) => p.id === me.id) : null;
        if (!mine) mine = list.find((p) => !p.you && p.name === playerName && p.score === state.score);
        if (mine) mine.you = true;
        else list.push({ id: -1, name: playerName, avatar: avatarFor(playerName), score: state.score, you: true });
      }

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
  renderLeaderboard(FRIENDS.concat([{ name: playerName, avatar: '🧑‍💻', score: state.score, you: true }]));
}

function renderLeaderboard(list) {
  const sorted = list.slice().sort((a, b) => b.score - a.score);
  let display = sorted.slice(0, 10);
  const youIdx = sorted.findIndex((p) => p.you);
  if (youIdx >= 10) { display = sorted.slice(0, 9); display.push(sorted[youIdx]); }
  const max = Math.max(...sorted.map((p) => p.score), 1);

  const lb = $('#leaderboard');
  lb.innerHTML = '';
  display.forEach((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const row = document.createElement('div');
    row.className = `lb-row ${rankClass}${p.you ? ' is-you' : ''}`;
    const label = document.createElement('div');
    label.className = 'lb-bar-fill';
    label.textContent = `${p.name} — ${p.score} pts`;
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
    avatar.textContent = p.avatar;
    row.appendChild(avatar);
    row.appendChild(wrap);
    lb.appendChild(row);

    // Animate width. A 30% baseline keeps every bar wide enough for its label.
    const pct = 30 + 70 * (p.score / max);
    requestAnimationFrame(() => {
      setTimeout(() => { label.style.width = `${pct}%`; }, 60 + i * 120);
    });
  });
}

function challengeFriend() {
  const text = challengeText(state.score);
  navigator.clipboard?.writeText(text).then(
    () => flashButton('#btn-challenge', t('challengeCopied')),
    () => flashButton('#btn-challenge', String(state.score))
  );
}

function flashButton(sel, msg) {
  const b = $(sel);
  const old = b.innerHTML;
  b.innerHTML = msg;
  setTimeout(() => { b.innerHTML = old; }, 1600);
}

// ============================================================
//  Wire up the UI
// ============================================================
function bindEvents() {
  // window controls
  $('#tb-min').addEventListener('click', () => window.appWindow?.minimize());
  $('#tb-max').addEventListener('click', () => window.appWindow?.toggleMaximize());
  $('#tb-close').addEventListener('click', () => window.appWindow?.close());

  // language switch (home toggle + settings dropdown)
  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.addEventListener('click', () => setLang(b.dataset.setlang));
  });
  $('#set-language').addEventListener('change', () => setLang($('#set-language').value));

  // mode cards — select in place (stay on the home page)
  document.querySelectorAll('#mode-grid .mode-card').forEach((card) => {
    card.addEventListener('click', () => selectMode(card.dataset.mode));
  });

  // home actions
  $('#btn-start').addEventListener('click', startGame);
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

  // about
  $('#btn-about').addEventListener('click', () => {
    $('#settings-panel').classList.add('hidden');
    openAbout();
  });
  $('#about-close').addEventListener('click', () => $('#about-panel').classList.add('hidden'));
  document.querySelectorAll('.about-link').forEach((b) => {
    b.addEventListener('click', () => window.appWindow?.openExternal(b.dataset.url));
  });

  // game — end the quiz early
  $('#btn-end').addEventListener('click', endQuiz);

  // results
  $('#btn-challenge').addEventListener('click', challengeFriend);
  $('#btn-replay').addEventListener('click', startGame);
  $('#btn-menu').addEventListener('click', () => { showScreen('home'); renderHome(); });

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
  if (state.advanceTimer) { clearTimeout(state.advanceTimer); state.advanceTimer = null; }
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
  } catch { $('#about-count').textContent = '—'; }
  try {
    const v = await window.appWindow?.getVersion?.();
    if (v) $('#about-version').textContent = 'v' + v;
  } catch { /* ignore */ }
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
    startBtn.disabled = false;
    startBtn.setAttribute('data-i18n', 'start'); // let language switches keep it in sync
    startBtn.textContent = t('start');
  } else {
    startBtn.textContent = t('loadFail');
  }
}

// ============================================================
//  Boot
// ============================================================
function boot() {
  bindEvents();
  const savedMode = localStorage.getItem('gtl_mode');
  if (savedMode && MODES[savedMode]) state.mode = savedMode;
  applyLanguage();
  showScreen('home');
  selectMode(state.mode);
}

boot();
