import { useCallback } from "react";
import { SongMeta } from "../types";
import { LoadedAnimation } from "../animation";
import { DancingCoach, LEAD_OUTFIT } from "../components/Dancer";

interface Props {
  songs: SongMeta[];
  selectedSong: string;
  onSelect: (id: string) => void;
  serverUrl: string;
  onServerUrl: (url: string) => void;
  onCreateRoom: () => void;
  animation: LoadedAnimation | null;
}

function coverFor(id: string): string | null {
  return id === "demo-song" ? "/cover-demo.png" : null;
}

export default function HomeScreen({ songs, selectedSong, onSelect, serverUrl, onServerUrl, onCreateRoom, animation }: Props) {
  const previewTime = useCallback(() => performance.now() / 1000, []);
  const selectedMeta = songs.find((s) => s.id === selectedSong);

  return (
    <div className="screen home">
      <div className="home-aurora" />
      <div className="home-hero">
        <div className="hero-copy">
          <h1 className="logo">OPEN<span>DANCE</span></h1>
          <p className="tagline">Your phone is the controller.<br />The screen is the stage.</p>
          <label className="field">
            <span className="field-label">Server address</span>
            <input value={serverUrl} onChange={(e) => onServerUrl(e.target.value.trim())} placeholder="http://localhost:3001" />
          </label>
          <button className="primary big" disabled={!selectedSong} onClick={onCreateRoom}>
            Create room
          </button>
        </div>
        <div className="preview-stage">
          <div className="preview-bg" />
          <div className="preview-live">LIVE</div>
          <DancingCoach getTime={previewTime} bpm={selectedMeta?.bpm ?? 120} move={null} animation={animation} loop outfit={LEAD_OUTFIT} className="coach preview-coach" />
          <div className="preview-floor" />
        </div>
      </div>

      <section className="song-section">
        <h2 className="section-title">Pick a song</h2>
        <div className="song-list">
          {songs.map((s) => {
            const cover = coverFor(s.id);
            return (
              <button
                key={s.id}
                className={`song-card ${selectedSong === s.id ? "selected" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                <span className="song-cover">
                  {cover ? <img src={cover} alt="" /> : <span className="song-cover-fallback">{s.title.charAt(0)}</span>}
                </span>
                <span className="song-info">
                  <span className="song-title">{s.title}</span>
                  <span className="song-meta">{s.artist}</span>
                  <span className="song-tags">
                    <span className="tag">{s.bpm} BPM</span>
                    <span className="tag">{Math.round(s.duration)}s</span>
                  </span>
                </span>
                <span className="song-check" aria-hidden="true">✓</span>
              </button>
            );
          })}
          {songs.length === 0 && <p className="muted">No songs found. Is the server running?</p>}
        </div>
      </section>
    </div>
  );
}