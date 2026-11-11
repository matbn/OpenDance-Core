// Bakes a full-song dance animation (continuous keyframed pose timeline)
// from a choreography's scored moves. Usage: node scripts/generate-dance.mjs [songId]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const songId = process.argv[2] || "demo-song";
const song = JSON.parse(readFileSync(path.join(root, "choreographies", "songs", `${songId}.json`), "utf8"));

const BEAT = 60 / song.bpm;
const r2 = (n) => Math.round(n * 100) / 100;

// pose tuple: hip, lean, aR0, aR1, aL0, aL1, lR0, lR1, lL0, lL1, tilt, fist
const N = [0, 0, 62, 84, 118, 96, 78, 88, 102, 92, 0, 1];
const keys = [];
function key(t, p, ease) {
  keys.push({
    t: r2(t),
    pose: {
      hip: r2(p[0]), lean: r2(p[1]),
      aR: [r2(p[2]), r2(p[3])], aL: [r2(p[4]), r2(p[5])],
      lR: [r2(p[6]), r2(p[7])], lL: [r2(p[8]), r2(p[9])],
      tilt: r2(p[10]), fist: r2(p[11] ?? 1)
    },
    ...(ease ? { ease } : {})
  });
}

// Phrases emit keys at fractions of their span and return their end pose,
// so consecutive phrases chain into one continuous dance.
const PHRASES = {
  bounce: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-8, 4, 54, 78, 126, 90, 78, 88, 102, 92, 3]);
    key(t0 + s * 0.5, [0, -5, 70, 90, 110, 102, 84, 92, 96, 88, -3]);
    key(t0 + s * 0.75, [-8, 5, 54, 78, 126, 90, 78, 88, 102, 92, 3]);
    const end = [0, 0, 66, 86, 114, 98, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  stepTouch: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-4, 7, 40, 70, 132, 150, 60, 80, 104, 94, 5], "out");
    key(t0 + s * 0.5, [-6, 0, 60, 84, 120, 96, 88, 92, 92, 88, 0]);
    key(t0 + s * 0.75, [-4, -7, 132, 150, 40, 70, 104, 94, 60, 80, -5], "out");
    const end = [-6, 0, 60, 84, 120, 96, 88, 92, 92, 88, 0];
    key(t1, end);
    return end;
  },
  discoPoint: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-6, -6, -45, -60, 122, 148, 74, 86, 106, 94, -4], "snap");
    key(t0 + s * 0.5, [2, 6, 62, 84, 150, 168, 82, 90, 98, 90, 4]);
    key(t0 + s * 0.75, [-6, -6, -45, -60, 122, 148, 74, 86, 106, 94, -4], "snap");
    const end = [0, 0, 50, 70, 124, 100, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  armWave: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-3, 3, 10, -20, 122, 100, 78, 88, 102, 92, 2]);
    key(t0 + s * 0.5, [-6, -3, -30, -70, 126, 104, 80, 89, 100, 91, -2]);
    key(t0 + s * 0.75, [-3, 3, -60, -100, 120, 98, 78, 88, 102, 92, 2]);
    const end = [0, 0, 20, 40, 118, 96, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  runningMan: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-6, 4, 40, 70, 130, 110, 30, 60, 100, 95, 3], "out");
    key(t0 + s * 0.5, [-2, 0, 62, 84, 118, 96, 80, 89, 100, 91, 0]);
    key(t0 + s * 0.75, [-6, -4, 130, 110, 40, 70, 100, 95, 30, 60, -3], "out");
    const end = [-2, 0, 62, 84, 118, 96, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  hipSway: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-4, 10, -15, -35, 135, 115, 70, 84, 108, 96, 8]);
    key(t0 + s * 0.5, [-8, -10, 135, 115, -15, -35, 108, 96, 70, 84, -8]);
    key(t0 + s * 0.75, [-4, 10, -15, -35, 135, 115, 70, 84, 108, 96, 8]);
    const end = [0, 0, 62, 84, 118, 96, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  kickStep: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-4, 5, 120, 100, 30, 20, 20, 10, 100, 95, 4], "snap");
    key(t0 + s * 0.5, [0, 0, 62, 84, 118, 96, 80, 89, 100, 91, 0]);
    key(t0 + s * 0.75, [-4, -5, 30, 20, 120, 100, 100, 95, 20, 10, -4], "snap");
    const end = [0, 0, 62, 84, 118, 96, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  spinTurn: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-4, 12, 70, 110, 110, 70, 84, 92, 96, 88, 10]);
    key(t0 + s * 0.5, [-6, -12, 20, 10, 160, 170, 76, 86, 104, 94, -10], "out");
    key(t0 + s * 0.75, [-4, 8, 70, 110, 110, 70, 84, 92, 96, 88, 8]);
    const end = [0, 0, 40, 60, 140, 120, 80, 89, 100, 91, 0];
    key(t1, end);
    return end;
  },
  jumpJack: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [-10, 0, -70, -90, -110, -90, 60, 70, 120, 110, 0], "out");
    key(t0 + s * 0.5, [0, 0, 62, 84, 118, 96, 86, 92, 94, 88, 0]);
    key(t0 + s * 0.75, [-10, 0, -70, -90, -110, -90, 60, 70, 120, 110, 0], "out");
    const end = [0, 0, 62, 84, 118, 96, 86, 92, 94, 88, 0];
    key(t1, end);
    return end;
  },
  bodyRoll: (t0, t1) => {
    const s = t1 - t0;
    key(t0 + s * 0.25, [2, 6, 70, 92, 110, 88, 78, 88, 102, 92, 12]);
    key(t0 + s * 0.5, [-6, -6, 54, 76, 126, 104, 80, 89, 100, 91, -8]);
    key(t0 + s * 0.75, [0, 4, 66, 88, 114, 92, 78, 88, 102, 92, 6]);
    const end = N;
    key(t1, end);
    return end;
  }
};
const CONNECTORS = ["stepTouch", "discoPoint", "runningMan", "armWave", "hipSway", "kickStep", "spinTurn", "jumpJack", "bodyRoll", "bounce"];

