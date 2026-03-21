import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Conversation } from '../models/Conversation';
import { DirectMessage } from '../models/DirectMessage';
import { User } from '../models/User';

function mapInvisibleToOffline<T extends { _id?: unknown; status?: string }>(userId: string, arr: T[]): T[] {
  return arr.map((u) => {
    const id = String((u as { _id?: { toString?: () => string } })._id?.toString?.() ?? (u as { _id?: string })._id);
    if (id !== userId && (u as { status?: string }).status === 'invisible') {
      return { ...u, status: 'offline' };
    }
    return u;
  });
}

export async function getConversations(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'username displayName avatar banner status')
      .populate({
        path: 'lastMessage',
        select: 'content authorId createdAt deleted',
        populate: { path: 'authorId', select: 'displayName' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const mapped = conversations.map((c) => ({
      ...c,
      participants: mapInvisibleToOffline(userId, (c as { participants: Array<{ _id?: unknown; status?: string }> }).participants),
    }));

    res.json({ conversations: mapped });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
}

export async function getOrCreateConversation(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { targetId } = req.params;

  try {
    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Privacy check: does target allow DMs?
    if (targetUser.allowDMs === false) {
      res.status(403).json({ error: 'This user has disabled direct messages' });
      return;
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [userId, targetId], $size: 2 },
    })
      .populate('participants', 'username displayName avatar banner status')
      .lean();

    if (!conversation) {
      const created = await Conversation.create({ participants: [userId, targetId] });
      conversation = await Conversation.findById(created._id)
        .populate('participants', 'username displayName avatar banner status')
        .lean();
    }

    if (conversation) {
      const mapped = {
        ...conversation,
        participants: mapInvisibleToOffline(userId, (conversation as { participants: Array<{ _id?: unknown; status?: string }> }).participants),
      };
      res.json({ conversation: mapped });
    } else {
      res.json({ conversation });
    }
  } catch (error) {
    console.error('Get/create conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
}

export async function getDirectMessages(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { conversationId } = req.params;
  const before = req.query.before as string;

  const beforeId = before && mongoose.Types.ObjectId.isValid(before) && String(new mongoose.Types.ObjectId(before)) === before
    ? new mongoose.Types.ObjectId(before)
    : null;

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const isParticipant = conversation.participants.some((p) => p.toString() === userId);
    if (!isParticipant) {
      res.status(403).json({ error: 'Not a participant' });
      return;
    }

    const query: Record<string, unknown> = { conversationId };
    if (beforeId) query._id = { $lt: beforeId };

    const messages = await DirectMessage.find(query)
      .sort({ _id: -1 })
      .limit(50)
      .populate('authorId', 'username displayName avatar banner status')
      .lean();

    const mapped = (messages as Array<{ authorId?: { _id?: unknown; status?: string } }>).map((m) => {
      const author = m.authorId as { _id?: unknown; status?: string } | undefined;
      if (author && String(author._id) !== userId && author.status === 'invisible') {
        return { ...m, authorId: { ...author, status: 'offline' } };
      }
      return m;
    });

    res.json({ messages: [...mapped].reverse() });
  } catch (error) {
    console.error('Get DMs error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}

export async function sendDirectMessage(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { conversationId } = req.params;
  const { content, attachments } = req.body;

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const isParticipant = conversation.participants.some((p) => p.toString() === userId);
    if (!isParticipant) {
      res.status(403).json({ error: 'Not a participant' });
      return;
    }

    const hasContent = content && content.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;
    if (!hasContent && !hasAttachments) {
      res.status(400).json({ error: 'Message content or attachments required' });
      return;
    }

    const messageData: Record<string, unknown> = {
      conversationId,
      authorId: userId,
      content: content?.trim() || '',
    };

    if (hasAttachments) {
      messageData.attachments = attachments;
    }

    const message = await DirectMessage.create(messageData);

    conversation.lastMessage = message._id as any;
    await conversation.save();

    const populated = await DirectMessage.findById(message._id)
      .populate('authorId', 'username displayName avatar banner status');

    res.status(201).json({ message: populated });
  } catch (error) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}
