import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolio.controller';

/**
 * Creates portfolio routes
 */
export function createPortfolioRoutes(controller: PortfolioController): Router {
  const router = Router();

  /**
   * GET /users/:userId/portfolio
   * Get user's portfolio with stock positions
   */
  router.get('/users/:userId/portfolio', (req, res, next) =>
    controller.getPortfolio(req, res, next)
  );

  return router;
}
