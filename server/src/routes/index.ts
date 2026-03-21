import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import serverRoutes from './server.routes';
import messageRoutes from './message.routes';
import uploadRoutes from './upload.routes';
import roleRoutes from './role.routes';
import moderationRoutes from './moderation.routes';
import friendRoutes from './friend.routes';
import dmRoutes from './dm.routes';
import notificationRoutes from './notification.routes';
import linkPreviewRoutes from './linkPreview.routes';
import inviteRoutes from './invite.routes';
import { authenticate } from '../middleware/auth.middleware';
import { searchMessages } from '../controllers/search.controller';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/link-preview', linkPreviewRoutes);
router.use('/invite', inviteRoutes);
router.use('/servers', roleRoutes);
router.use('/servers', serverRoutes);
router.use('/channels', messageRoutes);
router.use('/upload', uploadRoutes);
router.use('/moderation', moderationRoutes);
router.use('/friends', friendRoutes);
router.use('/dm', dmRoutes);
router.use('/notifications', notificationRoutes);

router.get('/search/:serverId', authenticate, searchMessages);

export default router;
