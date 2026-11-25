// Brings a few seeded preview users "online" so the live band, presence and voice rows have real
// socket activity to show. Run while the API is up against campp_preview (after seed-preview.mjs):
//   node scripts/preview-actors.mjs [seconds]
import { createRequire } from 'module';
const require = createRequire(new URL('../../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const API = 'http://localhost:5000/api';
const PASSWORD = 'preview-pass-2026';
const RUN_FOR = Number(process.argv[2] || 300) * 1000;
const actors = ['khoa.ng', 'linh_tran', 'bao.vu', 'tuan.le', 'quynh'];
const email = (u) => `${u.replace(/[._]/g, '')}@preview.local`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const sessions = {};
for (const u of actors) {
  const r = await call('/auth/login', { method: 'POST', body: { email: email(u), password: PASSWORD } });
  sessions[u] = { token: r.accessToken, id: r.user._id };
}
const { servers } = await call('/servers/me', { token: sessions['khoa.ng'].token });
const hoi = servers.find((s) => s.name.startsWith('Hội'));
const ch = await call(`/servers/${hoi._id}/channels`, { token: sessions['khoa.ng'].token });
const all = [...ch.categories.flatMap((c) => c.channels), ...(ch.uncategorized || [])];
const voice = all.filter((c) => c.type === 'voice');
const general = all.find((c) => c.type === 'text' && c.name === 'general');

const sockets = {};
for (const u of actors) {
  const s = io('http://localhost:5000', { auth: { token: sessions[u].token }, transports: ['websocket'] });
  sockets[u] = s;
  s.on('connect', () => s.emit('joinServer', hoi._id));
  await wait(900);
}
console.log('actors online:', actors.join(', '));

// A steady trickle of activity: voice moves and presence changes.
const script = [
  () => sockets['khoa.ng'].emit('joinVoice', voice[0]._id, () => {}),
  () => sockets['linh_tran'].emit('joinVoice', voice[0]._id, () => {}),
  () => sockets['tuan.le'].emit('updateStatus', 'idle'),
  () => sockets['bao.vu'].emit('joinVoice', voice[1]?._id ?? voice[0]._id, () => {}),
  () => sockets['quynh'].emit('updateStatus', 'dnd'),
  () => call(`/channels/${general._id}/messages`, { method: 'POST', token: sessions['linh_tran'].token, body: { content: 'Vào Lobby rồi nè, ai lên thì vào luôn 🎧' } }),
  () => sockets['tuan.le'].emit('updateStatus', 'online'),
];
const started = Date.now();
let i = 0;
while (Date.now() - started < RUN_FOR) {
  if (i < script.length) {
    try { await script[i](); } catch (e) { console.log('step failed', e.message); }
    i++;
    await wait(2500);
  } else {
    // keep the band moving: toggle one person between idle and online
    sockets['tuan.le'].emit('updateStatus', i % 2 ? 'idle' : 'online');
    i++;
    await wait(8000);
  }
}
for (const s of Object.values(sockets)) s.disconnect();
console.log('actors done');
