import { Pose } from "./components/dance";

export type EaseName = "smooth" | "linear" | "in" | "out" | "snap" | "hold";

export interface DanceKeyframe {
  t: number;
  pose: Pose;
  ease?: EaseName;
}

export interface DanceAnimation {
  id: string;
  version: number;
  bpm: number;
  duration: number;
  keyframes: DanceKeyframe[];
}

const EASE: Record<EaseName, (u: number) => number> = {
  smooth: (u) => u * u * (3 - 2 * u),
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  snap: (u) => 1 - Math.pow(1 - u, 5),
  hold: (u) => (u >= 1 ? 1 : 0)
};

const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
// Limb angles wrap: blend along the shortest arc so a circle release
// continues forward instead of rewinding the long way around.
const lerpAngle = (a: number, b: number, w: number) => a + (((b - a + 540) % 360) - 180) * w;
const lerpPair = (a: [number, number], b: [number, number], w: number): [number, number] => [
  lerpAngle(a[0], b[0], w),
  lerpAngle(a[1], b[1], w)
];

function blendPose(a: Pose, b: Pose, w: number): Pose {
  return {
    hip: lerp(a.hip, b.hip, w),
    lean: lerp(a.lean, b.lean, w),
    aR: lerpPair(a.aR, b.aR, w),
    aL: lerpPair(a.aL, b.aL, w),
    lR: lerpPair(a.lR, b.lR, w),
    lL: lerpPair(a.lL, b.lL, w),
    tilt: lerp(a.tilt, b.tilt, w),
    fist: lerp(a.fist, b.fist, w)
  };
}

export function sampleAnimation(anim: DanceAnimation, t: number): Pose {
  const keys = anim.keyframes;
  if (t <= keys[0].t) return keys[0].pose;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.pose;
  let lo = 0;
  let hi = keys.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = keys[lo];
  const b = keys[hi];
  const u = (t - a.t) / (b.t - a.t);
  const ease = EASE[b.ease ?? "smooth"];
  return blendPose(a.pose, b.pose, ease(u));
}

export async function fetchAnimation(url: string): Promise<DanceAnimation> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dance animation ${url}: HTTP ${res.status}`);
  const anim: DanceAnimation = await res.json();
  if (!Array.isArray(anim.keyframes) || anim.keyframes.length < 2) {
    throw new Error(`Dance animation ${url}: no keyframes`);
  }
  return anim;
}