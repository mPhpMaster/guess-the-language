'use strict';

/* Browser platform shim — provides gameAPI + appWindow when not running in Electron.
   Preload defines these APIs first; bail out so desktop IPC stays in charge. */

(function () {
  if (window.gameAPI && window.appWindow) return;

  const QUESTION_FILES = {
    languages: 'questions.json',
    cybersecurity: 'questions-cyber.json',
    devops: 'questions-devops.json',
    network: 'questions-network.json',
    gamedev: 'questions-gamedev.json',
    algorithms: 'questions-algo.json'
  };
  const BANK_KEYS = Object.keys(QUESTION_FILES);

  async function readBank(fileName) {
    const res = await fetch(`./data/${fileName}`);
    if (!res.ok) throw new Error(`Failed to load ${fileName}`);
    return res.json();
  }

  function tagBank(questions, bank) {
    return questions.map((q) => Object.assign({}, q, { bank }));
  }

  async function getQuestions(mode) {
    if (mode === 'all') {
      const entries = Object.entries(QUESTION_FILES);
      const banks = await Promise.all(
        entries.map(async ([bank, file]) => tagBank(await readBank(file), bank))
      );
      return banks.flat();
    }
    const bank = BANK_KEYS.includes(mode) ? mode : 'languages';
    const qs = await readBank(QUESTION_FILES[bank] || QUESTION_FILES.languages);
    return tagBank(qs, bank);
  }

  function appVersion() {
    return '__GTL_VERSION__';
  }

  window.gameAPI = { getQuestions };

  window.appWindow = {
    minimize: () => {},
    toggleMaximize: () => {},
    close: () => {},
    openExternal: (url) => {
      if (typeof url === 'string' && /^https:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    getVersion: () => Promise.resolve(appVersion())
  };

  document.documentElement.classList.add('platform-web');

  // Register the service worker so the web build is an installable PWA (mobile
  // app) that also works offline. Skip file:// (Electron) and iframes (the
  // Discord Activity), where a SW is unwanted.
  const inIframe = window.top !== window.self;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !inIframe) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
