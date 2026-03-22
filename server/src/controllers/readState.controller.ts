import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Channel } from '../models/Channel';
import { Server } from '../models/Server';
import { ReadState } from '../models/ReadState';
import { getMemberChannelPermissions, hasChannelPermission } from '../utils/channelPermission';
import { Permissions } from '../utils/permissions';

export async function markChannelRead(req: Request, res: Response): Promise<void> {
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
            res.status(403).json({ error: 'You do not have permission to read this channel' }); return;
        }

        const lastReadAt = new Date();
        await ReadState.findOneAndUpdate(
            { userId, channelId },
            { lastReadAt },
            { upsert: true, returnDocument: 'after' }
        );

        res.json({ lastReadAt });
    } catch (error) {
        console.error('Mark channel read error:', error);
        res.status(500).json({ error: 'Failed to mark channel read' });
    }
}

export async function getUnreadCounts(req: Request, res: Response): Promise<void> {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    try {
        const server = await Server.findById(serverId);
        if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
        const isMember = server.members.some((m) => m.userId.toString() === userId);
        if (!isMember) { res.status(403).json({ error: 'You are not a member of this server' }); return; }

        const channelIds = server.channels.map((c) => c.toString());
        const channelObjectIds = channelIds.map((id) => new mongoose.Types.ObjectId(id));
        const userIdObj = new mongoose.Types.ObjectId(userId);

        const results = await Message.aggregate([
            { $match: { channelId: { $in: channelObjectIds }, deleted: false } },
            {
                $lookup: {
                    from: 'readstates',
                    let: { chId: '$channelId', uid: userIdObj },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$channelId', '$$chId'] },
                                        { $eq: ['$userId', '$$uid'] },
                                    ],
                                },
                            },
                        },
                        { $project: { lastReadAt: 1 } },
                    ],
                    as: 'readState',
                },
            },
            {
                $addFields: {
                    lastReadAt: { $arrayElemAt: ['$readState.lastReadAt', 0] },
                },
            },
            {
                $match: {
                    $expr: {
                        $or: [
                            { $eq: ['$lastReadAt', null] },
                            { $gt: ['$createdAt', '$lastReadAt'] },
                        ],
                    },
                },
            },
            { $group: { _id: '$channelId', count: { $sum: 1 } } },
        ]);

        const unreadCounts: Record<string, number> = {};
        for (const r of results) {
            const chId = r._id.toString();
            if (r.count > 0) unreadCounts[chId] = r.count;
        }

        res.json({ unreadCounts });
    } catch (error) {
        console.error('Get unread counts error:', error);
        res.status(500).json({ error: 'Failed to get unread counts' });
    }
}
