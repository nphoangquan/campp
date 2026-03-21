import { Server, Socket } from 'socket.io';
import { Conversation } from '../../models/Conversation';
import { DirectMessage } from '../../models/DirectMessage';

const MESSAGE_RATE_LIMIT = 5;
const MESSAGE_RATE_WINDOW_MS = 5000;
const dmRateMap = new Map<string, { count: number; resetAt: number }>();

function checkDMRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = dmRateMap.get(userId);
    if (!entry || now >= entry.resetAt) {
        dmRateMap.set(userId, { count: 1, resetAt: now + MESSAGE_RATE_WINDOW_MS });
        return true;
    }
    entry.count++;
    return entry.count <= MESSAGE_RATE_LIMIT;
}

export function registerDMHandlers(io: Server, socket: Socket, userId: string): void {
    socket.on('joinDM', (conversationId: string) => {
        socket.join(`dm:${conversationId}`);
    });

    socket.on('leaveDM', (conversationId: string) => {
        socket.leave(`dm:${conversationId}`);
    });

    socket.on('sendDM', async (data: {
        conversationId: string; content: string;
        attachments?: { url: string; type: string; name: string; size: number; spoiler?: boolean }[];
    }, callback?: (res: { success: boolean; message?: unknown; error?: string }) => void) => {
        try {
            if (!checkDMRateLimit(userId)) {
                callback?.({ success: false, error: 'Rate limit exceeded. Please slow down.' }); return;
            }

            const conversation = await Conversation.findById(data.conversationId);
            if (!conversation) { callback?.({ success: false, error: 'Conversation not found' }); return; }

            const isParticipant = conversation.participants.some((p) => p.toString() === userId);
            if (!isParticipant) { callback?.({ success: false, error: 'Not a participant' }); return; }

            const hasContent = data.content && data.content.trim().length > 0;
            const hasAttachments = data.attachments && data.attachments.length > 0;
            if (!hasContent && !hasAttachments) {
                callback?.({ success: false, error: 'Message content or attachments required' }); return;
            }

            const messageData: Record<string, unknown> = {
                conversationId: data.conversationId, authorId: userId, content: data.content?.trim() || '',
            };
            if (hasAttachments) messageData.attachments = data.attachments;

            const message = await DirectMessage.create(messageData);
            conversation.lastMessage = message._id as any;
            await conversation.save();

            const populated = await DirectMessage.findById(message._id)
                .populate('authorId', 'username displayName avatar banner status');

            io.to(`dm:${data.conversationId}`).emit('dmReceived', populated);
            callback?.({ success: true, message: populated });
        } catch (error) {
            console.error('Socket sendDM error:', error);
            callback?.({ success: false, error: 'Failed to send DM' });
        }
    });

    socket.on('dmTypingStart', (conversationId: string) => {
        socket.to(`dm:${conversationId}`).emit('dmTypingStart', { conversationId, userId });
    });

    socket.on('markDMRead', async (conversationId: string) => {
        try {
            await DirectMessage.updateMany(
                {
                    conversationId,
                    authorId: { $ne: userId },
                    readBy: { $nin: [userId] },
                },
                { $addToSet: { readBy: userId } }
            );
            socket.to(`dm:${conversationId}`).emit('dmRead', { conversationId, userId });
        } catch (error) {
            console.error('markDMRead error:', error);
        }
    });
}
