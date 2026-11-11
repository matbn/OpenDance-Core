import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Choreography, LiveScore, Rating } from "../types";
import { DanceAnimation, fetchAnimation } from "../animation";
import { DancingCoach, LEAD_OUTFIT, BACKUP_OUTFIT } from "../components/Dancer";
import Pictogram from "../components/Pictogram";
import RatingBurst from "../components/RatingBurst";
import { playCountdown, playRating, setSfxMuted } from "../components/sfx";
import { PLAYER_COLORS } from "../palette";

interface Props {
  choreo: Choreography;
  startAt: number;
  getOffset: () => number;
  serverUrl: string;
  scores: Record<string, LiveScore>;
}

const RATING_RANK: Record<Rating, number> = { miss: 0, ok: 1, good: 2, perfect: 3 };

function fmtTime(s: number): string {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="15" y1="9" x2="21" y2="15" />
          <line x1="21" y1="9" x2="15" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

export default function GameScreen({ choreo, startAt, getOffset, serverUrl, scores }: Props) {
  const [songTime, setSongTime] = useState(-5);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [anim, setAnim] = useState<DanceAnimation | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const lastCountRef = useRef(99);
  const lastScoredRef = useRef(-1);

  useEffect(() => {
    setAnim(null);
    if (!choreo.animation) return;
    let alive = true;
    fetchAnimation(`${serverUrl}${choreo.animation}`)
      .then((a) => { if (alive) setAnim(a); })
      .catch((err) => console.warn("Dance animation unavailable, using procedural moves:", err));
    return () => { alive = false; };
  }, [choreo, serverUrl]);

  const getTime = useCallback(
    () => (Date.now() + getOffset() - startAt) / 1000,
    [startAt, getOffset]
  );
  const getBackupTime = useCallback(() => getTime() - 0.12, [getTime]);

  useEffect(() => {
    const audio = new Audio(`${serverUrl}${choreo.audio}`);
    audio.preload = "auto";
    audioRef.current = audio;
    const iv = window.setInterval(() => {
      const t = (Date.now() + getOffset() - startAt) / 1000;
      setSongTime(t);
      if (t >= 0 && !startedRef.current) {
        startedRef.current = true;
        audio.currentTime = Math.max(0, t);
        audio.play().catch(() => setAudioBlocked(true));
      } else if (startedRef.current && Math.abs(audio.currentTime - t) > 0.35) {
        audio.currentTime = Math.max(0, Math.min(t, choreo.duration));
      }
    }, 100);
    return () => {
      window.clearInterval(iv);
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choreo, startAt, serverUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    setSfxMuted(muted);
  }, [muted]);

  useEffect(() => () => setSfxMuted(false), []);

  const count = songTime < 0 ? Math.ceil(-songTime) : 0;
  useEffect(() => {
    if (count > 0 && count !== lastCountRef.current) {
      lastCountRef.current = count;
      playCountdown(false);
    } else if (count === 0 && lastCountRef.current !== 0) {
      lastCountRef.current = 0;
      playCountdown(true);
    }
  }, [count]);

  useEffect(() => {
    let best: Rating | null = null;
    let newest = lastScoredRef.current;
    for (const s of Object.values(scores)) {
      if (s.rating && s.moveIndex > lastScoredRef.current) {
        newest = Math.max(newest, s.moveIndex);
        if (!best || RATING_RANK[s.rating] > RATING_RANK[best]) best = s.rating;
      }
    }
    if (best) {
      lastScoredRef.current = newest;
      playRating(best);
    }
  }, [scores]);

  const current = choreo.moves.find((m) => songTime >= m.time && songTime <= m.time + m.duration) ?? null;
  const upcoming = choreo.moves.filter((m) => m.time > songTime).slice(0, 3);
  const progress = Math.max(0, Math.min(1, songTime / choreo.duration));
  const beatDur = `${(60 / choreo.bpm).toFixed(3)}s`;

  return (
    <div className="screen game">
      <div className="stage-bg" />
      <div className="stage-shade" />
      <div className="spotlight spot-a" />
      <div className="spotlight spot-b" />
      <div className="beat-glow" style={{ animationDuration: beatDur }} />

      <header className="hud-top">
        <div className="song-chip">
          <span className="chip-disc" />
          <span className="chip-title">{choreo.title}</span>
          <span className="chip-artist">{choreo.artist}</span>
        </div>
        <button
          className={`mute-btn ${muted ? "is-muted" : ""}`}
          aria-pressed={muted}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          title={muted ? "Unmute sound" : "Mute sound"}
          onClick={() => setMuted((m) => !m)}
        >
          <SoundIcon muted={muted} />
        </button>
      </header>

      <div className="banner-row">
        {Object.entries(scores).map(([name, s], i) => (
          <div className="player-banner" key={name} style={{ "--pc": PLAYER_COLORS[i % PLAYER_COLORS.length] } as CSSProperties}>
            <div className="burst-slot">
              {s.rating && <RatingBurst key={`${name}-${s.moveIndex}`} rating={s.rating} />}
            </div>
            <div className="ribbon"><span className="ribbon-name">{name}</span></div>
            <div className="banner-score">{s.score}</div>
          </div>
        ))}
      </div>

      <div className="coach-zone">
        <div className="floor-glow" />
        <DancingCoach getTime={getBackupTime} bpm={choreo.bpm} move={current} animation={anim} outfit={BACKUP_OUTFIT} mirror className="coach backup" />
        <DancingCoach getTime={getTime} bpm={choreo.bpm} move={current} animation={anim} outfit={LEAD_OUTFIT} className="coach lead" />
      </div>

      {songTime < 0 && (
        <div className="countdown-overlay">
          <div className="countdown-tag">GET READY</div>
          <div className="countdown-num" key={count}>{count}</div>
        </div>
      )}
      {songTime >= 0 && songTime < 0.9 && <div className="go-burst">GO!</div>}

      {audioBlocked && (
        <button
          className="primary enable-sound"
          onClick={() => audioRef.current?.play().then(() => setAudioBlocked(false))}
        >
          Enable sound
        </button>
      )}

      <footer className="hud-bottom">
        <div className="track-info">
          <div className="track-title">{choreo.title}</div>
          <div className="track-progress"><div className="track-fill" style={{ width: `${progress * 100}%` }} /></div>
          <div className="track-time">{fmtTime(songTime)} / {fmtTime(choreo.duration)}</div>
        </div>
        <div className="move-strip">
          {current && (
            <div className="move-card now" key={`now-${current.time}`}>
              <Pictogram type={current.type} className="move-picto" />
              <span className="move-card-label">{current.label}</span>
            </div>
          )}
          {upcoming.map((m, i) => (
            <div className={`move-card next ${i === 0 ? "next-first" : ""}`} key={m.time}>
              <Pictogram type={m.type} className="move-picto" />
              <span className="move-card-label">{m.label}</span>
              <span className="move-card-eta">{Math.max(0, Math.ceil(m.time - songTime))}s</span>
            </div>
          ))}
          {!current && upcoming.length === 0 && songTime >= 0 && <div className="move-card finale">FINISH!</div>}
        </div>
      </footer>
    </div>
  );
}