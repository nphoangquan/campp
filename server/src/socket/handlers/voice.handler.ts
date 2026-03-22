import { Server, Socket } from 'socket.io';
import { Channel } from '../../models/Channel';
import { Server as ServerModel } from '../../models/Server';

export interface VoiceUser {
    socketId: string;
    userId: string;
    muted: boolean;
    deafened: boolean;
    camera: boolean;
    screenShare: boolean;
}

const voiceChannels = new Map<string, VoiceUser[]>();

export function getVoiceUsers(channelId: string): VoiceUser[] {
    return voiceChannels.get(channelId) || [];
}

export function addVoiceUser(channelId: string, user: VoiceUser): void {
    if (!voiceChannels.has(channelId)) voiceChannels.set(channelId, []);
    const users = voiceChannels.get(channelId)!;
    if (!users.some((u) => u.userId === user.userId)) {
        users.push(user);
    }
}

export function removeVoiceUser(channelId: string, usrId: string): void {
    const users = voiceChannels.get(channelId);
    if (!users) return;
    const filtered = users.filter((u) => u.userId !== usrId);
    if (filtered.length === 0) voiceChannels.delete(channelId);
    else voiceChannels.set(channelId, filtered);
}

export function findUserVoiceChannel(usrId: string): string | null {
    for (const [channelId, users] of voiceChannels) {
        if (users.some((u) => u.userId === usrId)) return channelId;
    }
    return null;
}

export function getVoiceChannelUsers(): Map<string, VoiceUser[]> {
    return voiceChannels;
}

