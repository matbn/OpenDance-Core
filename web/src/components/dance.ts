import { MoveType } from "../types";

export interface Pose {
  hip: number;
  lean: number;
  aR: [number, number];
  aL: [number, number];
  lR: [number, number];
  lL: [number, number];
  tilt: number;
  fist: number;
}

export interface Outfit {
  jacket: string;
  pants: string;
  trim: string;
}

export const LEAD_OUTFIT: Outfit = { jacket: "#ff2d95", pants: "#22d3ee", trim: "#ffc93c" };
export const BACKUP_OUTFIT: Outfit = { jacket: "#8b5cf6", pants: "#8dff00", trim: "#ff2d95" };

const TORSO = 44, UPPER_ARM = 26, FORE_ARM = 24, THIGH = 30, SHIN = 28;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => x * x * (3 - 2 * x);
const dir = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
};

export function groove(t: number, beat: number): Pose {
  const bounce = Math.abs(Math.sin(beat * Math.PI));
  const sway = Math.sin(beat * Math.PI);
  const step = Math.sin(beat * 2 * Math.PI);
  const drift = Math.sin(t * 0.7) * 2;
  // Arms pump with the bounce but stay below shoulder height: an overhead
  // gesture here would read as a move cue in the gap before every move.
  const pump = 8 * bounce;
  return {
    hip: -8 * bounce,
    lean: 7 * sway + drift,
    aR: [62 + 22 * sway - pump, 84 + 16 * sway - 0.75 * pump],
    aL: [118 - 22 * sway - pump, 96 - 16 * sway - 0.75 * pump],
    lR: [78 + 9 * step, 88 + 6 * step],
    lL: [102 - 9 * step, 92 - 6 * step],
    tilt: 6 * sway + drift,
    fist: 1
  };
}

export function movePose(type: MoveType, p: number, t: number, beat: number): Pose {
  const q = Math.min(1, p * 2.2);
  const e = 1 - Math.pow(1 - q, 3);
  const base: Pose = {
    hip: -6 * Math.abs(Math.sin(beat * Math.PI)),
    lean: 0,
    aR: [65, 88],
    aL: [115, 135],
    lR: [70, 86],
    lL: [110, 94],
    tilt: 3 * Math.sin(beat * Math.PI),
    fist: 1
  };
  switch (type) {
    case "arm_up":
      return { ...base, lean: -4, aR: [lerp(65, -85, e) + 6 * Math.sin(beat * 2 * Math.PI), lerp(88, -95, e)] };
    case "arm_down":
      return { ...base, lean: 4, aR: [lerp(-85, 75, e), lerp(-95, 92, e)] };
    case "arm_right":
      return { ...base, lean: 8, aR: [lerp(130, 5, e), lerp(95, -5, e)], aL: [120, 140] };
    case "arm_left":
      return { ...base, lean: -8, aR: [lerp(55, 175, e), lerp(85, 185, e)], aL: [110, 130] };
    case "punch": {
      const jab = Math.max(0, Math.sin(p * 4 * Math.PI));
      return { ...base, lean: 6 * jab, fist: 1 + 0.5 * jab, aR: [lerp(55, 2, jab), lerp(115, 2, jab)], aL: [115, 140] };
    }
    case "shake": {
      const osc = Math.sin(t * 24);
      return { ...base, lean: 3 * osc, aR: [50 + 22 * osc, 15 + 18 * Math.cos(t * 24)], aL: [130 - 22 * osc, 165 - 18 * Math.cos(t * 24)] };
    }
    case "circle": {
      const ang = -90 + p * 360;
      return { ...base, lean: 5 * Math.sin(p * 2 * Math.PI), aR: [ang, ang + 15] };
    }
    case "wave":
      return { ...base, tilt: 6 * Math.sin(t * 6), aR: [-55, -95 + 30 * Math.sin(t * 12)], aL: [112, 98] };
    default:
      return base;
  }
}

export function blendPose(a: Pose, b: Pose, w: number): Pose {
  return {
    hip: lerp(a.hip, b.hip, w),
    lean: lerp(a.lean, b.lean, w),
    aR: [lerp(a.aR[0], b.aR[0], w), lerp(a.aR[1], b.aR[1], w)],
    aL: [lerp(a.aL[0], b.aL[0], w), lerp(a.aL[1], b.aL[1], w)],
    lR: [lerp(a.lR[0], b.lR[0], w), lerp(a.lR[1], b.lR[1], w)],
    lL: [lerp(a.lL[0], b.lL[0], w), lerp(a.lL[1], b.lL[1], w)],
    tilt: lerp(a.tilt, b.tilt, w),
    fist: lerp(a.fist, b.fist, w)
  };
}

export function moveWeight(elapsed: number, remaining: number): number {
  return smooth(Math.min(1, elapsed / 0.3)) * smooth(Math.min(1, remaining / 0.3));
}

export interface Skeleton {
  hip: [number, number];
  neck: [number, number];
  head: [number, number];
  elbowR: [number, number];
  handR: [number, number];
  elbowL: [number, number];
  handL: [number, number];
  kneeR: [number, number];
  footR: [number, number];
  kneeL: [number, number];
  footL: [number, number];
}

const add = (p: [number, number], len: number, deg: number): [number, number] => {
  const d = dir(deg);
  return [p[0] + len * d[0], p[1] + len * d[1]];
};

export function skeleton(pose: Pose): Skeleton {
  const hip: [number, number] = [100, 150 + pose.hip];
  const neck = add(hip, TORSO, -90 + pose.lean);
  const head = add(neck, 18, -90 + pose.tilt);
  const elbowR = add(neck, UPPER_ARM, pose.aR[0]);
  const handR = add(elbowR, FORE_ARM, pose.aR[1]);
  const elbowL = add(neck, UPPER_ARM, pose.aL[0]);
  const handL = add(elbowL, FORE_ARM, pose.aL[1]);
  const kneeR = add(hip, THIGH, pose.lR[0]);
  const footR = add(kneeR, SHIN, pose.lR[1]);
  const kneeL = add(hip, THIGH, pose.lL[0]);
  const footL = add(kneeL, SHIN, pose.lL[1]);
  return { hip, neck, head, elbowR, handR, elbowL, handL, kneeR, footR, kneeL, footL };
}