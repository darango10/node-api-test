import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler.js';
import { requestContextMiddleware } from './middlewares/request-context.js';
import { generalRateLimiter } from './middlewares/rate-limit.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';

export const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : '*',
    credentials: true,
  }));

  // Body parsing with size limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request context middleware
  app.use(requestContextMiddleware);

  // Rate limiting
  app.use(generalRateLimiter);

  // Health and metrics routes (no rate limit)
  app.use(healthRoutes);
  app.use(metricsRoutes);

  // API routes will be added here

  // Error handler must be last
  app.use(errorHandler);

  return app;
};
