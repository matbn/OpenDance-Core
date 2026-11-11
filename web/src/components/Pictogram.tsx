import { MoveType } from "../types";
import { movePose, skeleton } from "./dance";

const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

export default function Pictogram({ type, className }: { type: MoveType; className?: string }) {
  const s = skeleton(movePose(type, 0.55, 0, 0));
  const body = "#f4f1ff";
  const accent = "#ffc93c";
  return (
    <svg viewBox="30 10 140 240" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g stroke={body}>
        <path d={`M${pt(s.hip)} L${pt(s.kneeL)} L${pt(s.footL)}`} strokeWidth={9} />
        <path d={`M${pt(s.hip)} L${pt(s.kneeR)} L${pt(s.footR)}`} strokeWidth={9} />
        <path d={`M${pt(s.hip)} L${pt(s.neck)}`} strokeWidth={16} />
        <path d={`M${pt(s.neck)} L${pt(s.elbowL)} L${pt(s.handL)}`} strokeWidth={8} />
      </g>
      <circle cx={s.head[0]} cy={s.head[1]} r={12} fill={body} stroke="none" />
      <path d={`M${pt(s.neck)} L${pt(s.elbowR)} L${pt(s.handR)}`} stroke={accent} strokeWidth={9} />
      <circle cx={s.handR[0]} cy={s.handR[1]} r={7} fill={accent} stroke="none" />
    </svg>
  );
}