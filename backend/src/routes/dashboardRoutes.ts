import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/stats', authMiddleware, dashboardController.getStats);

export default router;
