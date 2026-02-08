import { Request, Response, NextFunction } from 'express';
import { ListStocks } from '../../../application/use-cases/list-stocks';
import { logger } from '../../config/logger';

/**
 * Controller for stock-related endpoints
 */
export class StocksController {
  constructor(private readonly listStocksUseCase: ListStocks) {}

  /**
   * Handle GET /stocks request
   * Returns paginated list of available stocks
   */
  async listStocks(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { nextToken, limit } = req.query;

      logger.info(
        { nextToken, limit },
        'Processing list stocks request'
      );

      const parsedLimit = limit 
        ? Math.min(Math.max(parseInt(limit as string, 10), 1), 100)
        : 20;

      const result = await this.listStocksUseCase.execute({
        nextToken: nextToken as string | undefined,
        limit: parsedLimit,
      });

      logger.info(
        { stockCount: result.stocks.length, hasNext: !!result.nextToken },
        'List stocks request successful'
      );

      res.status(200).json({
        stocks: result.stocks,
        nextToken: result.nextToken,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(
        { error: err.message },
        'List stocks request failed'
      );

      // Vendor errors should return 502 Bad Gateway
      if (
        err.message.includes('unavailable') ||
        err.message.includes('timeout')
      ) {
        res.status(502).json({
          error: 'Vendor service temporarily unavailable',
          code: 'VENDOR_UNAVAILABLE',
        });
        return;
      }

      // Pass other errors to centralized error handler
      next(error);
    }
  }
}
