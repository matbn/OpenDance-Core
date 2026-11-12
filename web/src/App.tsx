import { useEffect, useRef, useState } from "react";
import { Choreography, LiveScore, PlayerResult, SongMeta, wsUrl } from "./types";
import { LoadedAnimation, fetchAnimation } from "./animation";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";
import ResultsScreen from "./screens/ResultsScreen";

type Screen = "home" | "lobby" | "game" | "results";

export default function App() {
  const [serverUrl, setServerUrl] = useState(
    () =>
      localStorage.getItem("opendance-server") ||
      // Served by the OpenDance server itself: its origin is the server address.
      (window.location.port === "5173" ? "http://localhost:3001" : window.location.origin)
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [selectedSong, setSelectedSong] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [game, setGame] = useState<{ choreo: Choreography; startAt: number } | null>(null);
  const [scores, setScores] = useState<Record<string, LiveScore>>({});
  const [results, setResults] = useState<PlayerResult[] | null>(null);
  const [error, setError] = useState("");
  const [previewAnim, setPreviewAnim] = useState<LoadedAnimation | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  const pingRef = useRef<number | null>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    localStorage.setItem("opendance-server", serverUrl);
    fetch(`${serverUrl}/api/songs`)
      .then((r) => r.json())
      .then((list: SongMeta[]) => {
        setSongs(list);
        setSelectedSong((cur) => cur || list[0]?.id || "");
        setError("");
      })
      .catch(() => setError(`Cannot reach server at ${serverUrl}`));
  }, [serverUrl]);

  useEffect(() => () => cleanup(), []);

  useEffect(() => {
    const meta = songs.find((s) => s.id === selectedSong);
    setPreviewAnim(null);
    if (!meta?.animation) return;
    let alive = true;
    fetchAnimation(`${serverUrl}${meta.animation}`)
      .then((a) => { if (alive) setPreviewAnim(a); })
      .catch(() => {});
    return () => { alive = false; };
  }, [songs, selectedSong, serverUrl]);

  function cleanup() {
    if (pingRef.current) window.clearInterval(pingRef.current);
    pingRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
  }

  function send(msg: object) {
    wsRef.current?.send(JSON.stringify(msg));
  }

  function createRoom() {
    cleanup();
    setError("");
    const ws = new WebSocket(wsUrl(serverUrl));
    wsRef.current = ws;
    ws.onopen = () => {
      send({ type: "create_room" });
      pingRef.current = window.setInterval(() => send({ type: "ping", clientTime: Date.now() }), 3000);
      send({ type: "ping", clientTime: Date.now() });
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "room_created":
          setRoomCode(msg.roomCode);
          setPlayers([]);
          setScreen("lobby");
          break;
        case "player_joined":
        case "player_left":
          setPlayers(msg.players);
          break;
        case "game_start":
          setGame({ choreo: msg.choreography, startAt: msg.startAt });
          offsetRef.current = msg.serverTime - Date.now();
          setScores(Object.fromEntries(playersRef.current.map((p) => [p, { score: 0, rating: null, moveIndex: -1 }])));
          setResults(null);
          setScreen("game");
          break;
        case "move_score":
          setScores((cur) => ({
            ...cur,
            [msg.playerName]: { score: msg.totalScore, rating: msg.rating, moveIndex: msg.moveIndex }
          }));
          break;
        case "game_over":
          setResults(msg.results);
          setGame(null);
          setScreen("results");
          break;
        case "pong":
          offsetRef.current = msg.serverTime - Date.now();
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };
    ws.onclose = () => {
      if (screenRef.current !== "home") {
        setError("Disconnected from server");
        setScreen("home");
        setGame(null);
      }
      if (pingRef.current) window.clearInterval(pingRef.current);
    };
    ws.onerror = () => setError(`Cannot connect to ${serverUrl}`);
  }

  const playersRef = useRef(players);
  playersRef.current = players;

  function startGame() {
    send({ type: "start_game", songId: selectedSong });
  }

  function leaveRoom() {
    cleanup();
    setScreen("home");
    setRoomCode("");
    setPlayers([]);
    setGame(null);
    setResults(null);
  }

  return (
    <div className="app">
      {error && <div className="error-banner" onClick={() => setError("")}>{error}</div>}
      {screen === "home" && (
        <HomeScreen
          songs={songs}
          selectedSong={selectedSong}
          onSelect={setSelectedSong}
          serverUrl={serverUrl}
          onServerUrl={setServerUrl}
          onCreateRoom={createRoom}
          animation={previewAnim}
        />
      )}
      {screen === "lobby" && (
        <LobbyScreen
          roomCode={roomCode}
          players={players}
          songs={songs}
          selectedSong={selectedSong}
          onSelect={setSelectedSong}
          serverUrl={serverUrl}
          onStart={startGame}
          onLeave={leaveRoom}
          animation={previewAnim}
        />
      )}
      {screen === "game" && game && (
        <GameScreen
          choreo={game.choreo}
          startAt={game.startAt}
          getOffset={() => offsetRef.current}
          serverUrl={serverUrl}
          scores={scores}
        />
      )}
      {screen === "results" && results && (
        <ResultsScreen
          results={results}
          onPlayAgain={() => { setResults(null); setScreen("lobby"); }}
          onExit={leaveRoom}
        />
      )}
    </div>
  );
}