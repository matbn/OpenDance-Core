import { Rating } from "../types";

let ctx: AudioContext | null = null;
let muted = false;

export function setSfxMuted(m: boolean) {
  muted = m;
}

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export function playRating(rating: Rating) {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  switch (rating) {
    case "perfect":
      tone(c, 880, t, 0.16, "triangle", 0.22);
      tone(c, 1318, t + 0.09, 0.28, "triangle", 0.22);
      tone(c, 1760, t + 0.18, 0.34, "sine", 0.12);
      break;
    case "good":
      tone(c, 660, t, 0.14, "triangle", 0.2);
      tone(c, 990, t + 0.08, 0.22, "triangle", 0.16);
      break;
    case "ok":
      tone(c, 440, t, 0.18, "triangle", 0.18);
      break;
    case "miss":
      tone(c, 196, t, 0.22, "sawtooth", 0.1);
      tone(c, 147, t + 0.1, 0.26, "sawtooth", 0.08);
      break;
  }
}

export function playCountdown(final: boolean) {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  tone(c, final ? 1046 : 523, c.currentTime, final ? 0.4 : 0.12, "triangle", 0.2);
}