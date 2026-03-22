import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { Server as ServerModel } from '../models/Server';
import { Role } from '../models/Role';
import { parseMentions } from '../utils/mentionParser';

export interface ResolvedMentions {
  mentionIds: mongoose.Types.ObjectId[];
  everyoneIds: mongoose.Types.ObjectId[];
  hereIds: mongoose.Types.ObjectId[];
}

export async function resolveMentions(
  content: string,
  serverId: mongoose.Types.ObjectId,
  authorId: string
): Promise<ResolvedMentions> {
  const { usernames, roleNames, hasEveryone, hasHere } = parseMentions(content);
  const mentionIds: mongoose.Types.ObjectId[] = [];
  const everyoneIds: mongoose.Types.ObjectId[] = [];
  const hereIds: mongoose.Types.ObjectId[] = [];
  const mentionSet = new Set<string>();

  for (const username of usernames) {
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (user && user._id.toString() !== authorId && !mentionSet.has(user._id.toString())) {
      mentionIds.push(user._id);
      mentionSet.add(user._id.toString());
    }
  }

  const server = await ServerModel.findById(serverId);
  if (server) {
    for (const roleName of roleNames) {
      const role = await Role.findOne({
        serverId,
        name: { $regex: new RegExp(`^${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (role && !role.isSystemRole) {
        for (const m of server.members) {
          const uid = m.userId.toString();
          const hasRole = m.customRoleIds.some((id: mongoose.Types.ObjectId) => id.toString() === role._id.toString());
          if (hasRole && uid !== authorId && !mentionSet.has(uid)) {
            mentionIds.push(m.userId);
            mentionSet.add(uid);
          }
        }
      }
    }

    if (hasEveryone) {
      for (const m of server.members) {
        const uid = m.userId.toString();
        if (uid !== authorId && !mentionSet.has(uid)) {
          everyoneIds.push(m.userId);
          mentionSet.add(uid);
        }
      }
    }

    if (hasHere) {
      const memberIds = server.members.map((m) => m.userId);
      const onlineUsers = await User.find({
        _id: { $in: memberIds },
        status: { $in: ['online', 'idle', 'dnd'] },
      });
      for (const u of onlineUsers) {
        const uid = u._id.toString();
        if (uid !== authorId && !mentionSet.has(uid) && !everyoneIds.some((id) => id.toString() === uid)) {
          hereIds.push(u._id);
          mentionSet.add(uid);
        }
      }
    }
  }

  return { mentionIds, everyoneIds, hereIds };
}

export async function createMentionNotifications(
  messageId: mongoose.Types.ObjectId,
  channelId: mongoose.Types.ObjectId,
  serverId: mongoose.Types.ObjectId,
  authorId: string,
  content: string
): Promise<void> {
  const { mentionIds, everyoneIds, hereIds } = await resolveMentions(content, serverId, authorId);
  const authorObjId = new mongoose.Types.ObjectId(authorId);

  const mutedUserIds = await User.find(
    { mutedServers: serverId },
    { _id: 1 }
  ).then((users) => new Set(users.map((u) => u._id.toString())));

  const notifications: Array<{ userId: mongoose.Types.ObjectId; type: 'mention' | 'everyone' | 'here' }> = [];
  for (const uid of mentionIds) {
    if (!mutedUserIds.has(uid.toString())) {
      notifications.push({ userId: uid, type: 'mention' });
    }
  }
  for (const uid of everyoneIds) {
    if (!mutedUserIds.has(uid.toString())) {
      notifications.push({ userId: uid, type: 'everyone' });
    }
  }
  for (const uid of hereIds) {
    if (!mutedUserIds.has(uid.toString())) {
      notifications.push({ userId: uid, type: 'here' });
    }
  }

  if (notifications.length === 0) return;

  await Notification.insertMany(
    notifications.map(({ userId, type }) => ({
      userId,
      type,
      messageId,
      channelId,
      serverId,
      authorId: authorObjId,
      read: false,
    }))
  );
}
