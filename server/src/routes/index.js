import { Router } from 'express';
import accountRoutes from './account.routes.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import mediaRoutes from './media.routes.js';
import storeRoutes from './store.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ name: 'VR Water Solutions API', version: 'v1' });
});
router.use('/health', healthRoutes);
router.use('/media', mediaRoutes);
router.use('/store', storeRoutes);
router.use('/auth', authRoutes);
router.use('/account', accountRoutes);
router.use('/admin', adminRoutes);

export default router;
