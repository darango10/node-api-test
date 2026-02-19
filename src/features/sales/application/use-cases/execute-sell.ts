import { StockVendorPort } from '../../../stocks/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../../portfolio/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../../shared/ports/repositories/transaction-repository.port';
import { Transaction, TransactionOutcome } from '../../../shared/domain/entities/transaction';
import { ValidationError, InsufficientSharesError } from '../../../shared/domain/errors';
import { logger } from '../../../shared/infrastructure/config/logger';

export interface ExecuteSellRequest {
  userId: string;
  symbol: string;
  quantity: number;
}

export interface ExecuteSellResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
  currentHeldQuantity?: number;
}

/**
 * Use case: execute a market sell order.
 * Validates position, gets current price from vendor, reduces portfolio locally, records transaction.
 */
export class ExecuteSell {
  constructor(
    private readonly stockVendorPort: StockVendorPort,
    private readonly portfolioRepository: PortfolioRepositoryPort,
    private readonly transactionRepository: TransactionRepositoryPort
  ) {}

  async execute(request: ExecuteSellRequest): Promise<ExecuteSellResult> {
    const { userId, symbol, quantity } = request;

    this.validateRequest(request);

    try {
      const insufficient = await this.checkInsufficientShares(userId, symbol, quantity);
      if (insufficient !== null) {
        await this.recordFailedSell(userId, symbol, quantity, insufficient.reason);
        return {
          success: false,
          error: insufficient.reason,
          currentHeldQuantity: insufficient.currentHeld,
        };
      }

      const currentPrice = await this.stockVendorPort.getCurrentPrice(symbol);
      await this.portfolioRepository.reducePosition(userId, symbol, quantity);

      const transaction = new Transaction(
        userId,
        symbol,
        quantity,
        currentPrice,
        TransactionOutcome.SUCCESS,
        undefined,
        undefined,
        'sell'
      );
      await this.saveTransactionSafely(transaction);

      return { success: true, transaction };
    } catch (err) {
      return this.handleSellError(err, userId, symbol, quantity);
    }
  }

  /**
   * Returns { reason, currentHeld } if user has insufficient shares; null otherwise.
   */
  private async checkInsufficientShares(
    userId: string,
    symbol: string,
    quantity: number
  ): Promise<{ reason: string; currentHeld: number } | null> {
    const portfolio = await this.portfolioRepository.getByUserId(userId);
    const position = portfolio?.findPosition(symbol);
    const currentHeld = position?.quantity ?? 0;

    if (currentHeld < quantity) {
      return {
        reason: `Insufficient shares: you have ${currentHeld}, requested ${quantity}`,
        currentHeld,
      };
    }
    return null;
  }

  private async recordFailedSell(
    userId: string,
    symbol: string,
    quantity: number,
    reason: string
  ): Promise<void> {
    const transaction = new Transaction(
      userId,
      symbol,
      quantity,
      1,
      TransactionOutcome.FAILURE,
      reason,
      undefined,
      'sell'
    );
    await this.saveTransactionSafely(transaction);
  }

  private handleSellError(
    err: unknown,
    userId: string,
    symbol: string,
    quantity: number
  ): Promise<ExecuteSellResult> {
    if (err instanceof InsufficientSharesError) {
      return this.recordFailedSell(userId, symbol, quantity, err.message).then(() => ({
        success: false,
        error: err.message,
        currentHeldQuantity: err.currentHeldQuantity,
      }));
    }

    const reason = err instanceof Error ? err.message : 'Market unavailable';
    logger.error({ userId, symbol, quantity, error: reason }, 'Sell failed');
    return this.recordFailedSell(userId, symbol, quantity, reason).then(() => ({
      success: false,
      error: reason,
    }));
  }

  private validateRequest(request: ExecuteSellRequest): void {
    const { userId, symbol, quantity } = request;

    if (!userId || userId.trim() === '') {
      throw new ValidationError('UserId cannot be empty');
    }
    if (!symbol || symbol.trim() === '') {
      throw new ValidationError('Symbol cannot be empty');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }
  }

  private async saveTransactionSafely(transaction: Transaction): Promise<void> {
    try {
      await this.transactionRepository.save(transaction);
    } catch (error) {
      logger.error(
        { error: (error as Error).message, transaction: transaction.toJSON() },
        'Failed to save sell transaction'
      );
    }
  }
}