export function registerVoiceHandlers(io: Server, socket: Socket, userId: string): void {
    socket.on('joinVoice', async (channelId: string,
        callback?: (res: { success: boolean; users?: VoiceUser[]; error?: string }) => void) => {
        try {
            const channel = await Channel.findById(channelId);
            if (!channel || channel.type !== 'voice') {
                callback?.({ success: false, error: 'Voice channel not found' }); return;
            }

            // Leave current voice channel if in one
            const currentChannel = findUserVoiceChannel(userId);
            if (currentChannel && currentChannel !== channelId) {
                removeVoiceUser(currentChannel, userId);
                socket.leave(`voice:${currentChannel}`);
                io.to(`server:${channel.serverId}`).emit('voiceStateUpdate', {
                    channelId: currentChannel, users: getVoiceUsers(currentChannel),
                });
            }

            addVoiceUser(channelId, { socketId: socket.id, userId, muted: false, deafened: false, camera: false, screenShare: false });
            socket.join(`voice:${channelId}`);

            const users = getVoiceUsers(channelId);
            io.to(`server:${channel.serverId}`).emit('voiceStateUpdate', { channelId, users });
            callback?.({ success: true, users });
        } catch (error) {
            console.error('joinVoice error:', error);
            callback?.({ success: false, error: 'Failed to join voice' });
        }
    });

    socket.on('leaveVoice', async (callback?: (res: { success: boolean }) => void) => {
        const channelId = findUserVoiceChannel(userId);
        if (channelId) {
            removeVoiceUser(channelId, userId);
            socket.leave(`voice:${channelId}`);
            const channel = await Channel.findById(channelId).catch(() => null);
            if (channel) {
                io.to(`server:${channel.serverId}`).emit('voiceStateUpdate', {
                    channelId, users: getVoiceUsers(channelId),
                });
            }
        }
        callback?.({ success: true });
    });

    socket.on('voiceToggleMute', (muted: boolean) => {
        const channelId = findUserVoiceChannel(userId);
        if (!channelId) return;
        const users = getVoiceUsers(channelId);
        const me = users.find((u) => u.userId === userId);
        if (me) me.muted = muted;
        io.to(`voice:${channelId}`).emit('voiceStateUpdate', { channelId, users });
    });

    socket.on('voiceToggleDeafen', (deafened: boolean) => {
        const channelId = findUserVoiceChannel(userId);
        if (!channelId) return;
        const users = getVoiceUsers(channelId);
        const me = users.find((u) => u.userId === userId);
        if (me) {
            me.deafened = deafened;
        }
        io.to(`voice:${channelId}`).emit('voiceStateUpdate', { channelId, users });
    });

    // Camera toggle
    socket.on('voiceToggleCamera', (camera: boolean) => {
        const channelId = findUserVoiceChannel(userId);
        if (!channelId) return;
        const users = getVoiceUsers(channelId);
        const me = users.find((u) => u.userId === userId);
        if (me) me.camera = camera;
        io.to(`voice:${channelId}`).emit('voiceStateUpdate', { channelId, users });
    });

    // Screen share toggle (so viewers can clear UI when sharer stops)
    socket.on('voiceScreenShare', (enabled: boolean) => {
        const channelId = findUserVoiceChannel(userId);
        if (!channelId) return;
        const users = getVoiceUsers(channelId);
        const me = users.find((u) => u.userId === userId);
        if (me) me.screenShare = enabled;
        io.to(`voice:${channelId}`).emit('voiceStateUpdate', { channelId, users });
    });

    // Kick user from voice channel (Owner/Admin/Moderator)
    socket.on('voiceKickUser', async (data: { targetSocketId: string }) => {
        try {
            const channelId = findUserVoiceChannel(userId);
            if (!channelId) return;
            const users = getVoiceUsers(channelId);
            const target = users.find((u) => u.socketId === data.targetSocketId);
            if (!target) return;
            if (target.userId === userId) return;

            const channel = await Channel.findById(channelId).catch(() => null);
            if (!channel) return;
            const server = await ServerModel.findById(channel.serverId).catch(() => null);
            if (!server) return;

            const isOwner = server.ownerId.toString() === userId;
            const me = server.members.find((m) => m.userId.toString() === userId);
            const isAdminOrMod = me?.role === 'admin' || me?.role === 'moderator';
            if (!isOwner && !isAdminOrMod) return;

            // Don't allow kicking the server owner
            if (target.userId === server.ownerId.toString()) return;

            removeVoiceUser(channelId, target.userId);

            // Force socket to leave room and notify client
            const targetSocket = io.sockets.sockets.get(data.targetSocketId);
            await targetSocket?.leave(`voice:${channelId}`);
            io.to(data.targetSocketId).emit('voiceKicked', { channelId });

            io.to(`voice:${channelId}`).emit('voiceStateUpdate', { channelId, users: getVoiceUsers(channelId) });
        } catch (err) {
            console.error('voiceKickUser error:', err);
        }
    });

    // WebRTC signaling relay
    socket.on('voiceSignal', (data: { targetSocketId: string; signal: unknown }) => {
        io.to(data.targetSocketId).emit('voiceSignal', {
            fromSocketId: socket.id,
            fromUserId: userId,
            signal: data.signal,
        });
    });

    // Legacy signaling support (offer/answer/ICE separately)
    socket.on('voiceOffer', (data: { targetSocketId: string; offer: unknown }) => {
        io.to(data.targetSocketId).emit('voiceOffer', {
            fromSocketId: socket.id, fromUserId: userId, offer: data.offer,
        });
    });

    socket.on('voiceAnswer', (data: { targetSocketId: string; answer: unknown }) => {
        io.to(data.targetSocketId).emit('voiceAnswer', {
            fromSocketId: socket.id, answer: data.answer,
        });
    });

    socket.on('voiceIceCandidate', (data: { targetSocketId: string; candidate: unknown }) => {
        io.to(data.targetSocketId).emit('voiceIceCandidate', {
            fromSocketId: socket.id, candidate: data.candidate,
        });
    });

    // Viewer requests a fresh offer from a peer (e.g. to get screen share stream when renegotiation was missed)
    socket.on('voiceRequestOffer', (data: { targetSocketId: string }) => {
        io.to(data.targetSocketId).emit('voiceRequestOffer', {
            fromSocketId: socket.id,
            fromUserId: userId,
        });
    });

    socket.on('getVoiceStates', (serverId: string, callback: (states: Record<string, VoiceUser[]>) => void) => {
        const states: Record<string, VoiceUser[]> = {};
        for (const [channelId, users] of voiceChannels) {
            if (users.length > 0) states[channelId] = users;
        }
        callback(states);
    });
}

export function handleVoiceDisconnect(io: Server, userId: string): void {
    const channelId = findUserVoiceChannel(userId);
    if (channelId) {
        removeVoiceUser(channelId, userId);
        Channel.findById(channelId).then((channel) => {
            if (channel) {
                io.to(`server:${channel.serverId}`).emit('voiceStateUpdate', {
                    channelId, users: getVoiceUsers(channelId),
                });
            }
        }).catch(() => { });
    }
}
