// Seeds the isolated campp_preview database with demo users, servers and messages.
// Run from the server folder while the API runs against campp_preview: node scripts/seed-preview.mjs
// WARNING: wipes every collection in the campp_preview database first.
import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API = 'http://localhost:5000/api';
const PASSWORD = 'preview-pass-2026';

const people = [
  ['minhanh.ng', 'Minh Ánh', 'online'],
  ['khoa.ng', 'Khoa Nguyễn', 'online'],
  ['linh_tran', 'Linh Trần', 'online'],
  ['bao.vu', 'Bảo Vũ', 'online'],
  ['huy.pham', 'Huy Phạm', 'online'],
  ['tuan.le', 'Tuấn Lê', 'idle'],
  ['quynh', 'Quỳnh', 'dnd'],
  ['an.do', 'An Đỗ', 'offline'],
  ['dung.ho', 'Dũng Hồ', 'offline'],
  ['nam.ta', 'Nam Tạ', 'offline'],
];

await mongoose.connect('mongodb://localhost:27017/campp_preview');
const db = mongoose.connection.db;
for (const c of await db.listCollections().toArray()) await db.collection(c.name).deleteMany({});
const hash = await bcrypt.hash(PASSWORD, 10);
for (const [username, displayName, status] of people) {
  await db.collection('users').insertOne({
    username, displayName, email: `${username.replace(/[._]/g, '')}@preview.local`, passwordHash: hash,
    avatar: '', banner: '', status, invisibleMode: false, activityStatus: '', friends: [],
    friendRequests: { incoming: [], outgoing: [] }, servers: [], mutedServers: [], allowDMs: true,
    allowFriendRequests: 'everyone', notificationSound: true, desktopNotifications: true,
    emailVerified: true, tokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
  });
}
await mongoose.disconnect();

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

const tok = {};
const ids = {};
for (const [username] of people) {
  const r = await call('/auth/login', { method: 'POST', body: { email: `${username.replace(/[._]/g, '')}@preview.local`, password: PASSWORD } });
  tok[username] = r.accessToken;
  ids[username] = r.user._id;
}

const { server: hoi } = await call('/servers', { method: 'POST', token: tok['khoa.ng'], body: { name: 'Hội Bạn Thân Sài Gòn', templateId: 'gaming' } });
const { server: study } = await call('/servers', { method: 'POST', token: tok['linh_tran'], body: { name: 'CS Study Group', templateId: 'study' } });
const { server: work } = await call('/servers', { method: 'POST', token: tok['bao.vu'], body: { name: 'Camp Devs', templateId: 'work' } });

for (const [username] of people) {
  for (const s of [hoi, study, work]) {
    try { await call(`/servers/join/${s.inviteCode}`, { method: 'POST', token: tok[username] }); } catch { /* owner */ }
  }
}

const chRes = await call(`/servers/${hoi._id}/channels`, { token: tok['khoa.ng'] });
const channels = [...chRes.categories.flatMap((c) => c.channels), ...(chRes.uncategorized || [])];
const text = (channels || []).filter((c) => c.type === 'text');
const general = text.find((c) => c.name === 'general') || text[0];
const other = text.find((c) => c !== general);

const say = async (who, content, channel = general, extra = {}) =>
  (await call(`/channels/${channel._id}/messages`, { method: 'POST', token: tok[who], body: { content, ...extra } })).message;

await say('huy.pham', 'Chào cả nhà, server mới set up xong rồi nhé 🎉');
await say('khoa.ng', 'Tối nay ai vào Lobby chơi Valorant không, thiếu 2 đứa');
const m1 = await say('linh_tran', 'Mình vào sau 15p nhé, đang ăn tối');
await say('tuan.le', 'cho mình 1 slot, mình leo rank từ chiều tới giờ vẫn kẹt Gold 2 😭');
await say('bao.vu', '@minhanh clip hôm qua đỉnh quá, up lên #clips đi');
await say('khoa.ng', 'Có ai xem trận chung kết hôm qua chưa? Ván 3 lật kèo kinh khủng', general, { replyTo: m1?._id });
await say('quynh', 'Link highlight nè: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await say('huy.pham', '**Nhắc nhẹ:** cuối tuần này offline ở quận 3 nha, ai đi thì react ✅');
await say('minhanh.ng', 'Để tối mình up, đang render lại cho nét hơn');
if (other) {
  for (let i = 0; i < 6; i++) await say(['khoa.ng', 'bao.vu', 'linh_tran'][i % 3], `Clip số ${i + 1} của tuần này`, other);
}
console.log(JSON.stringify({ login: 'minhanhng@preview.local', password: PASSWORD, server: hoi._id, invite: hoi.inviteCode }));
