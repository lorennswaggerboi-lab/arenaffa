// Servidor de Arena FFA: sirve el cliente y coordina a los jugadores por WebSocket.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const RESPAWN_MS = 3000;

// Debe coincidir en daño/cadencia con el cliente. El servidor es quien calcula el daño real.
const WEAPONS = [
  { name: 'Pistola',  dmg: 25, cd: 300, max: 1 },
  { name: 'Escopeta', dmg: 11, cd: 800, max: 8 },
  { name: 'Rifle',    dmg: 12, cd: 90,  max: 1 },
];

// Puntos de aparición [x, z] (libres de obstáculos en el mapa del cliente)
const SPAWNS = [
  [-17, -17], [17, 17], [-17, 17], [17, -17],
  [0, -16], [0, 16], [-16, 0], [16, 0],
  [-5, 5], [5, -5], [-11, -3], [11, 3],
];

const server = http.createServer((req, res) => {
  const file = path.join(__dirname, 'public', 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(500); return res.end('No se encontró public/index.html'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const players = new Map();
let nextId = 1;

// Elige un spawn al azar, preferiblemente lejos de jugadores vivos
function pickSpawn() {
  const alive = [...players.values()].filter(p => p.hp > 0);
  let candidates = SPAWNS.filter(s => alive.every(p => Math.hypot(p.x - s[0], p.z - s[1]) > 9));
  if (candidates.length === 0) candidates = SPAWNS;
  const s = candidates[Math.floor(Math.random() * candidates.length)];
  return [s[0], 0, s[1]];
}

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (obj, except) => {
  const msg = JSON.stringify(obj);
  for (const p of players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(msg);
};
const num = v => (Number.isFinite(v) ? v : 0);

wss.on('connection', ws => {
  let p = null;

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'join' && !p) {
      const s = pickSpawn();
      p = {
        id: nextId++, ws,
        name: String(m.name || 'Jugador').slice(0, 16),
        x: s[0], y: s[1], z: s[2], yaw: 0, pitch: 0,
        hp: 100, k: 0, d: 0, lastShot: 0, w: 0,
      };
      players.set(p.id, p);
      send(ws, { t: 'welcome', id: p.id, spawn: s });
      return;
    }
    if (!p) return;

    if (m.t === 'state' && p.hp > 0) {
      p.x = Math.max(-30, Math.min(30, num(m.x)));
      p.y = Math.max(-5, Math.min(20, num(m.y)));
      p.z = Math.max(-30, Math.min(30, num(m.z)));
      p.yaw = num(m.yaw);
      p.pitch = num(m.pitch);
      p.w = Math.max(0, Math.min(WEAPONS.length - 1, m.w | 0)); // arma en mano, para que los demás la vean
    }

    // Solo efectos visuales (trazador) para los demás
    if (m.t === 'shoot' && p.hp > 0) {
      broadcast({ t: 'shoot', id: p.id, from: m.from, to: m.to }, ws);
    }

    // El cliente avisa a quién le pegó; el servidor valida cadencia y calcula el daño
    if (m.t === 'hit' && p.hp > 0 && Array.isArray(m.hits)) {
      const w = WEAPONS[m.w | 0];
      if (!w) return;
      const now = Date.now();
      if (now - p.lastShot < w.cd * 0.7) return; // anti-spam de disparos
      p.lastShot = now;

      for (const h of m.hits.slice(0, 8)) {
        const target = players.get(h.id);
        if (!target || target === p || target.hp <= 0) continue;
        const n = Math.max(1, Math.min(w.max, h.n | 0));
        const head = Math.max(0, Math.min(n, h.head | 0));
        target.hp -= w.dmg * (n + head); // headshot = doble daño
        if (target.hp <= 0) {
          target.hp = 0;
          p.k++; target.d++;
          broadcast({ t: 'kill', k: p.name, v: target.name, vid: target.id });
          setTimeout(() => {
            if (!players.has(target.id)) return;
            const s = pickSpawn();
            target.hp = 100; target.x = s[0]; target.y = s[1]; target.z = s[2];
            send(target.ws, { t: 'respawn', spawn: s });
          }, RESPAWN_MS);
        }
        send(target.ws, { t: 'hp', hp: target.hp });
      }
    }
  });

  ws.on('close', () => { if (p) players.delete(p.id); });
});

// Snapshot del mundo 20 veces por segundo
setInterval(() => {
  if (players.size === 0) return;
  const list = [...players.values()].map(p => ({
    id: p.id, name: p.name, x: p.x, y: p.y, z: p.z,
    yaw: p.yaw, pitch: p.pitch, w: p.w, hp: p.hp, k: p.k, d: p.d,
  }));
  broadcast({ t: 'snap', p: list });
}, 50);

server.listen(PORT, () => console.log(`Arena FFA en http://localhost:${PORT}`));
