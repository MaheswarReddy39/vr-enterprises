import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as bannerCtl from '../controllers/banner.controller.js';
import * as adminCtl from '../controllers/admin.controller.js';
import * as store from '../controllers/store.controller.js';
import { validate } from '../middleware/validate.js';
import { cartQuoteBody, lookupBody } from '../validators/customer.validators.js';
import { enquiryBody, relatedQuery, storeKeyParams, storeListQuery } from '../validators/store.validators.js';

const router = Router();

// Public, read-only catalogue. No authentication, and nothing here can return unpublished products or
// admin-only fields: see services/store.service.js.
router.get('/categories', store.listCategories);
router.get('/products', validate({ query: storeListQuery }), store.listProducts);
router.get('/products/:key', validate({ params: storeKeyParams }), store.getProduct);
router.get('/products/:key/related', validate({ params: storeKeyParams, query: relatedQuery }), store.relatedProducts);

// Guests keep their cart / wishlist in the browser; these read-only endpoints price and describe them.
router.get('/settings', adminCtl.publicSettings);
router.get('/banners', bannerCtl.listPublic);
router.post('/products/lookup', validate({ body: lookupBody }), store.lookupProducts);
router.post('/cart/quote', validate({ body: cartQuoteBody }), store.quoteCart);

const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many enquiries from this connection. Please try again later.' },
});
router.post('/enquiries', enquiryLimiter, validate({ body: enquiryBody }), store.createEnquiry);

export default router;
