import { Request, Response } from 'express';
import { Server } from '../models/Server';
import { Category } from '../models/Category';
import { Channel } from '../models/Channel';
import { User } from '../models/User';
import { Ban } from '../models/Ban';
import { initDefaultRoles } from './role.controller';
import crypto from 'crypto';
import { createServerSchema, updateServerSchema } from '../validators/server.validator';
import { SERVER_TEMPLATES } from '../config/templates';

export async function getTemplates(req: Request, res: Response): Promise<void> {
  try {
    res.json({ templates: SERVER_TEMPLATES });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
}

export async function createServer(req: Request, res: Response): Promise<void> {
  const result = createServerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const userId = req.user!.userId;
  const templateId = (req.body.templateId as string) || 'default';
  const template = SERVER_TEMPLATES.find((t) => t.id === templateId) || SERVER_TEMPLATES[0];

  try {
    const server = await Server.create({
      name: result.data.name,
      ownerId: userId,
      members: [{ userId, role: 'admin', customRoleIds: [], isBooster: false, isVip: false, joinedAt: new Date(), nickname: '', mutedUntil: null }],
    });

    const roleIds = await initDefaultRoles(String(server._id));
    server.roles = roleIds as any;
    await server.save();

    for (let catPos = 0; catPos < template.categories.length; catPos++) {
      const tCat = template.categories[catPos];
      const category = await Category.create({
        name: tCat.name, serverId: server._id, position: catPos,
      });

      for (let chPos = 0; chPos < tCat.channels.length; chPos++) {
        const tCh = tCat.channels[chPos];
        const channel = await Channel.create({
          name: tCh.name, type: tCh.type, serverId: server._id,
          categoryId: category._id, position: chPos,
        });
        category.channels.push(channel._id as any);
        server.channels.push(channel._id as any);
      }
      await category.save();
      server.categories.push(category._id as any);
    }

    await server.save();
    await User.findByIdAndUpdate(userId, { $push: { servers: server._id } });

    res.status(201).json({ server });
  } catch (error) {
    console.error('Create server error:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
}

export async function getServer(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId)
      .populate('categories')
      .populate('channels')
      .select('name description icon banner ownerId members categories channels roles inviteCode createdAt updatedAt')
      .lean();

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const isMember = server.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
      res.status(403).json({ error: 'You are not a member of this server' });
      return;
    }

    res.json({ server });
  } catch (error) {
    console.error('Get server error:', error);
    res.status(500).json({ error: 'Failed to get server' });
  }
}

export async function updateServer(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  const result = updateServerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can update settings' }); return;
    }

    const updates: Record<string, unknown> = {};
    if (result.data.name !== undefined) updates.name = result.data.name;
    if (result.data.description !== undefined) updates.description = result.data.description;
    if (result.data.icon !== undefined) updates.icon = result.data.icon;
    if (result.data.banner !== undefined) updates.banner = result.data.banner;

    const updated = await Server.findByIdAndUpdate(serverId, updates, { returnDocument: 'after' });
    res.json({ server: updated });
  } catch (error) {
    console.error('Update server error:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
}

export async function regenerateInviteCode(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can regenerate invite link' }); return;
    }

    server.inviteCode = crypto.randomBytes(4).toString('hex');
    await server.save();
    res.json({ server });
  } catch (error) {
    console.error('Regenerate invite error:', error);
    res.status(500).json({ error: 'Failed to regenerate invite link' });
  }
}

export async function deleteServer(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can delete the server' }); return;
    }

    await Channel.deleteMany({ serverId });
    await Category.deleteMany({ serverId });

    const memberIds = server.members.map((m) => m.userId);
    await User.updateMany({ _id: { $in: memberIds } }, { $pull: { servers: server._id } });
    await Server.findByIdAndDelete(serverId);
    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
}

