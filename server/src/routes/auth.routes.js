import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerBody } from '../validators/customer.validators.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

const loginBody = z.strictObject({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many sign-ups from this connection. Please try again later.' },
});

// Public sign-up creates CUSTOMER accounts only (the body is strict, so a `role` field is rejected and the
// service always assigns the customer role). Administrator accounts come only from `npm run create-admin`.
router.post('/register', registerLimiter, validate({ body: registerBody }), auth.register);
router.post('/login', loginLimiter, validate({ body: loginBody }), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.me);

export default router;
