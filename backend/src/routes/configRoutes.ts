import { Router } from 'express';
import * as configController from '../controllers/configController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), configController.list);
router.patch('/', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), configController.update);
router.post('/generate-external-api-key', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), configController.generateExternalApiKey);

export default router;
