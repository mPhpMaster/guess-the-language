import { $ } from './dom.js';
import { uiLang } from './i18n.js';

// ============================================================
//  The developer's other games — shown on Home, in About, and after a round.
//  Same list (and shape) as LetterUp's src/lib/links.ts, so the three games
//  point at each other. An entry with no URL yet is skipped; when none are
//  live the whole section stays hidden.
// ============================================================
export const OTHER_GAMES = [
    {
        id: 'letterup',
        emoji: '🔤',
        name: { en: 'LetterUp', ar: 'ليتر أب' },
        blurb: {
            en: 'Human, Animal, Plant, Object — the classic word game, live in a Discord voice channel.',
            ar: 'إنسان، حيوان، نبات، جماد — اللعبة الكلاسيكية مباشرة في قناة Discord الصوتية.'
        },
        url: ''
    },
    {
        id: 'maqlab',
        emoji: '🎭',
        name: { en: 'MAQLAB', ar: 'مقلب' },
        blurb: {
            en: 'A party game for the whole room, in Arabic or English.',
            ar: 'لعبة حفلات جماعية بالعربي أو الإنجليزي.'
        },
        url: 'https://maqlab.onrender.com'
    }
];

export const liveGames = () => OTHER_GAMES.filter((g) => g.url);

// Fill every [data-other-games] container. Built from nodes; the strings are ours,
// but there is no reason to go through innerHTML for them.
export function renderOtherGames() {
    const games = liveGames();
    const lang = uiLang() === 'ar' ? 'ar' : 'en';
    document.querySelectorAll('[data-other-games]').forEach((box) => {
        box.classList.toggle('hidden', !games.length);
        const list = box.querySelector('.other-games-list');
        if (!list) return;
        list.textContent = '';
        games.forEach((g) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'other-game';
            b.dataset.url = g.url;
            const icon = document.createElement('span');
            icon.className = 'other-game-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = g.emoji;
            const text = document.createElement('span');
            text.className = 'other-game-text';
            const name = document.createElement('strong');
            name.textContent = g.name[lang];
            const blurb = document.createElement('span');
            blurb.className = 'other-game-blurb';
            blurb.textContent = g.blurb[lang];
            text.append(name, blurb);
            const arrow = document.createElement('span');
            arrow.className = 'other-game-go';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '↗';
            b.append(icon, text, arrow);
            b.addEventListener('click', () => {
                import('./events.js').then((m) => m.openExternalUrl(g.url)).catch(() => {});
            });
            list.appendChild(b);
        });
    });
}

export function hasOtherGames() { return liveGames().length > 0; }
export function otherGamesBox() { return $('[data-other-games]'); }
