import { Server, Socket } from 'socket.io';
import { User } from '../../models/User';

export function registerPresenceHandlers(io: Server, socket: Socket, userId: string): void {
    // Typing indicators
    socket.on('typingStart', (channelId: string) => {
        socket.to(`channel:${channelId}`).emit('typingStart', { channelId, userId });
    });

    // Status updates
    socket.on('updateStatus', async (status: string) => {
        const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
        if (!validStatuses.includes(status)) return;
        const updates: { status: string; invisibleMode?: boolean } = { status };
        updates.invisibleMode = status === 'invisible';
        await User.findByIdAndUpdate(userId, updates).catch(() => null);
        if (status === 'invisible') {
            socket.broadcast.emit('userStatusChanged', { userId, status: 'offline' });
            socket.emit('initialStatus', { status: 'invisible' });
        } else {
            io.emit('userStatusChanged', { userId, status });
            socket.emit('initialStatus', { status });
        }
    });

    // Friend request notifications
    socket.on('friendRequestSent', (targetUserId: string) => {
        io.emit('friendRequestUpdate', { targetUserId, fromUserId: userId, type: 'sent' });
    });
}

export async function handlePresenceConnect(io: Server, socket: Socket, userId: string): Promise<void> {
    const user = await User.findById(userId).catch(() => null);
    const isInvisible = user?.invisibleMode === true;

    if (isInvisible) {
        await User.findByIdAndUpdate(userId, { status: 'invisible' }).catch(() => null);
        socket.broadcast.emit('userStatusChanged', { userId, status: 'offline' });
        socket.emit('initialStatus', { status: 'invisible' });
    } else {
        await User.findByIdAndUpdate(userId, { status: 'online' }).catch(() => null);
        io.emit('userStatusChanged', { userId, status: 'online' });
        socket.emit('initialStatus', { status: 'online' });
    }

    socket.join(`user:${userId}`);
    if (user?.servers) {
        for (const serverId of user.servers) {
            socket.join(`server:${serverId}`);
        }
    }
}

export async function handlePresenceDisconnect(io: Server, socket: Socket, userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { status: 'offline' }).catch(() => null);
    socket.broadcast.emit('userStatusChanged', { userId, status: 'offline' });
}
