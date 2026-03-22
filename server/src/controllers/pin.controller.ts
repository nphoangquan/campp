import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Channel } from '../models/Channel';
import { Server } from '../models/Server';
import { getMemberChannelPermissions, hasChannelPermission } from '../utils/channelPermission';
import { Permissions } from '../utils/permissions';

export async function togglePin(req: Request, res: Response): Promise<void> {
    const { messageId } = req.params;
    const userId = req.user!.userId;

    try {
        const message = await Message.findById(messageId);
        if (!message || message.deleted) { res.status(404).json({ error: 'Message not found' }); return; }

        const server = await Server.findById(message.serverId);
        const channel = await Channel.findById(message.channelId);
        if (!server || !channel) { res.status(404).json({ error: 'Server or channel not found' }); return; }

        const perms = await getMemberChannelPermissions(userId, channel, server);
        if (!hasChannelPermission(perms, Permissions.MANAGE_MESSAGES)) {
            res.status(403).json({ error: 'You do not have permission to pin messages in this channel' }); return;
        }

        message.pinned = !message.pinned;
        await message.save();

        const populated = await Message.findById(messageId)
            .populate('authorId', 'username displayName avatar banner status');

        res.json({ message: populated });
    } catch (error) {
        console.error('Toggle pin error:', error);
        res.status(500).json({ error: 'Failed to toggle pin' });
    }
}

export async function getPinnedMessages(req: Request, res: Response): Promise<void> {
    const { channelId } = req.params;
    const userId = req.user!.userId;

    try {
        const channel = await Channel.findById(channelId);
        if (!channel) { res.status(404).json({ error: 'Channel not found' }); return; }

        const server = await Server.findById(channel.serverId);
        if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
        const isMember = server.members.some((m) => m.userId.toString() === userId);
        if (!isMember) { res.status(403).json({ error: 'You are not a member of this server' }); return; }

        const perms = await getMemberChannelPermissions(userId, channel, server);
        if (!hasChannelPermission(perms, Permissions.READ_MESSAGES)) {
            res.status(403).json({ error: 'You do not have permission to read messages in this channel' }); return;
        }

        const pinned = await Message.find({ channelId, pinned: true, deleted: false })
            .sort({ createdAt: -1 })
            .populate('authorId', 'username displayName avatar banner status')
            .lean();

        res.json({ messages: pinned });
    } catch (error) {
        console.error('Get pinned error:', error);
        res.status(500).json({ error: 'Failed to get pinned messages' });
    }
}
