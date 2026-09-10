"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("./ws-lite");
const E = require("../js/engine.js");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const rooms = new Map();
const sockets = new Map(); // ws -> { id, name, room }

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function code() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(s) ? code() : s;
}

function send(ws, type, payload) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify({ type: type, ...payload }));
  } catch (e) {}
}

function publicRooms() {
  const list = [];
  for (const r of rooms.values()) {
    if (r.password) continue;
    if (r.phase !== "lobby") continue;
    if (!r.players.length) continue;
    list.push({
      code: r.code,
      host: (r.players[0] && r.players[0].name) || "?",
      seated: r.players.length,
      target: r.target,
      phase: r.phase,
    });
  }
  return list;
}

function findByToken(token) {
  if (!token) return null;
  for (const room of rooms.values()) {
    const player = room.players.find(function (p) { return p.token === token; });
    if (player) return { room: room, player: player };
  }
  return null;
}

function connectedCount(room) {
  return room.players.filter(function (p) { return p.ws && p.ws.readyState === 1; }).length;
}

function reapRoom(room) {
  if (!room) return;
  rooms.delete(room.code);
  listBlast();
}

function lobbyPayload(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    target: room.target,
    private: !!room.password,
    phase: room.phase,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      host: p.id === room.hostId,
      connected: p.ws && p.ws.readyState === 1,
    })),
    chat: room.chat.slice(-40),
  };
}

function broadcastLobby(room) {
  const base = lobbyPayload(room);
  for (const p of room.players) {
    send(p.ws, "lobby", Object.assign({}, base, { youAreHost: p.id === room.hostId }));
  }
}

function snapshotTo(room, player) {
  if (!room.engine) return;
  const idx = room.players.findIndex((p) => p.id === player.id);
  if (idx < 0) return;
  const view = E.publicView(room.engine, idx);
  send(player.ws, "state", { state: view });
}

function broadcastState(room) {
  for (const p of room.players) snapshotTo(room, p);
}

function listBlast() {
  const list = publicRooms();
  for (const [ws, meta] of sockets) {
    if (!meta.room) send(ws, "rooms", { rooms: list });
  }
}

function dropSocket(ws, eject) {
  const meta = sockets.get(ws);
  if (!meta) return;
  const room = meta.room ? rooms.get(meta.room) : null;
  if (!room) {
    meta.room = null;
    return;
  }
  const i = room.players.findIndex(function (p) {
    return p.ws === ws || p.id === meta.id;
  });
  if (i < 0) {
    meta.room = null;
    return;
  }
  const gone = room.players[i];
  gone.ws = null;
  gone.connected = false;
  if (eject || room.phase === "over") {
    room.players.splice(i, 1);
    meta.room = null;
    if (room.hostId === gone.id && room.players[0]) room.hostId = room.players[0].id;
    room.chat.push({ name: "TABLE", text: gone.name + " left." });
    if (!room.players.length || !connectedCount(room)) {
      reapRoom(room);
      return;
    }
    broadcastLobby(room);
    listBlast();
    return;
  }
  meta.room = null;
  room.chat.push({ name: "TABLE", text: gone.name + " dropped. Waiting to reconnect." });
  broadcastLobby(room);
  listBlast();
  const token = gone.token;
  setTimeout(function () {
    const still = rooms.get(room.code);
    if (!still) return;
    const p = still.players.find(function (x) { return x.token === token; });
    if (!p || (p.ws && p.ws.readyState === 1)) return;
    if (still.phase === "lobby") {
      still.players = still.players.filter(function (x) { return x.token !== token; });
      if (!still.players.length) reapRoom(still);
      else {
        if (still.hostId === gone.id && still.players[0]) still.hostId = still.players[0].id;
        broadcastLobby(still);
        listBlast();
      }
      return;
    }
    if (still.phase === "over" && !connectedCount(still)) reapRoom(still);
  }, 25000);
}

function leave(ws) {
  dropSocket(ws, true);
}

function startGame(room) {
  if (room.players.length < 2) return { ok: false, error: "Need at least 2." };
  const lineup = room.players.map((p) => ({ name: p.name, isAI: false }));
  room.engine = E.createGame(lineup);
  room.phase = "playing";
  broadcastLobby(room);
  broadcastState(room);
  listBlast();
  return { ok: true };
}

