import { Router } from 'express';
import * as affiliateController from '../controllers/affiliateController';
import { apiKeyMiddleware } from '../middleware/apiKeyMiddleware';

const router = Router();

router.use(apiKeyMiddleware);
router.post('/affiliates', affiliateController.createFromApi);
router.get('/affiliates/:merchant_code', affiliateController.getByMerchantCodeApi);

export default router;
