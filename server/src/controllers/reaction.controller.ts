import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Channel } from '../models/Channel';
import { Server } from '../models/Server';
import { getMemberChannelPermissions, hasChannelPermission } from '../utils/channelPermission';
import { Permissions } from '../utils/permissions';

export async function toggleReaction(req: Request, res: Response): Promise<void> {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.userId;

    if (!emoji || typeof emoji !== 'string') {
        res.status(400).json({ error: 'Emoji is required' });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message || message.deleted) {
            res.status(404).json({ error: 'Message not found' }); return;
        }

        const channel = await Channel.findById(message.channelId);
        const server = await Server.findById(message.serverId);
        if (channel && server) {
            const perms = await getMemberChannelPermissions(userId, channel, server);
            if (!hasChannelPermission(perms, Permissions.ADD_REACTIONS)) {
                res.status(403).json({ error: 'You do not have permission to add reactions in this channel' }); return;
            }
        }

        const existingReaction = message.reactions.find((r) => r.emoji === emoji);

        if (existingReaction) {
            const userIndex = existingReaction.users.findIndex((u) => u.toString() === userId);
            if (userIndex >= 0) {
                existingReaction.users.splice(userIndex, 1);
                if (existingReaction.users.length === 0) {
                    message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
                }
            } else {
                existingReaction.users.push(userId as any);
            }
        } else {
            message.reactions.push({ emoji, users: [userId as any] });
        }

        await message.save();
        res.json({ reactions: message.reactions, channelId: message.channelId });
    } catch (error) {
        console.error('Toggle reaction error:', error);
        res.status(500).json({ error: 'Failed to toggle reaction' });
    }
}
