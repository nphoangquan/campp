import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  searchUsers,
  getFriends,
  sendFriendRequest,
  sendFriendRequestByUsername,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from '../controllers/friend.controller';

const router = Router();

router.use(authenticate);

router.get('/search', searchUsers);
router.post('/request-by-username', sendFriendRequestByUsername);
router.get('/', getFriends);
router.post('/request/:targetId', sendFriendRequest);
router.post('/accept/:targetId', acceptFriendRequest);
router.post('/decline/:targetId', declineFriendRequest);
router.post('/cancel/:targetId', cancelFriendRequest);
router.delete('/:targetId', removeFriend);

export default router;
