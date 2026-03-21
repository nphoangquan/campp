import { Request, Response } from 'express';
import { Server } from '../models/Server';
import { User } from '../models/User';
import { Ban } from '../models/Ban';
import { AuditLog } from '../models/AuditLog';

export async function kickMember(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;
  const { reason } = req.body;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can kick members' }); return;
    }
    if (memberId === userId) { res.status(400).json({ error: 'Cannot kick yourself' }); return; }
    if (memberId === server.ownerId.toString()) { res.status(400).json({ error: 'Cannot kick the server owner' }); return; }

    const member = server.members.find((m) => m.userId.toString() === memberId);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    server.members = server.members.filter((m) => m.userId.toString() !== memberId);
    await server.save();

    await User.findByIdAndUpdate(memberId, { $pull: { servers: serverId } });

    await AuditLog.create({
      serverId, action: 'MEMBER_KICK', moderatorId: userId, targetId: memberId,
      reason: reason || '',
    });

    res.json({ message: 'Member kicked' });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ error: 'Failed to kick member' });
  }
}

export async function banMember(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;
  const { reason } = req.body;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can ban members' }); return;
    }
    if (memberId === userId) { res.status(400).json({ error: 'Cannot ban yourself' }); return; }
    if (memberId === server.ownerId.toString()) { res.status(400).json({ error: 'Cannot ban the server owner' }); return; }

    const existingBan = await Ban.findOne({ serverId, userId: memberId });
    if (existingBan) { res.status(400).json({ error: 'User is already banned' }); return; }

    await Ban.create({
      userId: memberId, serverId, bannedBy: userId, reason: reason || '',
    });

    server.members = server.members.filter((m) => m.userId.toString() !== memberId);
    await server.save();

    await User.findByIdAndUpdate(memberId, { $pull: { servers: serverId } });

    await AuditLog.create({
      serverId, action: 'MEMBER_BAN', moderatorId: userId, targetId: memberId,
      reason: reason || '',
    });

    res.json({ message: 'Member banned' });
  } catch (error) {
    console.error('Ban member error:', error);
    res.status(500).json({ error: 'Failed to ban member' });
  }
}

export async function unbanMember(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can unban members' }); return;
    }

    const ban = await Ban.findOneAndDelete({ serverId, userId: memberId });
    if (!ban) { res.status(404).json({ error: 'Ban not found' }); return; }

    await AuditLog.create({
      serverId, action: 'MEMBER_UNBAN', moderatorId: userId, targetId: memberId,
    });

    res.json({ message: 'Member unbanned' });
  } catch (error) {
    console.error('Unban member error:', error);
    res.status(500).json({ error: 'Failed to unban member' });
  }
}

export async function muteMember(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;
  const { duration, reason } = req.body;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can mute members' }); return;
    }
    if (memberId === server.ownerId.toString()) { res.status(400).json({ error: 'Cannot mute the server owner' }); return; }

    const member = server.members.find((m) => m.userId.toString() === memberId);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    const durationMs = Math.min(Math.max((duration || 5) * 60 * 1000, 60000), 28 * 24 * 60 * 60 * 1000);
    member.mutedUntil = new Date(Date.now() + durationMs);
    await server.save();

    await AuditLog.create({
      serverId, action: 'MEMBER_MUTE', moderatorId: userId, targetId: memberId,
      reason: reason || '',
      metadata: { durationMinutes: durationMs / 60000 },
    });

    res.json({ message: 'Member muted', mutedUntil: member.mutedUntil });
  } catch (error) {
    console.error('Mute member error:', error);
    res.status(500).json({ error: 'Failed to mute member' });
  }
}

export async function unmuteMember(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can unmute members' }); return;
    }

    const member = server.members.find((m) => m.userId.toString() === memberId);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    member.mutedUntil = null;
    await server.save();

    await AuditLog.create({
      serverId, action: 'MEMBER_UNMUTE', moderatorId: userId, targetId: memberId,
    });

    res.json({ message: 'Member unmuted' });
  } catch (error) {
    console.error('Unmute member error:', error);
    res.status(500).json({ error: 'Failed to unmute member' });
  }
}

export async function getBans(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can view bans' }); return;
    }

    const bans = await Ban.find({ serverId })
      .populate('userId', 'username displayName avatar')
      .populate('bannedBy', 'username displayName')
      .sort({ createdAt: -1 });

    res.json({ bans });
  } catch (error) {
    console.error('Get bans error:', error);
    res.status(500).json({ error: 'Failed to get bans' });
  }
}

export async function getAuditLog(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can view audit logs' }); return;
    }

    const logs = await AuditLog.find({ serverId })
      .populate('moderatorId', 'username displayName')
      .populate('targetId', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ logs });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}

export async function updateChannelPermissions(req: Request, res: Response): Promise<void> {
  const { channelId } = req.params;
  const userId = req.user!.userId;
  const { overrides } = req.body;

  try {
    const { Channel } = await import('../models/Channel');
    const channel = await Channel.findById(channelId);
    if (!channel) { res.status(404).json({ error: 'Channel not found' }); return; }

    const server = await Server.findById(channel.serverId);
    if (!server || server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can update channel permissions' }); return;
    }

    if (Array.isArray(overrides)) {
      channel.permissionOverrides = overrides;
    }
    await channel.save();

    res.json({ channel });
  } catch (error) {
    console.error('Update channel permissions error:', error);
    res.status(500).json({ error: 'Failed to update channel permissions' });
  }
}
