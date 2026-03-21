import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Server } from '../models/Server';

export async function searchMessages(req: Request, res: Response): Promise<void> {
    const { serverId } = req.params;
    const userId = req.user!.userId;
    const query = req.query.q as string;
    const channelId = req.query.channelId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 50);

    if (!query || query.trim().length === 0) {
        res.status(400).json({ error: 'Search query is required' }); return;
    }

    try {
        const server = await Server.findById(serverId);
        if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
        const isMember = server.members.some((m) => m.userId.toString() === userId);
        if (!isMember) { res.status(403).json({ error: 'You are not a member of this server' }); return; }

        const filter: Record<string, unknown> = {
            serverId, deleted: false,
            content: { $regex: query.trim(), $options: 'i' },
        };
        if (channelId) filter.channelId = channelId;

        const messages = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('authorId', 'username displayName avatar banner status')
            .populate('channelId', 'name')
            .lean();

        res.json({ messages, query: query.trim() });
    } catch (error) {
        console.error('Search messages error:', error);
        res.status(500).json({ error: 'Failed to search messages' });
    }
}
