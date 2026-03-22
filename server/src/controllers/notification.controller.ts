import { Request, Response } from 'express';
import { Notification } from '../models/Notification';

const LIMIT = 50;

export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const tab = (req.query.tab as string) || 'mentions';
  const limit = Math.min(parseInt(req.query.limit as string, 10) || LIMIT, 100);

  try {
    if (tab === 'mentions') {
      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName avatar')
        .populate('channelId', 'name')
        .populate('serverId', 'name icon')
        .lean();

      res.json({ notifications });
      return;
    }

    if (tab === 'for-you') {
      res.json({ notifications: [] });
      return;
    }

    if (tab === 'unreads') {
      const notifications = await Notification.find({ userId, read: false })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName avatar')
        .populate('channelId', 'name')
        .populate('serverId', 'name icon')
        .lean();

      res.json({ notifications });
      return;
    }

    res.status(400).json({ error: 'Invalid tab' });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
}

export async function getUnreadNotificationCount(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const count = await Notification.countDocuments({ userId, read: false });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get count' });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const notif = await Notification.findOne({ _id: id, userId });
    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    notif.read = true;
    await notif.save();
    res.json({ notification: notif });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    await Notification.updateMany({ userId }, { read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
}
