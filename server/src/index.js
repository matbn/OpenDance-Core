import http from "node:http";
import dgram from "node:dgram";
import os from "node:os";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { scoreWindow, ratingFor } from "./scoring.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const choreoDir = path.join(here, "..", "..", "choreographies");
const PORT = process.env.PORT || 3001;
const COUNTDOWN_MS = 5000;

const signatures = JSON.parse(readFileSync(path.join(choreoDir, "signatures.json"), "utf8"));

function loadSongs() {
  const songs = new Map();
  const dir = path.join(choreoDir, "songs");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const song = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    songs.set(song.id, song);
  }
  return songs;
}
const songs = loadSongs();

const app = express();
app.use(cors());
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/songs", (_req, res) =>
  res.json([...songs.values()].map(({ id, title, artist, duration, bpm, animation }) => ({ id, title, artist, duration, bpm, animation })))
);
app.get("/api/songs/:id", (req, res) => {
  const song = songs.get(req.params.id);
  if (!song) return res.status(404).json({ error: "Unknown song" });
  res.json(song);
});
app.use("/audio", express.static(path.join(here, "..", "audio")));
app.use("/dances", express.static(path.join(choreoDir, "dances")));
const webDist = path.join(here, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|audio|dances|ws).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const rooms = new Map();

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, includeHost = true) {
  if (includeHost) send(room.host, msg);
  for (const ws of room.players.keys()) send(ws, msg);
}
function playerNames(room) {
  return [...room.players.values()].map((p) => p.name);
}
function newRoomCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

function freshPlayer(name) {
  return { name, samples: [], score: 0, counts: { perfect: 0, good: 0, ok: 0, miss: 0 } };
}

function startGame(room, songId) {
  const song = songs.get(songId);
  if (!song) return send(room.host, { type: "error", message: `Unknown song: ${songId}` });
  room.song = song;
  room.startAt = Date.now() + COUNTDOWN_MS;
  room.scoredMoves = new Set();
  for (const [ws, p] of room.players) room.players.set(ws, freshPlayer(p.name));
  broadcast(room, { type: "game_start", songId, startAt: room.startAt, serverTime: Date.now(), choreography: song });
  room.timer = setInterval(() => tick(room), 100);
}

function tick(room) {
  const songTime = (Date.now() - room.startAt) / 1000;
  room.song.moves.forEach((move, index) => {
    if (room.scoredMoves.has(index) || songTime < move.time + move.duration) return;
    room.scoredMoves.add(index);
    const signature = move.signature || signatures[move.type];
    for (const player of room.players.values()) {
      const windowSamples = player.samples
        .filter((s) => s.t >= move.time && s.t <= move.time + move.duration)
        .sort((a, b) => a.t - b.t);
      const score = signature ? scoreWindow(windowSamples, signature, move.duration) : 0;
      const { rating, factor } = ratingFor(score);
      const points = Math.round(move.points * factor);
      player.score += points;
      player.counts[rating]++;
      broadcast(room, { type: "move_score", moveIndex: index, playerName: player.name, rating, points, totalScore: player.score });
    }
  });
  for (const player of room.players.values()) {
    player.samples = player.samples.filter((s) => s.t > songTime - 6);
  }
  if (songTime > room.song.duration + 1) endGame(room);
}

function endGame(room) {
  clearInterval(room.timer);
  room.timer = null;
  const maxScore = room.song.moves.reduce((sum, m) => sum + m.points, 0);
  const results = [...room.players.values()].map((p) => ({
    playerName: p.name, score: p.score, maxScore, counts: p.counts
  }));
  broadcast(room, { type: "game_over", results });
  room.song = null;
  room.startAt = null;
}

function leaveRoom(ws) {
  const code = ws.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  ws.roomCode = null;
  if (!room) return;
  if (room.host === ws) {
    clearInterval(room.timer);
    for (const client of room.players.keys()) {
      send(client, { type: "error", message: "Host disconnected" });
      client.roomCode = null;
    }
    rooms.delete(code);
    return;
  }
  const player = room.players.get(ws);
  if (player) {
    room.players.delete(ws);
    broadcast(room, { type: "player_left", playerName: player.name, players: playerNames(room) });
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(ws, { type: "error", message: "Invalid JSON" });
    }
    switch (msg.type) {
      case "create_room": {
        leaveRoom(ws);
        const code = newRoomCode();
        rooms.set(code, { code, host: ws, players: new Map(), song: null, startAt: null, timer: null, scoredMoves: new Set() });
        ws.roomCode = code;
        send(ws, { type: "room_created", roomCode: code, serverTime: Date.now() });
        break;
      }
      case "join_room": {
        const room = rooms.get(String(msg.roomCode));
        if (!room) return send(ws, { type: "error", message: "Room not found" });
        leaveRoom(ws);
        ws.roomCode = room.code;
        room.players.set(ws, freshPlayer(String(msg.playerName || "Dancer").slice(0, 24)));
        send(ws, { type: "joined", roomCode: room.code, serverTime: Date.now(), players: playerNames(room) });
        broadcast(room, { type: "player_joined", playerName: room.players.get(ws).name, players: playerNames(room) }, false);
        send(room.host, { type: "player_joined", playerName: room.players.get(ws).name, players: playerNames(room) });
        break;
      }
      case "start_game": {
        const room = rooms.get(ws.roomCode);
        if (!room || room.host !== ws) return;
        if (room.song) return send(ws, { type: "error", message: "Game already running" });
        startGame(room, msg.songId);
        break;
      }
      case "motion": {
        const room = rooms.get(ws.roomCode);
        const player = room?.players.get(ws);
        if (!player || !room.song || !Array.isArray(msg.samples)) return;
        for (const s of msg.samples) {
          if (typeof s.t === "number" && Array.isArray(s.a) && Array.isArray(s.g)) {
            player.samples.push({ t: s.t, a: s.a.map(Number), g: s.g.map(Number) });
          }
        }
        if (player.samples.length > 3000) player.samples.splice(0, player.samples.length - 3000);
        break;
      }
      case "ping":
        send(ws, { type: "pong", clientTime: msg.clientTime, serverTime: Date.now() });
        break;
      case "leave":
        leaveRoom(ws);
        break;
    }
  });
  ws.on("close", () => leaveRoom(ws));
});

const DISCOVERY_PORT = 3002;
const DISCOVERY_GROUP = "239.255.42.99";
const beacon = dgram.createSocket("udp4");
beacon.on("error", (err) => console.warn(`LAN discovery beacon disabled: ${err.message}`));
beacon.bind(0, () => {
  beacon.setBroadcast(true);
  try {
    beacon.setMulticastTTL(1);
    beacon.setMulticastLoopback(true);
  } catch {
    // multicast is a bonus path; broadcast alone is enough on most LANs
  }
  const payload = Buffer.from(
    JSON.stringify({ service: "opendance", version: 1, port: Number(PORT), wsPath: "/ws", name: os.hostname() })
  );
  const sendBeacon = () => {
    beacon.send(payload, DISCOVERY_PORT, "255.255.255.255", () => {});
    beacon.send(payload, DISCOVERY_PORT, DISCOVERY_GROUP, () => {});
  };
  sendBeacon();
  setInterval(sendBeacon, 2000);
  console.log(`LAN discovery beacon on udp/${DISCOVERY_PORT} (broadcast + ${DISCOVERY_GROUP})`);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`OpenDance server on http://0.0.0.0:${PORT} (ws path /ws)`);
  console.log(`Songs loaded: ${[...songs.keys()].join(", ")}`);
});