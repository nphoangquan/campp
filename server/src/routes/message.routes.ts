import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getMessages, sendMessage, editMessage, deleteMessage } from '../controllers/message.controller';
import { toggleReaction } from '../controllers/reaction.controller';
import { togglePin, getPinnedMessages } from '../controllers/pin.controller';
import { markChannelRead } from '../controllers/readState.controller';

const router = Router();
router.use(authenticate);

router.post('/:channelId/read', markChannelRead);
router.get('/:channelId/messages', getMessages);
router.post('/:channelId/messages', sendMessage);
router.get('/:channelId/pinned', getPinnedMessages);
router.patch('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);
router.post('/messages/:messageId/reactions', toggleReaction);
router.patch('/messages/:messageId/pin', togglePin);

export default router;
