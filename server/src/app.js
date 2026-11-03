import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.isProduction && env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS); // correct client IPs (rate limits) behind Render/Vercel

  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // No Origin header = same-origin, curl or server-to-server (e.g. health checks).
        callback(null, !origin || env.CLIENT_ORIGINS.includes(origin));
      },
    }),
  );
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  if (!env.isTest) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 600,
        skip: (req) => req.originalUrl.startsWith('/api/v1/media/'), // a page of thumbnails must not trip the limiter
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { success: false, message: 'Too many requests. Please try again later.' },
      }),
    );
  }

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
