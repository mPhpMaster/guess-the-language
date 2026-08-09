/* ============================================================
   Domain model — every shape the game reads or writes.
   ============================================================ */

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export type LocalizedText = Readonly<Record<Locale, string>>;

export const GAME_MODES = [
    'languages',
    'cybersecurity',
    'devops',
    'network',
    'gamedev',
    'algorithms',
    'all',
] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** Every mode except `all` is also a question bank on disk. */
export const QUESTION_BANKS = [
    'languages',
    'cybersecurity',
    'devops',
    'network',
    'gamedev',
    'algorithms',
] as const;
export type QuestionBank = (typeof QUESTION_BANKS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type DifficultyFilter = Difficulty | 'all';

/* ---------- Raw question rows, as stored in src/data/*.json ---------- */

interface RawQuestionBase {
    readonly id: number;
    readonly difficulty: Difficulty;
    readonly explanation: LocalizedText;
    readonly codeSnippet?: string;
    readonly category?: string;
}

/** "Which language is this snippet?" */
export interface RawLanguageQuestion extends RawQuestionBase {
    readonly correctLanguage: string;
}

/** Multiple choice with an explicit option list. */
export interface RawChoiceQuestion extends RawQuestionBase {
    readonly question: LocalizedText;
    readonly options: readonly string[];
    readonly answer: string;
}

/** Fill in the blank (`____`) — the player types the missing token. */
export interface RawFillQuestion extends RawQuestionBase {
    readonly question: LocalizedText;
    readonly answer: string;
    readonly accept?: readonly string[];
}

export type RawQuestion = RawLanguageQuestion | RawChoiceQuestion | RawFillQuestion;

/** A raw question tagged with the bank it was loaded from. */
export type BankedQuestion = RawQuestion & { readonly bank: QuestionBank };

export function isLanguageQuestion(q: RawQuestion): q is RawLanguageQuestion {
    return 'correctLanguage' in q && typeof q.correctLanguage === 'string';
}

export function isChoiceQuestion(q: RawQuestion): q is RawChoiceQuestion {
    return 'options' in q && Array.isArray(q.options) && 'answer' in q;
}

export function isFillQuestion(q: RawQuestion): q is RawFillQuestion {
    return !isLanguageQuestion(q) && !isChoiceQuestion(q);
}

/* ---------- Normalised question, ready to render ---------- */

export type QuestionStyle = 'languages' | 'choice' | 'fill';

export interface AnswerOption {
    readonly label: string;
    /** Short brand mark shown in the badge; language questions only. */
    readonly iconKey?: string;
    readonly color?: string;
}

export interface NormalizedQuestion {
    readonly id: number;
    readonly bank: QuestionBank;
    readonly style: QuestionStyle;
    /** Code snippet or prose shown in the top panel. */
    readonly panelText: string;
    readonly panelIsCode: boolean;
    /** Sub-question shown under the panel (may be empty). */
    readonly questionText: string;
    readonly options: readonly AnswerOption[];
    readonly answer: string;
    readonly accept: readonly string[];
    readonly difficulty: Difficulty;
    readonly explanation: LocalizedText;
}

/* ---------- Round history ---------- */

export interface RoundAnswer {
    readonly questionIndex: number;
    readonly id: number;
    readonly bank: QuestionBank;
    readonly difficulty: Difficulty;
    readonly style: QuestionStyle;
    readonly prompt: string;
    readonly panelText: string;
    readonly selectedAnswer: string;
    readonly correctAnswer: string;
    readonly correct: boolean;
    readonly timedOut: boolean;
    readonly responseTimeMs: number;
    readonly points: number;
    readonly explanation: LocalizedText;
}

/* ---------- Settings ---------- */

export type TimerSetting = number | 'auto';
export type FeedbackDelay = 2 | 4 | 6 | 'manual';
export type QuestionCount = 5 | 10 | 15 | 20;

export interface GameSettings {
    readonly questions: QuestionCount;
    readonly sound: boolean;
    readonly difficulty: DifficultyFilter;
    readonly timer: TimerSetting;
    readonly feedbackDelay: FeedbackDelay;
    readonly name: string;
    readonly adaptive: boolean;
    readonly discordPresence: boolean;
}

/* ---------- Identity ---------- */

export interface DiscordProfile {
    readonly id: string;
    readonly name: string;
    readonly avatar: string | null;
    readonly sessionToken?: string | null;
}

export interface SessionClaims {
    readonly sub?: string;
    readonly adm?: boolean;
    readonly uname?: string;
    readonly exp?: number;
}

/* ---------- Leaderboard ---------- */

export interface ScoreRow {
    readonly id: number;
    readonly player: string;
    readonly score: number;
    readonly multiplayer?: boolean;
    readonly avatar?: string | null;
    readonly mode?: GameMode;
    readonly created_at?: string;
}

export interface LeaderboardEntry {
    readonly id: number;
    readonly name: string;
    /** An https avatar URL, or `null` for the generated fallback badge. */
    readonly avatar: string | null;
    readonly score: number;
    readonly rank: number | null;
    readonly you: boolean;
    readonly multiplayer?: boolean;
    readonly color?: string | null;
}

export type LeaderboardScope = 'all' | 'week';

/* ---------- Profile / progression ---------- */

export interface PlayerAggregate {
    readonly games: number;
    readonly best: number;
    readonly avg: number;
    readonly total: number;
    readonly mp: number;
    readonly modes: number;
    readonly lastPlayed: string;
}

export interface PlayerStatsRow {
    readonly games: number | null;
    readonly mp_games: number | null;
    readonly wins: number | null;
    readonly seconds: number | null;
    readonly last_seen: string | null;
    readonly xp: number | null;
    readonly level: number | null;
    readonly day_streak: number | null;
    readonly best_day_streak: number | null;
    readonly perfect_games: number | null;
    readonly achievements: readonly string[] | null;
}

export interface ModeRanking {
    readonly mode: GameMode;
    readonly best: number | null;
    readonly rank: number | null;
}

/* ---------- Multiplayer ---------- */

export type RoomStatus = 'lobby' | 'playing' | 'finished' | 'closed';
export type RoomPhase = 'question' | 'reveal';

export interface RoundRef {
    readonly bank: QuestionBank;
    readonly id: number;
    readonly optionSeed: number;
    readonly duration: number;
}

export interface AnswerKey {
    readonly index: number;
    readonly answer: string;
}

export interface RoomSettings {
    readonly questions: QuestionCount;
    readonly difficulty: DifficultyFilter;
    readonly timer: TimerSetting;
    readonly feedbackDelay: FeedbackDelay;
}

export interface Room {
    readonly id: string;
    readonly code: string;
    readonly mode: GameMode;
    readonly status: RoomStatus;
    readonly phase: RoomPhase;
    readonly question_index: number;
    readonly question_ends_at: string | null;
    readonly host_player_id: string | null;
    readonly round_refs: readonly RoundRef[] | null;
    readonly settings: Partial<RoomSettings> | null;
}

export interface RoomPlayer {
    readonly id: string;
    readonly name: string;
    readonly score: number;
    readonly correct: number;
    readonly streak: number;
    readonly is_host: boolean;
    readonly spectator: boolean;
    readonly color: string | null;
    readonly icon: string | null;
    readonly joined_at: string | null;
    readonly discord_user_id: string | null;
}

export interface RoomAnswerRow {
    readonly player_id: string;
    readonly answer: string;
}

export interface JoinRoomResult {
    readonly roomId: string;
    readonly playerId: string;
    readonly code: string;
    readonly isHost?: boolean;
}

/* ---------- Challenge deep links ---------- */

export interface ChallengeInfo {
    readonly mode: GameMode | null;
    readonly questions: QuestionCount | null;
    readonly difficulty: DifficultyFilter | null;
    readonly score: number | null;
}

/* ---------- Admin ---------- */

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface AdminReport {
    readonly id: number;
    readonly score_id: number;
    readonly reason: string;
    readonly details: string | null;
    readonly status: ReportStatus | null;
    readonly score: ScoreRow | null;
}

export interface AdminUser {
    readonly player: string;
    readonly level: number | null;
    readonly games: number | null;
    readonly day_streak: number | null;
    readonly last_seen: string | null;
    readonly banned: boolean;
}

export interface AdminLiveEntry {
    readonly player: string;
    readonly activity: string | null;
    readonly mode: GameMode | null;
    readonly platform: string | null;
    readonly guild_id: string | null;
    readonly updated_at: string;
}

export interface AdminBan {
    readonly player: string;
    readonly reason: string | null;
    readonly banned_by: string | null;
    readonly created_at: string;
}

export type ReportReason = 'offensive_name' | 'impersonation' | 'spam_other';
export const REPORT_REASONS: readonly ReportReason[] = [
    'offensive_name',
    'impersonation',
    'spam_other',
];

/* ---------- App screens ---------- */

export type ScreenName = 'home' | 'lobby' | 'game' | 'results';
export type Platform = 'web' | 'electron' | 'discord';
