import { Router } from 'express';
import { serveMedia } from '../controllers/media.controller.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';

const router = Router();

// Public on purpose: product and category images are shown to storefront visitors.
router.get('/:id', validate({ params: idParams }), serveMedia);

export default router;
