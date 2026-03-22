import { Request, Response } from 'express';
import { User } from '../models/User';
import { Conversation } from '../models/Conversation';
import { emitToUser } from '../socket';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTargetId(params: { targetId?: string | string[] }): string {
  const raw = params.targetId;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

export async function searchUsers(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const query = (req.query.q as string || '').trim();

  if (query.length < 1) {
    res.json({ users: [] });
    return;
  }

  try {
    const escaped = escapeRegex(query);
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      _id: { $ne: userId },
      $or: [
        { username: { $regex: regex } },
        { displayName: { $regex: regex } },
      ],
    })
      .select('username displayName avatar status')
      .limit(20)
      .lean();

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
}

export async function sendFriendRequestByUsername(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const username = (req.body.username as string || '').trim().toLowerCase();

  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  try {
    const targetUser = await User.findOne({
      _id: { $ne: userId },
      $or: [
        { username: new RegExp(`^${escapeRegex(username)}$`, 'i') },
        { displayName: new RegExp(`^${escapeRegex(username)}$`, 'i') },
      ],
    }).select('_id username displayName avatar status');

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetId = targetUser._id.toString();
    const [currentUser, target] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (currentUser.friends.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: 'Already friends' });
      return;
    }

    if (currentUser.friendRequests.outgoing.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: 'Friend request already sent' });
      return;
    }

    if (currentUser.friendRequests.incoming.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: 'This user already sent you a request. Accept it instead.' });
      return;
    }

    // Privacy check: does target allow friend requests?
    if (target.allowFriendRequests === 'none') {
      res.status(403).json({ error: 'This user is not accepting friend requests' });
      return;
    }

    currentUser.friendRequests.outgoing.push(targetId as any);
    target.friendRequests.incoming.push(userId as any);
    await Promise.all([currentUser.save(), target.save()]);

    emitToUser(targetId, 'friendListUpdate', { type: 'incoming' });
    res.json({ message: 'Friend request sent', user: targetUser });
  } catch (error) {
    console.error('Send friend request by username error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
}

export async function sendFriendRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const targetId = getTargetId(req.params);

  if (userId === targetId) {
    res.status(400).json({ error: 'Cannot send friend request to yourself' });
    return;
  }

  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (currentUser.friends.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: 'Already friends' });
      return;
    }

    if (currentUser.friendRequests.outgoing.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: 'Friend request already sent' });
      return;
    }

    if (currentUser.friendRequests.incoming.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: 'This user already sent you a request. Accept it instead.' });
      return;
    }

    // Privacy check: does target allow friend requests?
    if (targetUser.allowFriendRequests === 'none') {
      res.status(403).json({ error: 'This user is not accepting friend requests' });
      return;
    }

    currentUser.friendRequests.outgoing.push(targetId as any);
    targetUser.friendRequests.incoming.push(userId as any);
    await Promise.all([currentUser.save(), targetUser.save()]);

    emitToUser(targetId, 'friendListUpdate', { type: 'incoming' });
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
}

export async function acceptFriendRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const targetId = getTargetId(req.params);

  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const hasIncoming = currentUser.friendRequests.incoming.some((f) => f.toString() === targetId);
    if (!hasIncoming) {
      res.status(400).json({ error: 'No pending friend request from this user' });
      return;
    }

    currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(
      (f) => f.toString() !== targetId
    );
    targetUser.friendRequests.outgoing = targetUser.friendRequests.outgoing.filter(
      (f) => f.toString() !== userId
    );

    currentUser.friends.push(targetId as any);
    targetUser.friends.push(userId as any);

    await Promise.all([currentUser.save(), targetUser.save()]);

    emitToUser(targetId, 'friendListUpdate', { type: 'accepted', newFriendId: userId, acceptedBy: currentUser.displayName });

    let conversation = await Conversation.findOne({
      participants: { $all: [userId, targetId], $size: 2 },
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [userId, targetId] });
    }

    res.json({ message: 'Friend request accepted', conversationId: conversation._id });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
}

export async function declineFriendRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const targetId = getTargetId(req.params);

  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(
      (f) => f.toString() !== targetId
    );
    targetUser.friendRequests.outgoing = targetUser.friendRequests.outgoing.filter(
      (f) => f.toString() !== userId
    );

    await Promise.all([currentUser.save(), targetUser.save()]);
    emitToUser(targetId, 'friendListUpdate', { type: 'declined' });
    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
}

export async function cancelFriendRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const targetId = getTargetId(req.params);

  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    currentUser.friendRequests.outgoing = currentUser.friendRequests.outgoing.filter(
      (f) => f.toString() !== targetId
    );
    targetUser.friendRequests.incoming = targetUser.friendRequests.incoming.filter(
      (f) => f.toString() !== userId
    );

    await Promise.all([currentUser.save(), targetUser.save()]);
    emitToUser(targetId, 'friendListUpdate', { type: 'cancelled' });
    res.json({ message: 'Friend request cancelled' });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
}

export async function removeFriend(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const targetId = getTargetId(req.params);

  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    currentUser.friends = currentUser.friends.filter((f) => f.toString() !== targetId);
    targetUser.friends = targetUser.friends.filter((f) => f.toString() !== userId);

    await Promise.all([currentUser.save(), targetUser.save()]);
    emitToUser(targetId, 'friendListUpdate', { type: 'removed' });
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
}

export async function getFriends(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    const user = await User.findById(userId)
      .populate('friends', 'username displayName avatar banner status activityStatus')
      .populate('friendRequests.incoming', 'username displayName avatar banner status')
      .populate('friendRequests.outgoing', 'username displayName avatar banner status');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const mapInvisibleToOffline = (u: { status?: string } & Record<string, unknown>) =>
      u.status === 'invisible' ? { ...u, status: 'offline' } : u;

    const toArr = (arr: unknown) => (Array.isArray(arr) ? arr : []) as Array<{ status?: string } & Record<string, unknown>>;

    res.json({
      friends: toArr(user.friends).map(mapInvisibleToOffline),
      incoming: toArr(user.friendRequests.incoming).map(mapInvisibleToOffline),
      outgoing: toArr(user.friendRequests.outgoing).map(mapInvisibleToOffline),
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
}
