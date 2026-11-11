export type MoveType =
  | "arm_up" | "arm_down" | "arm_left" | "arm_right"
  | "shake" | "circle" | "punch" | "wave";

export type Rating = "perfect" | "good" | "ok" | "miss";

export interface Move {
  time: number;
  duration: number;
  type: MoveType;
  label: string;
  points: number;
}

export interface Choreography {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  audio: string;
  animation?: string;
  moves: Move[];
}

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  animation?: string;
}

export interface PlayerResult {
  playerName: string;
  score: number;
  maxScore: number;
  counts: Record<Rating, number>;
}

export interface LiveScore {
  score: number;
  rating: Rating | null;
  moveIndex: number;
}

export function wsUrl(serverUrl: string): string {
  return serverUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
}