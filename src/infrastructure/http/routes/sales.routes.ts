import { Router } from 'express';
import { ExecuteSell } from '../../../application/use-cases/execute-sell';
import { SalesController } from '../controllers/sales.controller';

/**
 * Create sales router with dependency injection
 */
export function salesRouter(executeSell: ExecuteSell): Router {
  const router = Router({ mergeParams: true });
  const controller = new SalesController(executeSell);

  router.post('/', (req, res, next) =>
    controller.createSell(req, res, next)
  );

  return router;
}
