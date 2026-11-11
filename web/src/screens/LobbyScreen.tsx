import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { SongMeta, wsUrl } from "../types";
import { DanceAnimation } from "../animation";
import { DancingCoach, BACKUP_OUTFIT } from "../components/Dancer";
import { PLAYER_COLORS } from "../palette";

interface Props {
  roomCode: string;
  players: string[];
  songs: SongMeta[];
  selectedSong: string;
  onSelect: (id: string) => void;
  serverUrl: string;
  onStart: () => void;
  onLeave: () => void;
  animation: DanceAnimation | null;
}

export default function LobbyScreen({ roomCode, players, songs, selectedSong, onSelect, serverUrl, onStart, onLeave, animation }: Props) {
  const [qr, setQr] = useState("");
  const previewTime = useCallback(() => performance.now() / 1000, []);
  const selectedMeta = songs.find((s) => s.id === selectedSong);

  useEffect(() => {
    QRCode.toDataURL(JSON.stringify({ server: wsUrl(serverUrl), room: roomCode }), {
      width: 220,
      margin: 1,
      color: { dark: "#171226", light: "#ffffff" }
    }).then(setQr);
  }, [roomCode, serverUrl]);

  return (
    <div className="screen lobby">
      <div className="home-aurora" />
      <p className="lobby-kicker">ROOM CODE</p>
      <h1 className="room-code">{roomCode}</h1>
      <p className="tagline">Open the OpenDance app on your phone and enter this code.</p>

      <div className="lobby-grid">
        <div className="qr-panel panel">
          <div className="qr-frame">
            {qr && <img src={qr} alt="Room QR code" width={220} height={220} />}
          </div>
          <p className="muted qr-server">Server: {serverUrl}</p>
        </div>

        <div className="lobby-coach">
          <DancingCoach getTime={previewTime} bpm={selectedMeta?.bpm ?? 120} move={null} animation={animation} loop outfit={BACKUP_OUTFIT} className="coach lobby-dancer" />
        </div>

        <div className="players-panel panel">
          <h2 className="panel-title">Dancers <span className="dancer-count">{players.length}</span></h2>
          <ul className="player-list">
            {players.map((p, i) => (
              <li key={p} className="player-chip">
                <span className="player-dot" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                {p}
              </li>
            ))}
            {players.length === 0 && <li className="muted waiting">Waiting for dancers to join…</li>}
          </ul>
          <label className="field">
            <span className="field-label">Song</span>
            <select value={selectedSong} onChange={(e) => onSelect(e.target.value)}>
              {songs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="button-row">
        <button className="primary big" disabled={players.length === 0} onClick={onStart}>
          Start dancing
        </button>
        <button className="ghost" onClick={onLeave}>Leave room</button>
      </div>
      {players.length === 0 && <p className="muted">At least one phone must join before starting.</p>}
    </div>
  );
}