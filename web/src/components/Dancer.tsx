import { useEffect, useRef, useState } from "react";
import { Move } from "../types";
import { LoadedAnimation, animationDuration, blendPose, sampleLoaded } from "../animation";
import {
  BACKUP_OUTFIT,
  LEAD_OUTFIT,
  Outfit,
  Pose,
  groove,
  movePose,
  moveWeight,
  skeleton
} from "./dance";

export { LEAD_OUTFIT, BACKUP_OUTFIT };

interface FigureProps {
  pose: Pose;
  outfit: Outfit;
  mirror?: boolean;
  className?: string;
}

const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

export function DancerFigure({ pose, outfit, mirror, className }: FigureProps) {
  const s = skeleton(pose);
  const legR = `M${pt(s.hip)} L${pt(s.kneeR)} L${pt(s.footR)}`;
  const legL = `M${pt(s.hip)} L${pt(s.kneeL)} L${pt(s.footL)}`;
  const torso = `M${pt(s.hip)} L${pt(s.neck)}`;
  const armR = `M${pt(s.neck)} L${pt(s.elbowR)} L${pt(s.handR)}`;
  const armL = `M${pt(s.neck)} L${pt(s.elbowL)} L${pt(s.handL)}`;
  const [hx, hy] = s.head;
  const handR = 6 * pose.fist;

  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden="true">
      <g transform={mirror ? "translate(200 0) scale(-1 1)" : undefined}>
        <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
          <path d={legR} strokeWidth={16} />
          <path d={legL} strokeWidth={16} />
          <path d={torso} strokeWidth={31} />
          <path d={armL} strokeWidth={15} />
          <path d={armR} strokeWidth={15} />
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={legR} stroke={outfit.pants} strokeWidth={10} />
          <path d={legL} stroke={outfit.pants} strokeWidth={10} />
          <path d={torso} stroke={outfit.jacket} strokeWidth={24} />
          <path d={armL} stroke={outfit.jacket} strokeWidth={9} />
          <path d={armR} stroke={outfit.jacket} strokeWidth={9} />
        </g>
        <ellipse cx={s.footR[0] + 3} cy={s.footR[1] + 2} rx={11} ry={5.5} fill={outfit.trim} stroke="#fff" strokeWidth={2.5} />
        <ellipse cx={s.footL[0] + 3} cy={s.footL[1] + 2} rx={11} ry={5.5} fill={outfit.trim} stroke="#fff" strokeWidth={2.5} />
        <circle cx={s.handL[0]} cy={s.handL[1]} r={6} fill={outfit.trim} stroke="#fff" strokeWidth={2.5} />
        <circle cx={s.handR[0]} cy={s.handR[1]} r={handR} fill={outfit.trim} stroke="#fff" strokeWidth={2.5} />
        <g transform={`rotate(${pose.tilt.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)})`}>
          <circle cx={hx} cy={hy} r={13} fill="#ffffff" />
          <path
            d={`M${hx - 13},${hy} a13,13 0 0,1 26,0 Z`}
            fill={outfit.trim}
          />
          <rect x={hx - 14.5} y={hy - 8} width={5} height={4} rx={1.5} fill={outfit.trim} />
          <rect x={hx - 10} y={hy - 3} width={8.5} height={6} rx={2.5} fill="#0d0b14" />
          <rect x={hx + 1.5} y={hy - 3} width={8.5} height={6} rx={2.5} fill="#0d0b14" />
          <rect x={hx - 2} y={hy - 1.5} width={4} height={2} fill="#0d0b14" />
        </g>
      </g>
    </svg>
  );
}

interface CoachProps {
  getTime: () => number;
  bpm: number;
  move: Move | null;
  outfit: Outfit;
  mirror?: boolean;
  className?: string;
  animation?: LoadedAnimation | null;
  loop?: boolean;
}

export function DancingCoach({ getTime, bpm, move, outfit, mirror, className, animation, loop }: CoachProps) {
  const [, setTick] = useState(0);
  const propsRef = useRef({ getTime, bpm, move, animation, loop });
  propsRef.current = { getTime, bpm, move, animation, loop };

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { getTime: gt, bpm: b, move: m, animation: anim, loop: doLoop } = propsRef.current;
  const t = gt();
  const beat = (t * b) / 60;
  // The imported dance plays continuously; the scored move is a temporary
  // override blended in and out over it, never a replacement.
  let pose: Pose;
  if (anim && t >= 0) {
    const dur = animationDuration(anim);
    const at = doLoop && dur > 0 ? t % dur : t;
    pose = sampleLoaded(anim, at);
  } else {
    pose = groove(t, beat);
  }
  if (m) {
    const elapsed = t - m.time;
    const remaining = m.time + m.duration - t;
    if (elapsed >= 0 && remaining >= 0) {
      pose = blendPose(
        pose,
        movePose(m.type, elapsed / m.duration, t, beat),
        moveWeight(elapsed, remaining)
      );
    }
  }
  return <DancerFigure pose={pose} outfit={outfit} mirror={mirror} className={className} />;
}