import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { errorHandler } from './middlewares/error-handler.js';
import { requestContextMiddleware } from './middlewares/request-context.js';
import { generalRateLimiter } from './middlewares/rate-limit.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import { createStocksRouter } from './routes/stocks.routes';
import { createPortfolioRoutes } from './routes/portfolio.routes';
import { PortfolioController } from './controllers/portfolio.controller';
import { createContainer } from '../config/container';

export const createApp = (): Express => {
  const app = express();

  // Security middleware with Swagger UI exception
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

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

  // Load OpenAPI spec (resolve from src/infrastructure/http directory)
  const openapiPath = path.resolve(process.cwd(), 'src/infrastructure/http/openapi.yaml');
  const openapiDocument = YAML.load(openapiPath);

  // Swagger UI (mounted before rate limiter for docs access)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Stock Trading API Docs',
  }));

  // Health and metrics routes (no rate limit)
  app.use(healthRoutes);
  app.use(metricsRoutes);

  // Create dependency injection container
  const container = createContainer();

  // Controllers
  const portfolioController = new PortfolioController(container.getPortfolioUseCase);

  // API routes
  app.use('/stocks', createStocksRouter(container.listStocksUseCase));
  app.use(createPortfolioRoutes(portfolioController));

  // Error handler must be last
  app.use(errorHandler);

  return app;
};
