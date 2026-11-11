import { CSSProperties } from "react";
import { Rating } from "../types";
import { RATING_COLORS, RATING_TEXT } from "../palette";

function starPoints(spikes: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const dist = 55 + (i % 4) * 18;
  return {
    "--dx": `${Math.cos(angle) * dist}px`,
    "--dy": `${Math.sin(angle) * dist - 30}px`,
    "--rot": `${(i * 137) % 360}deg`,
    "--cc": ["#ffc93c", "#ff2d95", "#22d3ee", "#8dff00"][i % 4],
    animationDelay: `${(i % 5) * 0.03}s`
  } as CSSProperties;
});

export default function RatingBurst({ rating }: { rating: Rating }) {
  const color = RATING_COLORS[rating];
  const celebrate = rating === "perfect" || rating === "good";
  return (
    <div className={`rating-burst rating-${rating}`}>
      {celebrate && (
        <div className="confetti">
          {CONFETTI.map((style, i) => <i key={i} style={style} />)}
        </div>
      )}
      <svg viewBox="0 0 100 100" className="burst-star">
        <polygon points={starPoints(12, 49, 36)} fill={color} stroke="#ffffff" strokeWidth={2.5} />
        <polygon points={starPoints(12, 40, 30)} fill="none" stroke="#0d0b14" strokeWidth={1.4} opacity={0.35} />
      </svg>
      <span className="burst-label" style={{ color: rating === "ok" ? "#0d0b14" : "#ffffff" }}>
        {RATING_TEXT[rating]}
      </span>
    </div>
  );
}