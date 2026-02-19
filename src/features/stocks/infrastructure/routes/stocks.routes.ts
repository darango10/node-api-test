import { Router } from 'express';
import { StocksController } from '../controllers/stocks.controller';
import { ListStocks } from '../../application/use-cases/list-stocks';

/**
 * Create stocks router
 * @param listStocksUseCase - Injected use case
 * @returns Express router
 */
export function createStocksRouter(listStocksUseCase: ListStocks): Router {
  const router = Router();
  const controller = new StocksController(listStocksUseCase);

  /**
   * GET /stocks
   * List available stocks with pagination
   *
   * Query parameters:
   * - nextToken (optional): Pagination token from previous response
   * - limit (optional): Max items per page (1-100, default 20)
   *
   * Responses:
   * - 200: Success with stocks array and optional nextToken
   * - 502: Vendor unavailable
   */
  router.get('/', (req, res, next) => controller.listStocks(req, res, next));

  return router;
}
