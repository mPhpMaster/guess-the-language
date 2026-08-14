'use strict';

/* Browser platform shim — provides gameAPI + appWindow when not running in Electron.
   Preload defines these APIs first; bail out so desktop IPC stays in charge. */

(function () {
  if (window.gameAPI && window.appWindow) return;

  // One file per bank; the files are never merged on disk.
  const QUESTION_FILES = {
    languages: 'questions.json',
    cybersecurity: 'questions-cyber.json',
    devops: 'questions-devops.json',
    network: 'questions-network.json',
    gamedev: 'questions-gamedev.json',
    algorithms: 'questions-algo.json',
    bug: 'questions-bug.json',
    output: 'questions-output.json'
  };
  const BANK_KEYS = Object.keys(QUESTION_FILES);

  // Selectable modes -> the banks they draw from. 'bug' and 'output' are no longer
  // modes of their own: Problem Solving now serves all three banks.
  const MODE_BANKS = {
    languages: ['languages'],
    cybersecurity: ['cybersecurity'],
    devops: ['devops'],
    network: ['network'],
    gamedev: ['gamedev'],
    algorithms: ['algorithms', 'bug', 'output']
  };

  async function readBank(fileName) {
    const res = await fetch(`./data/${fileName}`);
    if (!res.ok) throw new Error(`Failed to load ${fileName}`);
    return res.json();
  }

  function tagBank(questions, bank) {
    return questions.map((q) => Object.assign({}, q, { bank }));
  }

  // Every file keeps its OWN bank tag, never the mode name: each file numbers its
  // ids from 1, and the app de-duplicates on the composite key `bank|id`, so
  // re-tagging the three algorithms banks alike would collide ids 1..50.
  async function loadBanks(banks) {
    const loaded = await Promise.all(
      banks.map(async (bank) => tagBank(await readBank(QUESTION_FILES[bank]), bank))
    );
    return loaded.flat();
  }

  async function getQuestions(mode) {
    // 'all' walks the bank list directly so each bank is read exactly once.
    if (mode === 'all') return loadBanks(BANK_KEYS);
    return loadBanks(MODE_BANKS[mode] || MODE_BANKS.languages);
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
