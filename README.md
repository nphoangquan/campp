# Camp

Camp is a browser-based real-time communication platform for teams and communities. It supports dedicated workspaces (servers), text and voice channels, direct messaging between users, and administrative tooling: role-based access, per-channel permission overrides, and moderation features such as kicks, bans, and audit logging.

## Features

**Accounts and authentication**

- Sign-up with email OTP verification, sign-in, and JWT sessions (access + refresh tokens).
- Forgot password and reset after OTP verification.
- Account deletion flow with OTP confirmation.

**Profile and personal settings**

- Display name, username, avatar, and password changes.
- Privacy settings (who can DM you, friend request policy).
- Notification preferences: desktop, sound, per-server mute.

**Servers and invites**

- Create, edit, and delete servers; icon, banner, and description.
- Invite links with a preview before joining; server templates for quick setup.
- Transfer ownership, leave server, member list, unread hints per server.

**Channel structure**

- **Categories** to group channels; create, rename, delete, reorder.
- **Text channels**: name, topic, ordering, optional per-channel permission overrides.
- **Voice channels**: group calls with mic / deafen / camera / screen share over WebRTC, volume controls (master and per-participant).

**Text chat**

- Send, edit, and delete messages; replies, emoji reactions, pins and pinned list.
- Read state and paginated history.
- @mentions, basic Markdown, link previews, attachments via Cloudinary.
- In-server message search.

**Friends and direct messages**

- Find users, friend requests, friend list.
- DM conversations: list, send messages, real-time updates over sockets.

**Roles, permissions, and moderation**

- Server roles with permission bitfields; optional overrides per channel.
- Kick, ban, and mute where allowed; ban list and audit log.

**Real-time and UX**

- Socket.IO rooms for servers, channels, and DMs; typing indicators; presence (online, idle, do not disturb, invisible).
- In-app notification inbox.
- Dark UI, responsive layout, list virtualization where needed, keyboard shortcuts.

## Requirements

- Node.js 20+
- MongoDB (local or Atlas connection string)
- Cloudinary account for media uploads

## Local setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`: MongoDB URI, JWT secrets, Cloudinary values, and any other variables described in `.env.example`.

```bash
cd client
npm install
cp .env.example .env
```

Set the API base URL in `client/.env` if it differs from the default.

## Run in development

Use two terminals:

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

- Client: http://localhost:5173  
- API: http://localhost:5000 (port may differ based on `server/.env`)

## Docker (optional)

From the repository root:

```bash
cp .env.docker.example .env.docker
```

Fill in real values in `.env.docker`, then:

```bash
docker compose up --build
```

Stop: `docker compose down`. For production-style overrides:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Project structure

```text
campp/
├── .github/
│   └── workflows/          # CI (e.g. Docker image build and push)
├── client/                 # React SPA (Vite)
│   ├── src/
│   │   ├── components/     # UI: layout/, ui/, dm/, voice/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/       # api/, socket/, voice/ (WebRTC)
│   │   ├── stores/         # Zustand state
│   │   ├── styles/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf          # Used in containerized static serving
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                 # Express API + Socket.IO
│   ├── src/
│   │   ├── config/         # env, database, cloudinary, templates
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── socket/
│   │   │   └── handlers/   # message, DM, presence, voice
│   │   ├── utils/
│   │   ├── validators/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/              # Jest (unit and integration)
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── tests/
│   └── postman/            # API collection and environment
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand, Socket.IO client
- Backend: Node.js, Express, TypeScript, Socket.IO, MongoDB, Mongoose
- Auth: JWT (access + refresh)
- Voice: WebRTC
- Media: Cloudinary