function handle(ws, msg) {
  const meta = sockets.get(ws);
  if (!meta) return;
  const t = msg.type;
  if (t === "hello") {
    const name = String(msg.name || "PLAYER").trim().slice(0, 16) || "PLAYER";
    meta.name = name;
    const found = findByToken(msg.token);
    const live = found && found.player.ws && found.player.ws !== ws && found.player.ws.readyState === 1;
    if (found && !live) {
      found.player.ws = ws;
      found.player.connected = true;
      meta.id = found.player.id;
      meta.name = found.player.name;
      meta.room = found.room.code;
      send(ws, "hello", { id: meta.id, name: meta.name });
      send(ws, "joined", { code: found.room.code, you: meta.id, token: found.player.token });
      found.room.chat.push({ name: "TABLE", text: meta.name + " reconnected." });
      broadcastLobby(found.room);
      if (found.room.engine) snapshotTo(found.room, found.player);
      return;
    }
    send(ws, "hello", { id: meta.id, name: meta.name });
    send(ws, "rooms", { rooms: publicRooms() });
    return;
  }
  if (t === "create") {
    if (meta.room) dropSocket(ws, true);
    const target = Math.max(2, Math.min(6, Number(msg.target) || 4));
    const password = msg.password ? String(msg.password).slice(0, 24) : "";
    const token = uid() + uid();
    const room = {
      code: code(),
      hostId: meta.id,
      target,
      password,
      phase: "lobby",
      players: [{ id: meta.id, name: meta.name, ws: ws, token: token, connected: true }],
      chat: [{ name: "TABLE", text: meta.name + " opened the room." }],
      engine: null,
    };
    rooms.set(room.code, room);
    meta.room = room.code;
    send(ws, "joined", { code: room.code, you: meta.id, token: token });
    broadcastLobby(room);
    listBlast();
    return;
  }
  if (t === "join") {
    const room = rooms.get(String(msg.code || "").toUpperCase());
    if (!room) return send(ws, "error", { error: "No room with that code." });
    if (room.phase !== "lobby") return send(ws, "error", { error: "That table already started." });
    if (room.players.length >= room.target) return send(ws, "error", { error: "Room is full." });
    if (room.password && room.password !== String(msg.password || "")) {
      return send(ws, "error", { error: "Wrong password." });
    }
    if (room.players.some(function (p) { return p.id === meta.id; })) return;
    if (meta.room) dropSocket(ws, true);
    const token = uid() + uid();
    room.players.push({ id: meta.id, name: meta.name, ws: ws, token: token, connected: true });
    meta.room = room.code;
    room.chat.push({ name: "TABLE", text: meta.name + " sat down." });
    send(ws, "joined", { code: room.code, you: meta.id, token: token });
    broadcastLobby(room);
    listBlast();
    if (room.players.length >= room.target) startGame(room);
    return;
  }
  if (t === "list") {
    send(ws, "rooms", { rooms: publicRooms() });
    return;
  }
  if (t === "chat") {
    const room = rooms.get(meta.room);
    if (!room) return;
    const text = String(msg.text || "").trim().slice(0, 160);
    if (!text) return;
    room.chat.push({ name: meta.name, text });
    if (room.chat.length > 80) room.chat.splice(0, room.chat.length - 80);
    broadcastLobby(room);
    return;
  }
  if (t === "start") {
    const room = rooms.get(meta.room);
    if (!room) return;
    if (meta.id !== room.hostId) return send(ws, "error", { error: "Only the host starts." });
    const res = startGame(room);
    if (!res.ok) send(ws, "error", { error: res.error });
    return;
  }
  if (t === "leave") {
    leave(ws);
    send(ws, "left", {});
    send(ws, "rooms", { rooms: publicRooms() });
    return;
  }
  if (t === "play" || t === "pickup" || t === "suit") {
    const room = rooms.get(meta.room);
    if (!room || !room.engine) return;
    const idx = room.players.findIndex((p) => p.id === meta.id);
    if (idx < 0) return;
    let res;
    if (t === "play") res = E.playCards(room.engine, idx, msg.ids || []);
    else if (t === "pickup") res = E.pickUp(room.engine, idx);
    else res = E.chooseSuit(room.engine, msg.suit);
    if (!res || !res.ok) return send(ws, "error", { error: (res && res.error) || "No." });
    broadcastState(room);
    if (room.engine.gameOver) {
      room.phase = "over";
      broadcastLobby(room);
      listBlast();
    }
    return;
  }
  if (t === "again") {
    const room = rooms.get(meta.room);
    if (!room) return send(ws, "error", { error: "No room." });
    if (meta.id !== room.hostId) return send(ws, "error", { error: "Only the host starts the next hand." });
    const seated = room.players.filter(function (p) {
      return p.ws && p.ws.readyState === 1;
    });
    if (seated.length < 2) return send(ws, "error", { error: "Need at least 2 still here." });
    room.players = seated;
    const lineup = room.players.map(function (p) { return { name: p.name, isAI: false }; });
    room.engine = E.createGame(lineup);
    room.phase = "playing";
    room.chat.push({ name: "TABLE", text: "Next hand." });
    broadcastLobby(room);
    broadcastState(room);
    listBlast();
    return;
  }
}

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/") url = "/index.html";
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("no");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  const meta = { id: uid(), name: "PLAYER", room: null };
  sockets.set(ws, meta);
  send(ws, "hello", { id: meta.id, name: meta.name });
  send(ws, "rooms", { rooms: publicRooms() });
  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch (e) {
      return;
    }
    try {
      handle(ws, msg);
    } catch (err) {
      send(ws, "error", { error: "Server hiccup." });
      console.error(err);
    }
  });
  ws.on("close", () => {
    dropSocket(ws, false);
    sockets.delete(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("UNOWE on http://localhost:" + PORT);
});
