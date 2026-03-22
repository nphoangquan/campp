import { Request, Response } from 'express';
import { Server } from '../models/Server';
import { Category } from '../models/Category';
import { Channel } from '../models/Channel';
import {
    createChannelSchema,
    updateChannelSchema,
} from '../validators/server.validator';

export async function createChannel(req: Request, res: Response): Promise<void> {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const result = createChannelSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: result.error.issues[0].message });
        return;
    }

    try {
        const server = await Server.findById(serverId);
        if (!server) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }
        if (server.ownerId.toString() !== userId) {
            res.status(403).json({ error: 'Only the server owner can create channels' });
            return;
        }

        const { name, type, categoryId } = result.data;

        if (categoryId) {
            const category = await Category.findById(categoryId);
            if (!category || category.serverId.toString() !== serverId) {
                res.status(400).json({ error: 'Invalid category' });
                return;
            }
        }

        const channel = await Channel.create({
            name,
            type,
            serverId,
            categoryId: categoryId || null,
            position: server.channels.length,
        });

        server.channels.push(channel._id as any);
        await server.save();

        if (categoryId) {
            await Category.findByIdAndUpdate(categoryId, {
                $push: { channels: channel._id },
            });
        }

        res.status(201).json({ channel });
    } catch (error) {
        console.error('Create channel error:', error);
        res.status(500).json({ error: 'Failed to create channel' });
    }
}

export async function updateChannel(req: Request, res: Response): Promise<void> {
    const { channelId } = req.params;
    const userId = req.user!.userId;

    const result = updateChannelSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: result.error.issues[0].message });
        return;
    }

    try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        const server = await Server.findById(channel.serverId);
        if (!server || server.ownerId.toString() !== userId) {
            res.status(403).json({ error: 'Only the server owner can update channels' });
            return;
        }

        const updates: Record<string, unknown> = {};
        if (result.data.name !== undefined) updates.name = result.data.name;
        if (result.data.topic !== undefined) updates.topic = result.data.topic;

        const updated = await Channel.findByIdAndUpdate(channelId, updates, { returnDocument: 'after' });
        res.json({ channel: updated });
    } catch (error) {
        console.error('Update channel error:', error);
        res.status(500).json({ error: 'Failed to update channel' });
    }
}

export async function deleteChannel(req: Request, res: Response): Promise<void> {
    const { channelId } = req.params;
    const userId = req.user!.userId;

    try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        const server = await Server.findById(channel.serverId);
        if (!server || server.ownerId.toString() !== userId) {
            res.status(403).json({ error: 'Only the server owner can delete channels' });
            return;
        }

        await Server.findByIdAndUpdate(channel.serverId, {
            $pull: { channels: channelId },
        });
        if (channel.categoryId) {
            await Category.findByIdAndUpdate(channel.categoryId, {
                $pull: { channels: channelId },
            });
        }

        await Channel.findByIdAndDelete(channelId);
        res.json({ message: 'Channel deleted' });
    } catch (error) {
        console.error('Delete channel error:', error);
        res.status(500).json({ error: 'Failed to delete channel' });
    }
}

export async function getServerChannels(req: Request, res: Response): Promise<void> {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    try {
        const server = await Server.findById(serverId);
        if (!server) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }
        const isMember = server.members.some((m) => m.userId.toString() === userId);
        if (!isMember) {
            res.status(403).json({ error: 'You are not a member of this server' });
            return;
        }

        const categories = await Category.find({ serverId }).sort('position').populate('channels').lean();
        const uncategorized = await Channel.find({ serverId, categoryId: null }).sort('position').lean();

        res.json({ categories, uncategorized });
    } catch (error) {
        console.error('Get channels error:', error);
        res.status(500).json({ error: 'Failed to get channels' });
    }
}

export async function updateChannelPermissions(req: Request, res: Response): Promise<void> {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    const { permissionOverrides } = req.body;

    if (!Array.isArray(permissionOverrides)) {
        res.status(400).json({ error: 'permissionOverrides must be an array' });
        return;
    }

    try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        const server = await Server.findById(channel.serverId);
        if (!server || server.ownerId.toString() !== userId) {
            res.status(403).json({ error: 'Only the server owner can update channel permissions' });
            return;
        }

        channel.permissionOverrides = permissionOverrides;
        await channel.save();

        res.json({ channel });
    } catch (error) {
        console.error('Update channel permissions error:', error);
        res.status(500).json({ error: 'Failed to update channel permissions' });
    }
}

export async function reorderChannels(req: Request, res: Response): Promise<void> {
    const { serverId } = req.params;
    const userId = req.user!.userId;
    const { order } = req.body;

    if (!Array.isArray(order)) {
        res.status(400).json({ error: 'Order must be an array of channel IDs' });
        return;
    }

    try {
        const server = await Server.findById(serverId);
        if (!server) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }
        if (server.ownerId.toString() !== userId) {
            res.status(403).json({ error: 'Only the server owner can reorder channels' });
            return;
        }

        const bulkOps = order.map((channelId: string, i: number) => ({
            updateOne: {
                filter: { _id: channelId },
                update: { $set: { position: i } },
            },
        }));
        if (bulkOps.length > 0) {
            await Channel.bulkWrite(bulkOps);
        }

        res.json({ message: 'Channels reordered' });
    } catch (error) {
        console.error('Reorder channels error:', error);
        res.status(500).json({ error: 'Failed to reorder channels' });
    }
}
