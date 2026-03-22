import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Channel } from '../models/Channel';
import { Server } from '../models/Server';
import { sendMessageSchema, editMessageSchema } from '../validators/server.validator';
import { getMemberChannelPermissions, hasChannelPermission } from '../utils/channelPermission';
import { Permissions } from '../utils/permissions';

export async function getMessages(req: Request, res: Response): Promise<void> {
  const { channelId } = req.params;
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined;

  const beforeId = before && mongoose.Types.ObjectId.isValid(before) && String(new mongoose.Types.ObjectId(before)) === before
    ? new mongoose.Types.ObjectId(before)
    : null;

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

    const query: Record<string, unknown> = { channelId };
    if (beforeId) query._id = { $lt: beforeId };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('authorId', 'username displayName avatar banner status')
      .populate({
        path: 'replyTo',
        select: 'content authorId deleted',
        populate: { path: 'authorId', select: 'username displayName' },
      })
      .lean();

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { channelId } = req.params;
  const userId = req.user!.userId;

  const result = sendMessageSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return; }

  try {
    const channel = await Channel.findById(channelId);
    if (!channel) { res.status(404).json({ error: 'Channel not found' }); return; }

    const server = await Server.findById(channel.serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    const isMember = server.members.some((m) => m.userId.toString() === userId);
    if (!isMember) { res.status(403).json({ error: 'You are not a member of this server' }); return; }

    const perms = await getMemberChannelPermissions(userId, channel, server);
    if (!hasChannelPermission(perms, Permissions.SEND_MESSAGES)) {
      res.status(403).json({ error: 'You do not have permission to send messages in this channel' }); return;
    }

    const messageData: Record<string, unknown> = {
      content: result.data.content, authorId: userId, channelId, serverId: channel.serverId, type: 'default',
    };

    if (result.data.replyTo) {
      const replyMsg = await Message.findById(result.data.replyTo);
      if (replyMsg && replyMsg.channelId.toString() === channelId) {
        messageData.type = 'reply';
        messageData.replyTo = result.data.replyTo;
      }
    }

    if (result.data.attachments && result.data.attachments.length > 0) {
      messageData.attachments = result.data.attachments;
    }

    const message = await Message.create(messageData);
    const populated = await Message.findById(message._id)
      .populate('authorId', 'username displayName avatar banner status')
      .populate({
        path: 'replyTo',
        select: 'content authorId deleted',
        populate: { path: 'authorId', select: 'username displayName' },
      });

    res.status(201).json({ message: populated });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

export async function editMessage(req: Request, res: Response): Promise<void> {
  const { messageId } = req.params;
  const userId = req.user!.userId;

  const result = editMessageSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return; }

  try {
    const message = await Message.findById(messageId);
    if (!message || message.deleted) { res.status(404).json({ error: 'Message not found' }); return; }
    if (message.authorId.toString() !== userId) {
      res.status(403).json({ error: 'You can only edit your own messages' }); return;
    }

    const channel = await Channel.findById(message.channelId);
    const server = await Server.findById(message.serverId);
    if (channel && server) {
      const perms = await getMemberChannelPermissions(userId, channel, server);
      if (!hasChannelPermission(perms, Permissions.SEND_MESSAGES)) {
        res.status(403).json({ error: 'You do not have permission to send messages in this channel' }); return;
      }
    }

    message.content = result.data.content;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(messageId)
      .populate('authorId', 'username displayName avatar banner status')
      .populate({
        path: 'replyTo',
        select: 'content authorId deleted',
        populate: { path: 'authorId', select: 'username displayName' },
      });

    res.json({ message: populated });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
}

export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const { messageId } = req.params;
  const userId = req.user!.userId;

  try {
    const message = await Message.findById(messageId);
    if (!message || message.deleted) { res.status(404).json({ error: 'Message not found' }); return; }

    const server = await Server.findById(message.serverId);
    const channel = await Channel.findById(message.channelId);
    const isAuthor = message.authorId.toString() === userId;

    if (!isAuthor && server && channel) {
      const perms = await getMemberChannelPermissions(userId, channel, server);
      if (!hasChannelPermission(perms, Permissions.MANAGE_MESSAGES)) {
        res.status(403).json({ error: 'You do not have permission to delete this message' }); return;
      }
    } else if (!isAuthor) {
      res.status(403).json({ error: 'You do not have permission to delete this message' }); return;
    }

    message.deleted = true;
    message.content = '';
    await message.save();

    res.json({ message: { _id: messageId, deleted: true, channelId: message.channelId } });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}
