import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const here = path.dirname(fileURLToPath(import.meta.url));
const signatures = JSON.parse(readFileSync(path.join(here, "..", "..", "choreographies", "signatures.json"), "utf8"));

const SERVER = process.argv[2] || "ws://localhost:3001/ws";
const ROOM = process.argv[3];
const NAME = process.argv[4] || "Simulated Phone";
if (!ROOM) {
  console.error("Usage: node scripts/simulate-controller.mjs [wsUrl] <roomCode> [playerName]");
  process.exit(1);
}

const ws = new WebSocket(SERVER);
let offset = 0;
let startAt = null;
let choreography = null;
let sendTimer = null;

const send = (msg) => ws.send(JSON.stringify(msg));
const songTime = () => (Date.now() + offset - startAt) / 1000;

function synthSample(move, t) {
  const sig = move.signature || signatures[move.type] || {};
  const phase = (t - move.time) / move.duration;
  const effort = Math.sin(Math.PI * Math.min(1, Math.max(0, phase)));
  const noise = () => (Math.random() - 0.5) * 0.8;
  let a = [noise(), noise(), noise()];
  let g = [noise() * 0.3, noise() * 0.3, noise() * 0.3];
  const energy = (sig.minEnergy || 4) * 1.2 * effort;
  if (sig.dir) a = sig.dir.map((v) => v * energy + noise());
  if (sig.gyro) g = sig.gyro.map((v) => v * 3 * effort + noise() * 0.3);
  if (sig.shake) {
    const osc = Math.sin(2 * Math.PI * 3.5 * t);
    a = [osc * energy, noise(), noise()];
    if (sig.gyro) g = sig.gyro.map((v) => v * 3 * effort * osc);
  }
  return { t, a, g };
}

ws.on("open", () => {
  send({ type: "ping", clientTime: Date.now() });
  send({ type: "join_room", roomCode: ROOM, playerName: NAME });
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  switch (msg.type) {
    case "pong":
      offset = msg.serverTime - Date.now();
      break;
    case "joined":
      console.log(`Joined room ${msg.roomCode}. Waiting for host to start...`);
      break;
    case "game_start":
      startAt = msg.startAt;
      choreography = msg.choreography;
      offset = msg.serverTime - Date.now();
      console.log(`Game starting: ${choreography.title} (countdown ${Math.round((startAt - Date.now()) / 1000)}s)`);
      sendTimer = setInterval(() => {
        const t = songTime();
        if (t < 0) return;
        const move = choreography.moves.find((m) => t >= m.time && t <= m.time + m.duration);
        const sample = move ? synthSample(move, t) : { t, a: [0, 0, 0], g: [0, 0, 0] };
        send({ type: "motion", samples: [sample] });
      }, 100);
      break;
    case "move_score":
      if (msg.playerName === NAME) console.log(`Move ${msg.moveIndex}: ${msg.rating.toUpperCase()} +${msg.points} (total ${msg.totalScore})`);
      break;
    case "game_over": {
      clearInterval(sendTimer);
      const mine = msg.results.find((r) => r.playerName === NAME);
      console.log("Game over:", JSON.stringify(mine, null, 2));
      ws.close();
      process.exit(0);
    }
    case "error":
      console.error("Server error:", msg.message);
      process.exit(1);
  }
});

ws.on("close", () => {
  clearInterval(sendTimer);
  console.log("Disconnected");
});