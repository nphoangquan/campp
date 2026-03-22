import { Router } from 'express';
import {
    updateProfile, updatePassword, toggleMuteServer, getMutedServers,
    updatePrivacySettings, updateNotificationSettings,
} from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.put('/me', updateProfile);
router.put('/me/password', updatePassword);
router.get('/me/muted-servers', getMutedServers);
router.patch('/me/muted-servers/:serverId', toggleMuteServer);
router.patch('/me/privacy', updatePrivacySettings);
router.patch('/me/notifications', updateNotificationSettings);

export default router;

