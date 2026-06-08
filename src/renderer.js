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
    appTitle: 'Guess the Programming Language',
    menuTitle1: 'Guess the',
    menuTitle2: 'Programming Language',
    menuSubtitle: 'Identify the language from the snippet before time runs out',
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
    diff: { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
  },
  ar: {
    appTitle: 'خمّن لغة البرمجة',
    menuTitle1: 'خمِّن',
    menuTitle2: 'لغة البرمجة',
    menuSubtitle: 'خمّن لغة البرمجة من مقتطف الكود قبل انتهاء الوقت',
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
    diff: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' }
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
    ? `حصلت على ${score} نقطة في لعبة "خمّن لغة البرمجة"! هل تستطيع التغلب عليّ؟`
    : `I scored ${score} points in "Guess the Programming Language"! Can you beat me?`;
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
}

// ---------- Persistent settings / high score ----------
const store = {
  get highScore() { return Number(localStorage.getItem('gtl_highscore') || 0); },
  set highScore(v) { localStorage.setItem('gtl_highscore', String(v)); },
  get settings() {
    try { return JSON.parse(localStorage.getItem('gtl_settings')) || {}; }
    catch { return {}; }
  },
  set settings(v) { localStorage.setItem('gtl_settings', JSON.stringify(v)); }
};

const defaultSettings = { questions: 10, sound: true, difficulty: 'all', name: '' };

// ---------- Game state ----------
const state = {
  allQuestions: [],
  round: [],
  index: 0,
  score: 0,
  streak: 0,
  timeLeft: 0,
  questionTime: 15,
  timerId: null,
  answered: false
};

// ---------- DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const screens = {
  menu: $('#screen-menu'),
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
function beep(freq, durationMs, type = 'sine', gain = 0.08) {
  if (!getSettings().sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch (_) { /* audio not available — ignore */ }
}
const sfx = {
  correct() { beep(660, 120, 'triangle'); setTimeout(() => beep(880, 160, 'triangle'), 110); },
  wrong()   { beep(180, 260, 'sawtooth', 0.07); },
  tick()    { beep(1200, 40, 'sine', 0.03); },
  finish()  { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 180, 'triangle'), i * 130)); }
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

// Player name used on the leaderboard. Falls back to a stable guest id.
function getPlayerName() {
  const s = getSettings();
  if (s.name && s.name.trim()) return s.name.trim().slice(0, 24);
  let guest = localStorage.getItem('gtl_guest');
  if (!guest) {
    guest = 'Guest-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('gtl_guest', guest);
  }
  return guest;
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
  state.streak = 0;
  updateScore();
  updateStreakPill();
  $('#q-total').textContent = String(state.round.length);
  showScreen('game');
  nextQuestion();
}

function nextQuestion() {
  clearTimer();
  state.answered = false;
  if (state.index >= state.round.length) { endGame(); return; }

  const q = state.round[state.index];
  $('#q-current').textContent = String(state.index + 1);
  const dEl = $('#code-difficulty');
  dEl.dataset.diff = q.difficulty;
  dEl.textContent = diffLabel(q.difficulty);
  $('#code-snippet').innerHTML = highlight(q.codeSnippet);
  hideToast();

  renderOptions(false);
  state.questionTime = timeForDifficulty(q.difficulty);
  startTimer(state.questionTime);
}

function renderOptions(disabled) {
  const grid = $('#options-grid');
  grid.innerHTML = '';
  LANGUAGES.forEach((lang) => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn';
    btn.dataset.lang = lang.name;
    btn.disabled = disabled;
    btn.innerHTML =
      `<span class="lang-icon" style="background:${lang.color}">${lang.glyph}</span>` +
      `<span class="lang-name">${lang.name}</span>`;
    btn.addEventListener('click', () => onAnswer(lang.name, btn));
    grid.appendChild(btn);
  });
}

