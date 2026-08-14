// ---------- Persistent settings / high score ----------
export const store = {
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

export const defaultSettings = {
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
export const state = {
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