function perform(T, type) {
  key(T - 0.15, [4, 0, 66, 88, 114, 92, 82, 90, 98, 90, 0], "in");
  const end = N;
  switch (type) {
    case "arm_up":
      key(T + 0.05, [-6, -4, -80, -95, 115, 140, 76, 86, 104, 94, -3], "snap");
      key(T + 0.6, [-2, -2, -70, -85, 112, 136, 78, 88, 102, 92, -2]);
      key(T + 1.1, [-8, -4, -85, -100, 118, 142, 74, 84, 106, 96, -3]);
      key(T + 1.6, [-3, -2, -60, -80, 112, 134, 78, 88, 102, 92, -1]);
      break;
    case "arm_down":
      key(T + 0.05, [4, 4, 70, 88, 110, 92, 74, 86, 106, 96, 3], "snap");
      key(T + 0.6, [6, 3, 76, 92, 104, 88, 72, 84, 108, 98, 2]);
      key(T + 1.1, [4, 5, 68, 86, 112, 94, 76, 88, 104, 94, 4]);
      key(T + 1.6, [2, 2, 64, 84, 116, 96, 78, 88, 102, 92, 1]);
      break;
    case "arm_right":
      key(T + 0.05, [-2, 8, 5, -5, 125, 145, 74, 86, 106, 96, 5], "snap");
      key(T + 0.6, [-2, 6, 15, 5, 122, 142, 76, 88, 104, 94, 4]);
      key(T + 1.1, [-4, 10, 0, -10, 128, 148, 72, 84, 108, 98, 6]);
      key(T + 1.6, [-1, 5, 20, 10, 120, 140, 78, 88, 102, 92, 3]);
      break;
    case "arm_left":
      key(T + 0.05, [-2, -8, 175, 185, 110, 130, 106, 96, 74, 86, -5], "snap");
      key(T + 0.6, [-2, -6, 165, 175, 112, 132, 104, 94, 76, 88, -4]);
      key(T + 1.1, [-4, -10, 180, 190, 108, 128, 108, 98, 72, 84, -6]);
      key(T + 1.6, [-1, -5, 160, 170, 114, 134, 102, 92, 78, 88, -3]);
      break;
    case "shake":
      for (let i = 0; i <= 8; i++) {
        const o = Math.sin(i * 1.9);
        key(T + 0.05 + i * 0.24, [-3, 3 * o, 50 + 22 * o, 15 + 18 * Math.cos(i * 1.9), 130 - 22 * o, 165 - 18 * Math.cos(i * 1.9), 78, 88, 102, 92, 2 * o], i === 0 ? "snap" : "linear");
      }
      break;
    case "circle":
      for (let i = 0; i <= 8; i++) {
        const ang = -90 + (i / 8) * 360;
        key(T + 0.05 + i * 0.21, [-4, 5 * Math.sin((i / 8) * 2 * Math.PI), ang, ang + 15, 118, 96, 78, 88, 102, 92, 3], i === 0 ? "snap" : "linear");
      }
      break;
    case "punch":
      key(T + 0.05, [-2, 4, 55, 115, 115, 140, 76, 86, 104, 94, 3], "snap");
      for (let i = 0; i < 3; i++) {
        key(T + 0.5 + i * 0.5, [-3, 6, 2, 2, 118, 142, 74, 84, 106, 96, 4], "snap");
        key(T + 0.75 + i * 0.5, [-1, 3, 50, 110, 115, 140, 78, 88, 102, 92, 2]);
      }
      break;
    case "wave":
      key(T + 0.05, [-2, 0, -55, -95, 112, 98, 78, 88, 102, 92, 4], "snap");
      for (let i = 1; i <= 6; i++) {
        key(T + 0.05 + i * 0.3, [-2, 0, -55, -95 + 30 * Math.sin(i * 1.6), 112, 98, 78, 88, 102, 92, 6 * Math.sin(i * 1.1)], "linear");
      }
      break;
    default:
      key(T + 0.05, [-4, 0, 62, 84, 118, 96, 78, 88, 102, 92, 0], "snap");
  }
  key(T + 2, end);
  return end;
}

