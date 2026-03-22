import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  kickMember,
  banMember,
  unbanMember,
  muteMember,
  unmuteMember,
  getBans,
  getAuditLog,
  updateChannelPermissions,
} from '../controllers/moderation.controller';

const router = Router();

router.use(authenticate);

router.post('/:serverId/kick/:memberId', kickMember);
router.post('/:serverId/ban/:memberId', banMember);
router.delete('/:serverId/ban/:memberId', unbanMember);
router.post('/:serverId/mute/:memberId', muteMember);
router.delete('/:serverId/mute/:memberId', unmuteMember);
router.get('/:serverId/bans', getBans);
router.get('/:serverId/audit-log', getAuditLog);
router.patch('/channels/:channelId/permissions', updateChannelPermissions);

export default router;
