import { Router } from 'express';
import * as affiliateController from '../controllers/affiliateController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';
import { uploadExcel, uploadEmailAttachments } from '../middleware/uploadMiddleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/template', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN), affiliateController.getTemplate);
router.post(
  '/import/excel',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  uploadExcel.single('file'),
  affiliateController.importExcel
);
router.get('/', authMiddleware, affiliateController.list);
router.get('/export', authMiddleware, affiliateController.exportAffiliates);
router.delete('/purge', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), affiliateController.purge);
router.post(
  '/sync-clictopay-batch',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  affiliateController.syncClicToPayBatch
);
router.post(
  '/sync-clictopay-scan',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  affiliateController.startClicToPayScan
);
router.post(
  '/sync-clictopay-simulate',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  affiliateController.simulateClicToPaySync
);
router.get(
  '/sync-clictopay-scan/status',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  affiliateController.getClicToPayScanStatus
);
router.get('/:id', authMiddleware, affiliateController.getById);
router.post('/', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN), affiliateController.create);
router.post(
  '/:id/send-email',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  uploadEmailAttachments.array('attachments', 5),
  affiliateController.sendEmail
);
router.post(
  '/:id/send-test-params',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT),
  affiliateController.sendTestParams
);
router.post(
  '/:id/send-prod-params',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT),
  affiliateController.sendProdParams
);
router.post(
  '/:id/verify-tests',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT),
  affiliateController.verifyTests
);
router.post(
  '/:id/sync-clictopay',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  affiliateController.syncClicToPay
);
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT),
  affiliateController.updateStatus
);
router.delete(
  '/:id',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN),
  affiliateController.deleteAffiliate
);

export default router;
