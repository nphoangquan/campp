import { Request, Response } from 'express';
import { Server } from '../models/Server';

export async function getInvitePreview(req: Request, res: Response): Promise<void> {
  const { code } = req.params;

  try {
    const server = await Server.findOne({ inviteCode: code }).select('name description icon banner members').lean();
    if (!server) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    const memberCount = server.members.length;
    res.json({
      name: server.name,
      description: server.description || '',
      icon: server.icon,
      banner: server.banner || '',
      memberCount,
      onlineCount: memberCount,
    });
  } catch (error) {
    console.error('Invite preview error:', error);
    res.status(500).json({ error: 'Failed to load invite' });
  }
}
