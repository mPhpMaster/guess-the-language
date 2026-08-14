/* ============================================================
   Guess the Programming Language — renderer / game logic
   ============================================================ */

// ---------- The six fixed answer options (order matches mockup) ----------
export const LANGUAGES = [{
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
export const OPTION_COLORS = [
    'linear-gradient(135deg,#5fd0ff,#2b7fd8)',
    'linear-gradient(135deg,#19f0c4,#12a988)',
    'linear-gradient(135deg,#ffd874,#e0a83c)',
    'linear-gradient(135deg,#ff7a9c,#d8436c)'
];

// ---------- Mock friends for the comparison screen ----------
export const FRIENDS = [{
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

export const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r = 52 -> ~326.7
