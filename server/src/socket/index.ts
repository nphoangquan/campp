import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { registerMessageHandlers } from './handlers/message.handler';
import { registerVoiceHandlers, handleVoiceDisconnect, getVoiceChannelUsers } from './handlers/voice.handler';
import { registerPresenceHandlers, handlePresenceConnect, handlePresenceDisconnect } from './handlers/presence.handler';
import { registerDMHandlers } from './handlers/dm.handler';

interface AuthenticatedSocket extends Socket {
  userId: string;
  email: string;
}

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  ioInstance?.to(`user:${userId}`).emit(event, data);
}

export { getVoiceChannelUsers };

export function initSocket(io: Server): void {
  ioInstance = io;

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) return next(new Error('Authentication token required'));
      const payload = verifyAccessToken(token);
      (socket as AuthenticatedSocket).userId = payload.userId;
      (socket as AuthenticatedSocket).email = payload.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const { userId } = authSocket;

    // Initialize presence (status, rooms)
    await handlePresenceConnect(io, socket, userId);

    // Server/Channel room management
    socket.on('joinServer', (serverId: string) => socket.join(`server:${serverId}`));
    socket.on('leaveServer', (serverId: string) => socket.leave(`server:${serverId}`));
    socket.on('joinChannel', (channelId: string) => socket.join(`channel:${channelId}`));
    socket.on('leaveChannel', (channelId: string) => socket.leave(`channel:${channelId}`));

    // Register all handlers
    registerMessageHandlers(io, socket, userId);
    registerVoiceHandlers(io, socket, userId);
    registerPresenceHandlers(io, socket, userId);
    registerDMHandlers(io, socket, userId);

    // Disconnect cleanup
    socket.on('disconnect', async () => {
      handleVoiceDisconnect(io, userId);
      await handlePresenceDisconnect(io, socket, userId);
    });
  });
}
