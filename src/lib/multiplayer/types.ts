import type { Difficulty, DifficultyFilter, ModeId } from '$lib/game/types';

export type RoomStatus = 'lobby' | 'playing' | 'finished' | 'closed';
export type RoomPhase = 'question' | 'reveal';

/** Room settings as stored in the `rooms.settings` jsonb column. */
export interface RoomSettings {
  questions: number;
  difficulty: DifficultyFilter;
  timer: string;
}

export interface Room {
  id: string;
  code: string | null;
  mode: ModeId;
  status: RoomStatus;
  phase: RoomPhase | null;
  question_index: number;
  question_ends_at: string | null;
  host_player_id: string | null;
  settings: RoomSettings | null;
  /** The refs the host dealt at start time; every client renders from these. */
  round_refs: RoundRef[] | null;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  name: string;
  score: number;
  spectator: boolean;
  color: string | null;
  icon: string | null;
  discord_user_id: string | null;
  discord_avatar: string | null;
  joined_at: string;
}

/**
 * A question reference rather than the question itself — every client already
 * has the banks, so the room only needs to agree on which question, in which
 * option order, for how long.
 */
export interface RoundRef {
  bank: string;
  id: number;
  optionSeed: number;
  duration: number;
}

export interface AnswerKey {
  index: number;
  answer: string;
}

export interface RoomAnswerRow {
  player_id: string;
  answer: string;
}

export interface JoinResult {
  roomId: string;
  playerId: string;
  code: string;
  isHost?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  color: string | null;
  score: number;
  you: boolean;
}

export type { Difficulty };
