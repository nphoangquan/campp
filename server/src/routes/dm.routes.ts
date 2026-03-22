import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getConversations,
  getOrCreateConversation,
  getDirectMessages,
  sendDirectMessage,
} from '../controllers/dm.controller';

const router = Router();

router.use(authenticate);

router.get('/conversations', getConversations);
router.post('/conversations/:targetId', getOrCreateConversation);
router.get('/:conversationId/messages', getDirectMessages);
router.post('/:conversationId/messages', sendDirectMessage);

export default router;
