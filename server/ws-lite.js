"use strict";
const crypto = require("crypto");
const { EventEmitter } = require("events");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OP_TEXT = 1;
const OP_CLOSE = 8;
const OP_PING = 9;
const OP_PONG = 10;

function accept(key) {
  return crypto.createHash("sha1").update(key + GUID).digest("base64");
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 15;
  const masked = buf[1] & 128;
  let len = buf[1] & 127;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    off = 10;
  }
  if (masked) off += 4;
  if (buf.length < off + len) return null;
  let payload = buf.subarray(off, off + len);
  if (masked) {
    const mask = buf.subarray(off - 4, off);
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  return { opcode, payload, rest: buf.subarray(off + len) };
}

function encodeFrame(opcode, data) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.alloc(2);
    head[1] = len;
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}

class Socket extends EventEmitter {
  constructor(req, socket) {
    super();
    this._sock = socket;
    this.readyState = 1;
    this._buf = Buffer.alloc(0);
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => {
      this.readyState = 3;
      this.emit("close");
    });
    socket.on("error", () => {
      this.readyState = 3;
      this.emit("close");
    });
  }
  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (true) {
      const frame = decodeFrame(this._buf);
      if (!frame) break;
      this._buf = frame.rest;
      if (frame.opcode === OP_TEXT) this.emit("message", frame.payload);
      else if (frame.opcode === OP_PING) this._sock.write(encodeFrame(OP_PONG, frame.payload));
      else if (frame.opcode === OP_CLOSE) {
        this.close();
      }
    }
  }
  send(text) {
    if (this.readyState !== 1) return;
    this._sock.write(encodeFrame(OP_TEXT, String(text)));
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    try { this._sock.end(encodeFrame(OP_CLOSE, "")); } catch (e) {}
    this.emit("close");
  }
}

class Server extends EventEmitter {
  constructor(opts) {
    super();
    const httpServer = opts && opts.server;
    const wantPath = (opts && opts.path) || "/ws";
    if (!httpServer || typeof httpServer.on !== "function") {
      throw new Error("ws-lite needs { server }");
    }
    httpServer.on("upgrade", (req, socket, head) => {
      const url = req.url.split("?")[0];
      if (url !== wantPath) {
        socket.destroy();
        return;
      }
      const key = req.headers["sec-websocket-key"];
      if (!key) {
        socket.destroy();
        return;
      }
      const headers = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Accept: " + accept(key),
        "",
        "",
      ].join("\r\n");
      socket.write(headers);
      const ws = new Socket(req, socket);
      if (head && head.length) ws._onData(head);
      this.emit("connection", ws);
    });
  }
}

module.exports = { WebSocketServer: Server };