key(0, N);
let t = 0;
let cur = N;
const first = song.moves[0]?.time ?? 4;
cur = PHRASES.bounce(0, first * 0.45);
cur = PHRASES.stepTouch(first * 0.45, first - 0.3);
t = first - 0.3;

song.moves.forEach((move, i) => {
  cur = perform(move.time, move.type);
  const nextT = song.moves[i + 1]?.time ?? song.duration - 6;
  const gapEnd = (song.moves[i + 1] ? nextT : song.duration - 6) - 0.3;
  if (gapEnd > move.time + 2) {
    cur = PHRASES[CONNECTORS[i % CONNECTORS.length]](move.time + 2, gapEnd);
  }
  t = gapEnd;
});

const outroStart = (song.moves.at(-1)?.time ?? song.duration - 8) + 2;
cur = PHRASES.bounce(outroStart, outroStart + 2);
cur = PHRASES.spinTurn(outroStart + 2, outroStart + 3.5);
key(outroStart + 4.5, [-10, -6, -75, -95, -105, -85, 66, 78, 114, 102, -6], "snap");
key(outroStart + 5.2, [-10, -6, -75, -95, -105, -85, 66, 78, 114, 102, -6], "hold");
cur = PHRASES.bodyRoll(outroStart + 5.2, song.duration);

keys.sort((a, b) => a.t - b.t);
const dedup = keys.filter((k, i) => i === 0 || k.t > keys[i - 1].t);

const out = {
  id: `${song.id}-dance`,
  version: 1,
  bpm: song.bpm,
  duration: song.duration,
  keyframes: dedup
};
const dir = path.join(root, "choreographies", "dances");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${song.id}.json`);
writeFileSync(file, JSON.stringify(out));
console.log(`Wrote ${file}: ${dedup.length} keyframes, ${song.duration}s, ${(JSON.stringify(out).length / 1024).toFixed(1)} kB`);