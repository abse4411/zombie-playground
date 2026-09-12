#!/usr/bin/env node
/* ============================================================
 * 丧尸游乐场 · 局域网联机服务器（零依赖）
 * 用法:  node 服务器.js  [端口(默认8080)]
 * 功能:  静态文件服务 + 原生 WebSocket(RFC6455) + 房间转发
 * 房主 = 第一个连接并在页面中"创建房间"的玩家（权威模拟端）
 * ============================================================ */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.argv[2] || '8080', 10);
const ROOT = __dirname;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

/* ---------- WebSocket 帧编解码（RFC6455 子集） ---------- */
function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f, off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2)); off = 10;
  }
  const maskLen = masked ? 4 : 0;
  if (buf.length < off + maskLen + len) return null;
  let payload = buf.slice(off + maskLen, off + maskLen + len);
  if (masked) {
    const mask = buf.slice(off, off + 4);
    const out = Buffer.allocUnsafe(payload.length);
    for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  return { opcode, payload, rest: buf.slice(off + maskLen + len) };
}

function encodeFrame(payload, opcode = 0x1) {
  if (typeof payload === 'string') payload = Buffer.from(payload, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/* ---------- 房间 ---------- */
const clients = new Set();   // {socket, id, name, isHost, alive}
let nextId = 1;

function broadcast(data, exceptId) {
  const frame = encodeFrame(typeof data === 'string' ? data : JSON.stringify(data));
  for (const c of clients) {
    if (c.id === exceptId || !c.alive) continue;
    try { c.socket.write(frame); } catch (e) { }
  }
}

function sendTo(c, data) {
  if (!c.alive) return;
  try { c.socket.write(encodeFrame(typeof data === 'string' ? data : JSON.stringify(data))); } catch (e) { }
}

function roomList() {
  return [...clients].map(c => ({ id: c.id, name: c.name, host: c.isHost }));
}

/* ---------- HTTP：静态文件 + WS 升级 ---------- */
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);

  const client = { socket, id: nextId++, name: '战士' + nextId, isHost: false, alive: true, buf: Buffer.alloc(0) };
  clients.add(client);

  socket.on('data', chunk => {
    client.buf = Buffer.concat([client.buf, chunk]);
    while (true) {
      const frame = decodeFrame(client.buf);
      if (!frame) break;
      client.buf = frame.rest;
      if (frame.opcode === 0x8) { socket.end(); return; }           // close
      if (frame.opcode === 0x9) { socket.write(encodeFrame(frame.payload, 0xA)); continue; } // ping→pong
      if (frame.opcode !== 0x1) continue;
      let msg;
      try { msg = JSON.parse(frame.payload.toString('utf8')); } catch (e) { continue; }
      handleMessage(client, msg);
    }
  });

  socket.on('close', () => leave(client));
  socket.on('error', () => leave(client));
});

function leave(client) {
  if (!clients.has(client)) return;
  clients.delete(client);
  broadcast({ t: 'leave', id: client.id, name: client.name });
  console.log(`[断开] #${client.id} ${client.name}（房间剩余 ${clients.size} 人）`);
}

function handleMessage(client, msg) {
  switch (msg.t) {
    case 'host': {
      // 已有房主时拒绝重复建房
      const hasHost = [...clients].some(c => c.isHost && c.id !== client.id);
      if (hasHost) { sendTo(client, { t: 'err', msg: '房间已存在，请选择加入' }); return; }
      client.isHost = true; client.name = msg.name || client.name;
      console.log(`[建房] #${client.id} ${client.name}`);
      sendTo(client, { t: 'welcome', id: client.id, host: true, room: roomList() });
      break;
    }
    case 'join': {
      client.name = msg.name || client.name;
      console.log(`[加入] #${client.id} ${client.name}`);
      sendTo(client, { t: 'welcome', id: client.id, host: false, room: roomList() });  // 加入者永远不是房主
      broadcast({ t: 'room', room: roomList() });
      break;
    }
    case 'start': {
      // 仅房主可以开局
      if (!client.isHost) return;
      broadcast({ t: 'start', mode: msg.mode, map: msg.map, diff: msg.diff, missionIdx: msg.missionIdx, by: client.id });
      console.log(`[开局] ${msg.mode} ${msg.map || ''} by #${client.id}`);
      break;
    }
    default:
      // 其它消息按角色路由：客户端 → 房主；房主 → 全体
      if (client.isHost) broadcast(msg, client.id);
      else {
        const host = [...clients].find(c => c.isHost);
        if (host) sendTo(host, Object.assign({ from: client.id }, msg));
      }
  }
}

/* ---------- 启动 ---------- */
server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  let lan = '127.0.0.1';
  for (const list of Object.values(nets)) {
    for (const ni of (list || [])) {
      if (ni.family === 'IPv4' && !ni.internal) { lan = ni.address; break; }
    }
  }
  console.log('==============================================');
  console.log('   丧尸游乐场 · 局域网联机服务器已启动');
  console.log(`   本机游玩:      http://localhost:${PORT}`);
  console.log(`   分享给朋友:    http://${lan}:${PORT}`);
  console.log('   （房主创建房间，朋友输入昵称加入即可）');
  console.log('==============================================');
});
