# Camp

Realtime Chat Application

## Setup

### Yeu cau Tech Stack
- React
- Vite
- Node.js 20+
- Cloudinary
- MongoDB (local hoac Atlas)

### Cai dat

```bash
# Server
cd server
npm install
cp .env.example .env
# Chinh sua .env voi MONGODB_URI, JWT secrets cua ban

# Client
cd client
npm install
cp .env.example .env
```

### Chay

```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:5000

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand, Socket.IO Client
- **Backend:** Node.js, Express, TypeScript, Socket.IO, MongoDB, Mongoose
- **Auth:** JWT (access + refresh token)
- **Media:** Cloudinary
