import { Pose } from "./components/dance";
import { BvhClip, parseBvh, sampleBvh } from "./bvh";

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

export function blendPose(a: Pose, b: Pose, w: number): Pose {
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

// A choreography dance is either hand-authored keyframes (JSON) or a full
// mocap clip (BVH). Scored moves blend over whichever base is playing.
export type LoadedAnimation =
  | { kind: "keys"; anim: DanceAnimation }
  | { kind: "bvh"; clip: BvhClip };

export function parseAnimationText(name: string, text: string): LoadedAnimation {
  if (/^\s*HIERARCHY/i.test(text)) return { kind: "bvh", clip: parseBvh(text, name) };
  const anim: DanceAnimation = JSON.parse(text);
  if (!Array.isArray(anim.keyframes) || anim.keyframes.length < 2) {
    throw new Error(`Dance animation ${name}: no keyframes`);
  }
  return { kind: "keys", anim };
}

export function animationDuration(loaded: LoadedAnimation): number {
  return loaded.kind === "bvh" ? loaded.clip.duration : loaded.anim.duration;
}

export function sampleLoaded(loaded: LoadedAnimation, t: number): Pose {
  return loaded.kind === "bvh" ? sampleBvh(loaded.clip, t) : sampleAnimation(loaded.anim, t);
}

export async function fetchAnimation(url: string): Promise<LoadedAnimation> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dance animation ${url}: HTTP ${res.status}`);
  try {
    return parseAnimationText(url, await res.text());
  } catch (e) {
    throw new Error(`Dance animation ${url}: ${e instanceof Error ? e.message : "unreadable file"}`);
  }
}