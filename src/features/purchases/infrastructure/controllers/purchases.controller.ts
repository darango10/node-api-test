import { Request, Response, NextFunction } from 'express';
import { ExecutePurchase } from '../../application/use-cases/execute-purchase';
import { ValidationError } from '../../../shared/domain/errors';
import { logger } from '../../../shared/infrastructure/config/logger';

/**
 * Controller for purchase operations
 */
export class PurchasesController {
  constructor(private readonly executePurchase: ExecutePurchase) {}

  /**
   * Handle POST /users/:userId/purchases
   * Execute a stock purchase
   */
  async createPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { symbol, quantity, price } = req.body;

      // Validate required fields
      if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Symbol is required and must be a non-empty string',
        });
        return;
      }

      if (quantity === undefined || quantity === null) {
        res.status(400).json({
          success: false,
          error: 'Quantity is required',
        });
        return;
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        res.status(400).json({
          success: false,
          error: 'Quantity must be a positive integer',
        });
        return;
      }

      if (price === undefined || price === null) {
        res.status(400).json({
          success: false,
          error: 'Price is required',
        });
        return;
      }

      if (typeof price !== 'number' || price <= 0) {
        res.status(400).json({
          success: false,
          error: 'Price must be a positive number',
        });
        return;
      }

      // Validate userId from path
      if (!userId || userId.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'UserId is required',
        });
        return;
      }

      logger.info({ userId, symbol, quantity, price }, 'Purchase request received');

      // Execute purchase
      const result = await this.executePurchase.execute({
        userId,
        symbol,
        quantity,
        price,
      });

      if (result.success) {
        // Successful purchase
        res.status(201).json({
          success: true,
          message: 'Purchase executed successfully',
          transaction: result.transaction?.toJSON(),
        });
      } else {
        // Failed purchase - determine appropriate status code
        const statusCode = this.getErrorStatusCode(result.error || '');

        res.status(statusCode).json({
          success: false,
          error: result.error,
          transaction: result.transaction?.toJSON(),
        });
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      // Pass other errors to error handler middleware
      next(error);
    }
  }

  /**
   * Determine HTTP status code based on error message
   */
  private getErrorStatusCode(errorMessage: string): number {
    const lowerError = errorMessage.toLowerCase();

    // Price out of tolerance
    if (lowerError.includes('price out of tolerance')) {
      return 400;
    }

    // Stock not found
    if (lowerError.includes('not found')) {
      return 404;
    }

    // Vendor authentication failed
    if (lowerError.includes('authentication') || lowerError.includes('api key')) {
      return 502; // Bad Gateway - upstream authentication issue
    }

    // Vendor unavailable or timeout
    if (
      lowerError.includes('unavailable') ||
      lowerError.includes('timeout') ||
      lowerError.includes('vendor')
    ) {
      return 502;
    }

    // Default to 400 for other errors
    return 400;
  }
}
