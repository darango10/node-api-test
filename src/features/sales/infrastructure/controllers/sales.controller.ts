import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExecuteSell } from '../../application/use-cases/execute-sell';
import { ExecuteSellResult } from '../../application/use-cases/execute-sell';
import { ValidationError, InsufficientSharesError } from '../../../shared/domain/errors';
import { logger } from '../../../shared/infrastructure/config/logger';

const sellRequestBodySchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').trim(),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be a positive integer'),
});

/**
 * Controller for sell operations
 */
export class SalesController {
  constructor(private readonly executeSell: ExecuteSell) {}

  /**
   * Handle POST /users/:userId/sales
   */
  async createSell(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validationError = this.validateSellRequest(req);
      if (validationError) {
        res.status(400).json({ success: false, error: validationError });
        return;
      }

      const { userId } = req.params;
      const { symbol, quantity } = (
        req as Request & { validatedSellBody?: { symbol: string; quantity: number } }
      ).validatedSellBody!;

      logger.info({ userId, symbol, quantity }, 'Sell request received');

      const result = await this.executeSell.execute({
        userId,
        symbol,
        quantity,
      });

      if (result.success && result.transaction) {
        res.status(201).json({
          success: true,
          message: 'Sell executed successfully',
          transaction: result.transaction.toJSON(),
        });
        return;
      }

      const statusCode = this.getStatusForSellError(result);
      const body = this.buildSellErrorBody(result);
      res.status(statusCode).json(body);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }
      if (error instanceof InsufficientSharesError) {
        res.status(400).json({
          success: false,
          error: error.message,
          code: 'INSUFFICIENT_SHARES',
          currentHeldQuantity: error.currentHeldQuantity,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Validates path (userId) and body with Zod schema. Returns error message or null if valid.
   * Parsed body is attached to req as req.validatedSellBody.
   */
  private validateSellRequest(req: Request): string | null {
    const { userId } = req.params;
    if (!userId || userId.trim() === '') {
      return 'UserId is required';
    }

    const parsed = sellRequestBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = first.symbol?.[0] ?? first.quantity?.[0] ?? 'Invalid request body';
      return msg;
    }
    (
      req as Request & { validatedSellBody?: z.infer<typeof sellRequestBodySchema> }
    ).validatedSellBody = parsed.data;
    return null;
  }

  private getStatusForSellError(result: ExecuteSellResult): number {
    const msg = (result.error ?? '').toLowerCase();
    return msg.includes('unavailable') ? 502 : 400;
  }

  private buildSellErrorBody(result: ExecuteSellResult): {
    success: boolean;
    error: string;
    currentHeldQuantity?: number;
    code?: string;
  } {
    const body: {
      success: boolean;
      error: string;
      currentHeldQuantity?: number;
      code?: string;
    } = {
      success: false,
      error: result.error ?? 'Sell failed',
    };
    if (result.currentHeldQuantity !== undefined) {
      body.currentHeldQuantity = result.currentHeldQuantity;
      body.code = 'INSUFFICIENT_SHARES';
    }
    return body;
  }
}