export async function joinServerByInvite(req: Request, res: Response): Promise<void> {
  const { inviteCode } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findOne({ inviteCode });
    if (!server) { res.status(404).json({ error: 'Invalid invite code' }); return; }

    const banned = await Ban.findOne({ serverId: server._id, userId });
    if (banned) { res.status(403).json({ error: 'You are banned from this server' }); return; }

    const alreadyMember = server.members.some((m) => m.userId.toString() === userId);
    if (alreadyMember) { res.json({ server, alreadyMember: true }); return; }

    server.members.push({
      userId: userId as any, role: 'member', customRoleIds: [], isBooster: false, isVip: false,
      joinedAt: new Date(), nickname: '', mutedUntil: null,
    });
    await server.save();
    await User.findByIdAndUpdate(userId, { $push: { servers: server._id } });

    res.json({ server, alreadyMember: false });
  } catch (error) {
    console.error('Join server error:', error);
    res.status(500).json({ error: 'Failed to join server' });
  }
}

export async function leaveServer(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }

    if (server.ownerId.toString() === userId) {
      res.status(400).json({ error: 'Server owner cannot leave. Transfer ownership or delete the server.' });
      return;
    }

    await Server.findByIdAndUpdate(serverId, { $pull: { members: { userId } } });
    await User.findByIdAndUpdate(userId, { $pull: { servers: serverId } });
    res.json({ message: 'Left the server' });
  } catch (error) {
    console.error('Leave server error:', error);
    res.status(500).json({ error: 'Failed to leave server' });
  }
}

export async function getServerMembers(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;
  const search = (req.query.search as string)?.trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 500);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }

    const isMember = server.members.some((m) => m.userId.toString() === userId);
    if (!isMember) { res.status(403).json({ error: 'You are not a member of this server' }); return; }

    const memberIds = server.members.map((m) => m.userId);
    const baseMatch = { _id: { $in: memberIds } };
    const searchMatch = search
      ? { $or: [{ displayName: { $regex: search, $options: 'i' } }, { username: { $regex: search, $options: 'i' } }] }
      : {};
    const match = search ? { $and: [baseMatch, searchMatch] } : baseMatch;

    const searchLimit = search ? 100 : limit;
    const users = await User.find(match)
      .select('username displayName avatar banner status activityStatus')
      .skip(offset).limit(searchLimit).lean();

    // Build role/attribute map from server members
    const memberMap = new Map<string, { role: string; isBooster: boolean; isVip: boolean }>();
    for (const m of server.members) {
      memberMap.set(m.userId.toString(), { role: m.role, isBooster: m.isBooster, isVip: m.isVip });
    }

    const members = users.map((u) => {
      const obj = u as { _id: unknown; status?: string };
      const info = memberMap.get(String(obj._id));
      if (String(obj._id) !== userId && obj.status === 'invisible') {
        return { ...obj, status: 'offline', role: info?.role, isBooster: info?.isBooster, isVip: info?.isVip };
      }
      return { ...obj, role: info?.role, isBooster: info?.isBooster, isVip: info?.isVip };
    });

    const total = search
      ? await User.countDocuments({
        _id: { $in: memberIds },
        $or: [{ displayName: { $regex: search, $options: 'i' } }, { username: { $regex: search, $options: 'i' } }],
      })
      : memberIds.length;

    res.json({ members, total, hasMore: offset + members.length < total });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
}

export async function getUserServers(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const user = await User.findById(userId).populate('servers').lean();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ servers: user.servers });
  } catch (error) {
    console.error('Get user servers error:', error);
    res.status(500).json({ error: 'Failed to get servers' });
  }
}

export async function transferOwnership(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const { newOwnerId } = req.body;
  const userId = req.user!.userId;

  if (!newOwnerId) {
    res.status(400).json({ error: 'New owner ID is required' });
    return;
  }

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can transfer ownership' }); return;
    }

    const newOwnerMember = server.members.find((m) => m.userId.toString() === newOwnerId);
    if (!newOwnerMember) {
      res.status(400).json({ error: 'New owner must be a member of the server' }); return;
    }

    // Update roles: new owner becomes admin, old owner becomes member
    newOwnerMember.role = 'admin';
    const oldOwnerMember = server.members.find((m) => m.userId.toString() === userId);
    if (oldOwnerMember) oldOwnerMember.role = 'member';

    server.ownerId = newOwnerId as any;
    await server.save();
    res.json({ server });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
}
