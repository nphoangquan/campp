import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { uploadFiles } from '../controllers/upload.controller';

const router = Router();

router.use(authenticate);
router.post('/', upload.array('files', 5), uploadFiles);

export default router;
