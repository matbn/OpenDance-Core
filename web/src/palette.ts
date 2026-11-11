import { Rating } from "./types";

export const PLAYER_COLORS = ["#8dff00", "#ff4d5e", "#22d3ee", "#8b5cf6", "#ffb703", "#ff2d95"];

export const RATING_COLORS: Record<Rating, string> = {
  perfect: "#8dff00",
  good: "#22d3ee",
  ok: "#ffb703",
  miss: "#ff4d5e"
};

export const RATING_TEXT: Record<Rating, string> = {
  perfect: "PERFECT",
  good: "GOOD",
  ok: "OK",
  miss: "MISS"
};