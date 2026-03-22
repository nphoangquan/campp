import { Server, Socket } from 'socket.io';
import { Message } from '../../models/Message';
import { Channel } from '../../models/Channel';
import { Server as ServerModel } from '../../models/Server';
import { getMemberChannelPermissions, hasChannelPermission } from '../../utils/channelPermission';
import { Permissions } from '../../utils/permissions';
import { resolveMentions, createMentionNotifications } from '../../services/notification.service';

const MESSAGE_RATE_LIMIT = 5;
const MESSAGE_RATE_WINDOW_MS = 5000;
const messageRateMap = new Map<string, { count: number; resetAt: number }>();

function checkMessageRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = messageRateMap.get(userId);
    if (!entry || now >= entry.resetAt) {
        messageRateMap.set(userId, { count: 1, resetAt: now + MESSAGE_RATE_WINDOW_MS });
        return true;
    }
    entry.count++;
    return entry.count <= MESSAGE_RATE_LIMIT;
}

export function registerMessageHandlers(io: Server, socket: Socket, userId: string): void {
    socket.on('sendMessage', async (data: {
        channelId: string; content: string; replyTo?: string;
        attachments?: { url: string; type: string; name: string; size: number; spoiler?: boolean }[];
    }, callback?: (res: { success: boolean; message?: unknown; error?: string }) => void) => {
        try {
            if (!checkMessageRateLimit(userId)) {
                callback?.({ success: false, error: 'Rate limit exceeded. Please slow down.' }); return;
            }

            const channel = await Channel.findById(data.channelId);
            if (!channel) { callback?.({ success: false, error: 'Channel not found' }); return; }

            const server = await ServerModel.findById(channel.serverId);
            if (!server) { callback?.({ success: false, error: 'Server not found' }); return; }

            const isMember = server.members.some((m) => m.userId.toString() === userId);
            if (!isMember) { callback?.({ success: false, error: 'Not a member' }); return; }

            const perms = await getMemberChannelPermissions(userId, channel, server);
            if (!hasChannelPermission(perms, Permissions.SEND_MESSAGES)) {
                callback?.({ success: false, error: 'No permission to send in this channel' }); return;
            }

            const hasContent = data.content && data.content.trim().length > 0;
            const hasAttachments = data.attachments && data.attachments.length > 0;
            if (!hasContent && !hasAttachments) {
                callback?.({ success: false, error: 'Message content or attachments required' }); return;
            }
            if (hasContent && data.content!.length > 2000) {
                callback?.({ success: false, error: 'Message must not exceed 2000 characters' }); return;
            }

            const content = (data.content?.trim() || '') as string;
            const { mentionIds, everyoneIds, hereIds } = await resolveMentions(content, channel.serverId, userId);
            const allMentions = [...mentionIds, ...everyoneIds, ...hereIds];

            const messageData: Record<string, unknown> = {
                content, authorId: userId, channelId: data.channelId,
                serverId: channel.serverId, type: 'default', mentions: allMentions,
            };

            if (data.replyTo) {
                const replyMsg = await Message.findById(data.replyTo);
                if (replyMsg && replyMsg.channelId.toString() === data.channelId) {
                    messageData.type = 'reply';
                    messageData.replyTo = data.replyTo;
                }
            }

            if (data.attachments && data.attachments.length > 0) {
                messageData.attachments = data.attachments;
            }

            const message = await Message.create(messageData);
            createMentionNotifications(message._id, message.channelId, message.serverId, userId, content)
                .catch((err) => console.error('createMentionNotifications error:', err));

            const populated = await Message.findById(message._id)
                .populate('authorId', 'username displayName avatar banner status')
                .populate({ path: 'replyTo', select: 'content authorId deleted', populate: { path: 'authorId', select: 'username displayName' } });

            io.to(`channel:${data.channelId}`).emit('messageReceived', populated);
            callback?.({ success: true, message: populated });
        } catch (error) {
            console.error('Socket sendMessage error:', error);
            callback?.({ success: false, error: 'Failed to send message' });
        }
    });

    socket.on('editMessage', async (data: { messageId: string; content: string },
        callback?: (res: { success: boolean; error?: string }) => void) => {
        try {
            const message = await Message.findById(data.messageId);
            if (!message || message.deleted) { callback?.({ success: false, error: 'Message not found' }); return; }
            if (message.authorId.toString() !== userId) { callback?.({ success: false, error: 'Not authorized' }); return; }

            const channel = await Channel.findById(message.channelId);
            const server = await ServerModel.findById(message.serverId);
            if (channel && server) {
                const perms = await getMemberChannelPermissions(userId, channel, server);
                if (!hasChannelPermission(perms, Permissions.SEND_MESSAGES)) {
                    callback?.({ success: false, error: 'No permission to send in this channel' }); return;
                }
            }

            if (!data.content || data.content.trim().length === 0 || data.content.length > 2000) {
                callback?.({ success: false, error: 'Invalid content' }); return;
            }

            message.content = data.content.trim();
            message.editedAt = new Date();
            await message.save();

            const populated = await Message.findById(data.messageId)
                .populate('authorId', 'username displayName avatar banner status')
                .populate({ path: 'replyTo', select: 'content authorId deleted', populate: { path: 'authorId', select: 'username displayName' } });

            io.to(`channel:${message.channelId}`).emit('messageUpdated', populated);
            callback?.({ success: true });
        } catch (error) {
            console.error('Socket editMessage error:', error);
            callback?.({ success: false, error: 'Failed to edit message' });
        }
    });

    socket.on('deleteMessage', async (messageId: string,
        callback?: (res: { success: boolean; error?: string }) => void) => {
        try {
            const message = await Message.findById(messageId);
            if (!message || message.deleted) { callback?.({ success: false, error: 'Message not found' }); return; }

            const server = await ServerModel.findById(message.serverId);
            const channel = await Channel.findById(message.channelId);
            const isAuthor = message.authorId.toString() === userId;

            if (!isAuthor && server && channel) {
                const perms = await getMemberChannelPermissions(userId, channel, server);
                if (!hasChannelPermission(perms, Permissions.MANAGE_MESSAGES)) {
                    callback?.({ success: false, error: 'No permission to delete' }); return;
                }
            } else if (!isAuthor) {
                callback?.({ success: false, error: 'Not authorized' }); return;
            }

            message.deleted = true;
            message.content = '';
            await message.save();

            io.to(`channel:${message.channelId}`).emit('messageDeleted', { messageId, channelId: message.channelId });
            callback?.({ success: true });
        } catch (error) {
            console.error('Socket deleteMessage error:', error);
            callback?.({ success: false, error: 'Failed to delete message' });
        }
    });

    socket.on('toggleReaction', async (data: { messageId: string; emoji: string },
        callback?: (res: { success: boolean; error?: string }) => void) => {
        try {
            const message = await Message.findById(data.messageId);
            if (!message || message.deleted) { callback?.({ success: false, error: 'Message not found' }); return; }

            const channel = await Channel.findById(message.channelId);
            const server = await ServerModel.findById(message.serverId);
            if (channel && server) {
                const perms = await getMemberChannelPermissions(userId, channel, server);
                if (!hasChannelPermission(perms, Permissions.ADD_REACTIONS)) {
                    callback?.({ success: false, error: 'No permission to add reactions' }); return;
                }
            }

            const existingReaction = message.reactions.find((r) => r.emoji === data.emoji);
            if (existingReaction) {
                const userIndex = existingReaction.users.findIndex((u) => u.toString() === userId);
                if (userIndex >= 0) {
                    existingReaction.users.splice(userIndex, 1);
                    if (existingReaction.users.length === 0) {
                        message.reactions = message.reactions.filter((r) => r.emoji !== data.emoji);
                    }
                } else {
                    existingReaction.users.push(userId as any);
                }
            } else {
                message.reactions.push({ emoji: data.emoji, users: [userId as any] });
            }

            await message.save();
            io.to(`channel:${message.channelId}`).emit('reactionUpdated', { messageId: data.messageId, reactions: message.reactions });
            callback?.({ success: true });
        } catch (error) {
            console.error('Socket toggleReaction error:', error);
            callback?.({ success: false, error: 'Failed to toggle reaction' });
        }
    });
}
