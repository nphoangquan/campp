import { Router } from 'express';
import { getLinkPreview } from '../controllers/linkPreview.controller';

const router = Router();

router.get('/', getLinkPreview);

export default router;