function onAnswer(chosen, btn) {
  if (state.answered) return;
  state.answered = true;
  clearTimer();

  const q = state.round[state.index];
  const correct = chosen === q.correctLanguage;
  const buttons = document.querySelectorAll('.lang-btn');
  buttons.forEach((b) => { b.disabled = true; });

  // mark the correct one
  buttons.forEach((b) => {
    if (b.dataset.lang === q.correctLanguage) b.classList.add('correct');
  });

  if (correct) {
    state.streak += 1;
    const multiplier = state.streak >= 3 ? 1.5 : 1;
    const base = 100 + 10 * state.timeLeft;
    const gained = Math.round(base * multiplier);
    state.score += gained;
    sfx.correct();
    updateScore(true);
    showToast(`${t('correct')} +${gained}${multiplier > 1 ? '  ' + t('streakBonus') : ''}  —  ${q.explanation[getLang()]}`, 'good');
  } else {
    state.streak = 0;
    if (btn) { btn.classList.add('wrong', 'shake'); }
    sfx.wrong();
    showToast(`${t('wrong')} ${q.correctLanguage}.  ${q.explanation[getLang()]}`, 'bad');
  }

  updateStreakPill();
  state.index += 1;
  setTimeout(nextQuestion, 1700);
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
  const q = state.round[state.index];
  state.streak = 0;
  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.disabled = true;
    if (b.dataset.lang === q.correctLanguage) b.classList.add('correct');
  });
  sfx.wrong();
  showToast(`${t('timeUp')} ${q.correctLanguage}.  ${q.explanation[getLang()]}`, 'bad');
  updateStreakPill();
  state.index += 1;
  setTimeout(nextQuestion, 1700);
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
  if (state.score > store.highScore) store.highScore = state.score;
  sfx.finish();
  showScreen('results');
  countUp($('#final-score'), state.score, 900);
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
    body: JSON.stringify([{ player, score }])
  }).then((rows) => (Array.isArray(rows) ? rows[0] : null));
}

function fetchTopScores(limit = 10) {
  return sbFetch(`scores?select=id,player,score&order=score.desc&limit=${limit}`);
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
      const me = await submitScore(playerName, state.score);
      const top = await fetchTopScores(10);
      const list = (top || []).map((r) => ({
        id: r.id, name: r.player, avatar: avatarFor(r.player), score: r.score, you: false
      }));
      // Flag the player's row (by inserted id, else by name+score heuristic).
      let mine = me ? list.find((p) => p.id === me.id) : null;
      if (!mine) mine = list.find((p) => !p.you && p.name === playerName && p.score === state.score);
      if (mine) mine.you = true;
      else list.push({ id: -1, name: playerName, avatar: avatarFor(playerName), score: state.score, you: true });

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

  // language switch (menu toggle + settings dropdown)
  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.addEventListener('click', () => setLang(b.dataset.setlang));
  });
  $('#set-language').addEventListener('change', () => setLang($('#set-language').value));

  // menu
  $('#btn-start').addEventListener('click', startGame);
  $('#btn-friends').addEventListener('click', () => { state.score = 0; endGame(); });
  $('#btn-settings').addEventListener('click', () => {
    applySettingsToUI();
    $('#settings-panel').classList.toggle('hidden');
  });
  $('#set-close').addEventListener('click', () => {
    saveSettingsFromUI();
    $('#settings-panel').classList.add('hidden');
  });

  // results
  $('#btn-challenge').addEventListener('click', challengeFriend);
  $('#btn-replay').addEventListener('click', startGame);
  $('#btn-menu').addEventListener('click', () => { refreshMenu(); showScreen('menu'); });

  // keyboard: 1-6 to answer
  document.addEventListener('keydown', (e) => {
    if (!screens.game.classList.contains('active') || state.answered) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 6) {
      const btn = document.querySelectorAll('.lang-btn')[n - 1];
      if (btn) btn.click();
    }
  });
}

function refreshMenu() {
  $('#menu-highscore-val').textContent = String(store.highScore);
}

// ============================================================
//  Boot
// ============================================================
async function boot() {
  bindEvents();
  applyLanguage();
  refreshMenu();
  try {
    state.allQuestions = await window.gameAPI.getQuestions();
  } catch (err) {
    console.error('Failed to load questions:', err);
    state.allQuestions = [];
  }
  if (!state.allQuestions.length) {
    const sb = $('#btn-start');
    sb.removeAttribute('data-i18n'); // keep the error text from being overwritten
    sb.textContent = t('loadFail');
    sb.disabled = true;
  }
}

boot();
