import { CSSProperties } from "react";
import { PlayerResult } from "../types";
import { PLAYER_COLORS, RATING_COLORS } from "../palette";

interface Props {
  results: PlayerResult[];
  onPlayAgain: () => void;
  onExit: () => void;
}

function Stars({ ratio }: { ratio: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * 5);
  return (
    <div className="star-row" aria-label={`${filled} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={`star ${i < filled ? "lit" : ""}`} style={{ animationDelay: `${0.3 + i * 0.12}s` }}>
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      ))}
    </div>
  );
}

export default function ResultsScreen({ results, onPlayAgain, onExit }: Props) {
  const ranked = [...results].sort((a, b) => b.score - a.score);
  return (
    <div className="screen results">
      <div className="home-aurora" />
      <h1 className="results-title">RESULTS</h1>
      <div className="results-list">
        {ranked.map((r, i) => (
          <div
            key={r.playerName}
            className={`result-card ${i === 0 ? "winner" : ""}`}
            style={{ "--pc": PLAYER_COLORS[i % PLAYER_COLORS.length], animationDelay: `${i * 0.15}s` } as CSSProperties}
          >
            <div className="result-rank">#{i + 1}</div>
            <div className="result-main">
              <div className="result-name">{r.playerName}</div>
              <Stars ratio={r.maxScore > 0 ? r.score / r.maxScore : 0} />
              <div className="result-counts">
                <span style={{ color: RATING_COLORS.perfect }}>{r.counts.perfect} perfect</span>
                <span style={{ color: RATING_COLORS.good }}>{r.counts.good} good</span>
                <span style={{ color: RATING_COLORS.ok }}>{r.counts.ok} ok</span>
                <span style={{ color: RATING_COLORS.miss }}>{r.counts.miss} miss</span>
              </div>
            </div>
            <div className="result-score">
              {r.score}<span className="muted"> / {r.maxScore}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button className="primary big" onClick={onPlayAgain}>Play again</button>
        <button className="ghost" onClick={onExit}>Exit</button>
      </div>
    </div>
  );
}