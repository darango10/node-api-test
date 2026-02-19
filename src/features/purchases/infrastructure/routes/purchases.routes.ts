import { Router } from 'express';
import { ExecutePurchase } from '../../application/use-cases/execute-purchase';
import { PurchasesController } from '../controllers/purchases.controller';

/**
 * Create purchases router with dependency injection
 */
export function purchasesRouter(executePurchase: ExecutePurchase): Router {
  const router = Router({ mergeParams: true }); // mergeParams to access :userId from parent
  const controller = new PurchasesController(executePurchase);

  /**
   * POST /users/:userId/purchases
   * Execute a stock purchase
   *
   * Request body:
   * {
   *   "symbol": "AAPL",
   *   "quantity": 10,
   *   "price": 150.00
   * }
   *
   * Responses:
   * - 201: Purchase successful
   * - 400: Validation error or price out of tolerance
   * - 404: Stock symbol not found
   * - 502: Vendor unavailable
   */
  router.post('/', (req, res, next) => controller.createPurchase(req, res, next));

  return router;
}
