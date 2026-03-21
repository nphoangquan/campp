import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createServer, getServer, updateServer, deleteServer,
  regenerateInviteCode, joinServerByInvite, leaveServer,
  getServerMembers, getUserServers, getTemplates, transferOwnership,
} from '../controllers/server.controller';
import { createCategory, updateCategory, deleteCategory, reorderCategories } from '../controllers/category.controller';
import { createChannel, updateChannel, deleteChannel, getServerChannels, updateChannelPermissions, reorderChannels } from '../controllers/channel.controller';
import { getUnreadCounts } from '../controllers/readState.controller';

const router = Router();
router.use(authenticate);

// Server
router.get('/me', getUserServers);
router.get('/templates', getTemplates);
router.post('/', createServer);
router.get('/:serverId/unread-counts', getUnreadCounts);
router.get('/:serverId', getServer);
router.patch('/:serverId', updateServer);
router.post('/:serverId/regenerate-invite', regenerateInviteCode);
router.delete('/:serverId', deleteServer);
router.post('/join/:inviteCode', joinServerByInvite);
router.post('/:serverId/leave', leaveServer);
router.get('/:serverId/members', getServerMembers);
router.post('/:serverId/transfer-ownership', transferOwnership);

// Category
router.post('/:serverId/categories', createCategory);
router.patch('/categories/:categoryId', updateCategory);
router.delete('/categories/:categoryId', deleteCategory);
router.patch('/:serverId/categories/reorder', reorderCategories);

// Channel
router.post('/:serverId/channels', createChannel);
router.get('/:serverId/channels', getServerChannels);
router.patch('/channels/:channelId', updateChannel);
router.delete('/channels/:channelId', deleteChannel);
router.patch('/channels/:channelId/permissions', updateChannelPermissions);
router.patch('/:serverId/channels/reorder', reorderChannels);

export default router;
