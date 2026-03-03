import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.get('/banks', userController.listBanks);
router.get('/', userController.list);
router.post('/', userController.create);
router.post('', userController.create);
router.get('/:id', userController.getById);
router.patch('/:id', userController.update);
router.delete('/:id', userController.remove);

export default router;
