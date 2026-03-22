import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { initSocket } from './socket';

async function main() {
  await connectDatabase();

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

  initSocket(io);

  httpServer.listen(Number(env.PORT), () => {
    console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
