import { $ } from './dom.js';
import { t } from './i18n.js';
import { state } from './state.js';

// ============================================================
//  Focus packs: narrow a mode to one area ("Kubernetes only", "systems
//  languages"). A focused round is a study tool — it earns XP but is never
//  posted to a leaderboard, since a narrow pool is easier than the full mode.
//
//  The banks' `category` strings grew organically (devops has both "ci" and
//  "cicd"), so packs are curated groups of categories rather than one pack per
//  raw category. Modes too small to split (the 60-question banks) have none.
// ============================================================
const LANG_FAMILIES = {
    web: ['JavaScript', 'TypeScript', 'PHP'],
    systems: ['C', 'C++', 'Rust', 'Go'],
    jvm: ['Java', 'Kotlin', 'Swift', 'C#'],
    scripting: ['Python', 'Ruby', 'Bash', 'SQL']
};

const CATEGORY_PACKS = {
    cybersecurity: {
        offense: ['nmap', 'metasploit', 'attacks', 'tools'],
        web: ['web'],
        crypto: ['crypto', 'auth'],
        defense: ['malware', 'defense', 'social'],
        concepts: ['concepts', 'principles', 'network']
    },
    devops: {
        docker: ['docker', 'containers'],
        kubernetes: ['kubernetes', 'orchestration'],
        cicd: ['cicd', 'ci', 'deployment'],
        iac: ['iac', 'cloud'],
        ops: ['observability', 'secrets', 'reliability']
    },
    network: {
        fundamentals: ['osi', 'layers', 'tcp', 'transport', 'ip', 'addressing', 'ipv6', 'ports'],
        routing: ['routing', 'switching', 'devices'],
        services: ['dns', 'services', 'protocols'],
        netsec: ['security', 'diagnostics', 'tools']
    },
    gamedev: {
        rendering: ['rendering', 'effects', 'animation', 'scene'],
        physics: ['physics', 'collision', 'math'],
        gameplay: ['gameplay', 'ai', 'pathfinding', 'logic', 'state', 'systems', 'input', 'ui', 'save'],
        engine: ['timing', 'optimization', 'architecture', 'assets', 'audio'],
        netcode: ['netcode', 'networking']
    }
};

export function packsFor(mode) {
    if (mode === 'languages') {
        return Object.entries(LANG_FAMILIES).map(([id, langs]) => ({
            id, test: (q) => langs.includes(q.correctLanguage)
        }));
    }
    if (mode === 'algorithms') {
        return [
            { id: 'fill', test: (q) => q.bank === 'algorithms' },
            { id: 'bug', test: (q) => q.bank === 'bug' },
            { id: 'output', test: (q) => q.bank === 'output' },
            { id: 'python', test: (q) => q.category === 'python' },
            { id: 'jsts', test: (q) => q.category === 'javascript' || q.category === 'typescript' }
        ];
    }
    const groups = CATEGORY_PACKS[mode];
    if (!groups) return [];
    return Object.entries(groups).map(([id, cats]) => ({ id, test: (q) => cats.includes(q.category) }));
}

export function packLabel(id) {
    return t('pack_' + id);
}

function packKey(mode) { return 'gtl_pack_' + mode; }

export function pickedPackId(mode = state.mode) {
    try { return localStorage.getItem(packKey(mode)) || ''; } catch (_) { return ''; }
}

export function setPickedPack(id, mode = state.mode) {
    try {
        if (id) localStorage.setItem(packKey(mode), id);
        else localStorage.removeItem(packKey(mode));
    } catch (_) { /* storage unavailable — the pick just isn't remembered */ }
}

export function activePack(mode = state.mode) {
    const id = pickedPackId(mode);
    return id ? (packsFor(mode).find((p) => p.id === id) || null) : null;
}

// The pool a solo round draws from: the whole mode, or just the focus pack.
// Also records whether the round is focused, which keeps it off the boards.
export function focusedPool() {
    const pool = state.allQuestions || [];
    const pack = activePack();
    const narrowed = pack ? pool.filter(pack.test) : pool;
    // A pack that somehow matches almost nothing falls back to the full mode
    // rather than dealing a 2-question round.
    const use = pack && narrowed.length >= 5;
    state.focused = !!use;
    return use ? narrowed : pool;
}

export function renderPackSelect() {
    const row = $('#pack-row');
    const sel = $('#pack-select');
    if (!row || !sel) return;
    const packs = packsFor(state.mode);
    row.classList.toggle('hidden', !packs.length);
    if (!packs.length) return;
    const pool = state.allQuestions || [];
    sel.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = t('packAll');
    sel.appendChild(all);
    packs.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        const n = pool.length ? pool.filter(p.test).length : 0;
        o.textContent = n ? `${packLabel(p.id)} (${n})` : packLabel(p.id);
        sel.appendChild(o);
    });
    sel.value = activePack() ? pickedPackId() : '';
    $('#pack-note')?.classList.toggle('hidden', !sel.value);
}
