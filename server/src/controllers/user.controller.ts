import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Server as ServerModel } from '../models/Server';
import { updateProfileSchema, updatePasswordSchema } from '../validators/user.validator';

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (result.data.username !== undefined) {
      const existing = await User.findOne({ username: result.data.username, _id: { $ne: userId } });
      if (existing) {
        res.status(409).json({ error: 'This username is already taken' });
        return;
      }
      updates.username = result.data.username;
    }
    if (result.data.displayName !== undefined) updates.displayName = result.data.displayName;
    if (result.data.avatar !== undefined) updates.avatar = result.data.avatar;
    if (result.data.banner !== undefined) updates.banner = result.data.banner;
    if (result.data.activityStatus !== undefined) updates.activityStatus = result.data.activityStatus;

    const updated = await User.findByIdAndUpdate(userId, updates, { returnDocument: 'after' });
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userObj = updated.toObject ? updated.toObject() : updated;
    if (!userObj.mutedServers) userObj.mutedServers = [];
    res.json({ user: userObj });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function updatePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const result = updatePasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await user.comparePassword(result.data.currentPassword);
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(result.data.newPassword, 12);
    await User.findByIdAndUpdate(userId, {
      passwordHash,
      $inc: { tokenVersion: 1 },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
}

export async function toggleMuteServer(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const serverId = typeof req.params.serverId === 'string' ? req.params.serverId : req.params.serverId?.[0];
  if (!serverId) {
    res.status(400).json({ error: 'Server ID required' });
    return;
  }

  try {
    const server = await ServerModel.findById(serverId);
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    const isMember = server.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
      res.status(403).json({ error: 'You are not a member of this server' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const sid = new mongoose.Types.ObjectId(serverId);
    const muted = (user.mutedServers || []).map((id) => id.toString());
    const isMuted = muted.includes(serverId);

    if (isMuted) {
      await User.findByIdAndUpdate(userId, { $pull: { mutedServers: sid } });
    } else {
      await User.findByIdAndUpdate(userId, { $addToSet: { mutedServers: sid } });
    }

    const updated = await User.findById(userId).select('mutedServers').lean();
    const mutedServers = (updated?.mutedServers ?? []).map((id: mongoose.Types.ObjectId) => id.toString());
    res.json({ muted: !isMuted, mutedServers });
  } catch (error) {
    console.error('Toggle mute server error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
}

export async function getMutedServers(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const user = await User.findById(userId).select('mutedServers').lean();
    const mutedServers = (user?.mutedServers ?? []).map((id: mongoose.Types.ObjectId) => id.toString());
    res.json({ mutedServers });
  } catch (error) {
    console.error('Get muted servers error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
}

export async function updatePrivacySettings(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { allowDMs, allowFriendRequests } = req.body;

  try {
    const updates: Record<string, unknown> = {};
    if (typeof allowDMs === 'boolean') updates.allowDMs = allowDMs;
    if (['everyone', 'friends_of_friends', 'none'].includes(allowFriendRequests)) {
      updates.allowFriendRequests = allowFriendRequests;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid privacy settings provided' }); return;
    }

    const updated = await User.findByIdAndUpdate(userId, updates, { returnDocument: 'after' });
    if (!updated) { res.status(404).json({ error: 'User not found' }); return; }

    res.json({
      allowDMs: updated.allowDMs,
      allowFriendRequests: updated.allowFriendRequests,
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
}

export async function updateNotificationSettings(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { notificationSound, desktopNotifications } = req.body;

  try {
    const updates: Record<string, unknown> = {};
    if (typeof notificationSound === 'boolean') updates.notificationSound = notificationSound;
    if (typeof desktopNotifications === 'boolean') updates.desktopNotifications = desktopNotifications;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid notification settings provided' }); return;
    }

    const updated = await User.findByIdAndUpdate(userId, updates, { returnDocument: 'after' });
    if (!updated) { res.status(404).json({ error: 'User not found' }); return; }

    res.json({
      notificationSound: updated.notificationSound,
      desktopNotifications: updated.desktopNotifications,
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
}
