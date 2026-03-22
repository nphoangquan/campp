import { Router } from 'express';
import { getInvitePreview } from '../controllers/invite.controller';

const router = Router();

router.get('/:code/preview', getInvitePreview);

export default router;
