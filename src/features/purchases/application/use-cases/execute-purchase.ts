import { StockVendorPort } from '../../../stocks/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../../portfolio/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../../shared/ports/repositories/transaction-repository.port';
import type {
  EventPublisherPort,
  PurchaseCompletedPayload,
} from '../../../shared/ports/event-publisher.port';
import { Transaction, TransactionOutcome } from '../../../shared/domain/entities/transaction';
import { ValidationError } from '../../../shared/domain/errors';
import { isWithinTolerance } from '../../../shared/domain/services/price-tolerance';
import { logger } from '../../../shared/infrastructure/config/logger';

/**
 * Request to execute a stock purchase
 */
export interface ExecutePurchaseRequest {
  userId: string;
  symbol: string;
  quantity: number;
  price: number;
}

/**
 * Result of purchase execution
 */
export interface ExecutePurchaseResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

/**
 * Use case for executing a stock purchase
 *
 * Flow:
 * 1. Validate inputs
 * 2. Get current price from vendor
 * 3. Check if requested price is within tolerance (2%)
 * 4. If within tolerance:
 *    - Save successful transaction
 *    - Update portfolio
 *    - Return success
 * 5. If not within tolerance or vendor error:
 *    - Save failed transaction with reason
 *    - Return failure
 */
export class ExecutePurchase {
  private readonly PRICE_TOLERANCE = 0.02; // 2%

  constructor(
    private readonly stockVendorPort: StockVendorPort,
    private readonly portfolioRepository: PortfolioRepositoryPort,
    private readonly transactionRepository: TransactionRepositoryPort,
    private readonly eventPublisher?: EventPublisherPort
  ) {}

  async execute(request: ExecutePurchaseRequest): Promise<ExecutePurchaseResult> {
    const { userId, symbol, quantity, price } = request;

    // Validate inputs
    this.validateRequest(request);

    try {
      // Get current price from vendor
      logger.info(
        { userId, symbol, quantity, requestedPrice: price },
        'Executing purchase: fetching current price'
      );

      const currentPrice = await this.stockVendorPort.getCurrentPrice(symbol);

      logger.info(
        { symbol, currentPrice, requestedPrice: price },
        'Current price fetched from vendor'
      );

      // Check if price is within tolerance
      const withinTolerance = isWithinTolerance(price, currentPrice, this.PRICE_TOLERANCE);

      if (!withinTolerance) {
        // Price out of tolerance - record failure
        const reason = `Price out of tolerance. Requested: ${price}, Current: ${currentPrice}, Tolerance: ±${this.PRICE_TOLERANCE * 100}%`;

        logger.warn(
          { userId, symbol, requestedPrice: price, currentPrice, reason },
          'Purchase failed: price out of tolerance'
        );

        const transaction = new Transaction(
          userId,
          symbol,
          quantity,
          price,
          TransactionOutcome.FAILURE,
          reason
        );

        // Record the failed transaction (don't throw if this fails)
        await this.saveTransactionSafely(transaction);

        return {
          success: false,
          transaction,
          error: reason,
        };
      }

      // Price is within tolerance - execute purchase with vendor
      logger.info(
        { userId, symbol, quantity, price },
        'Price within tolerance, executing purchase with vendor'
      );

      // Execute buy order with vendor
      const buyResult = await this.stockVendorPort.executeBuy({
        symbol,
        quantity,
        price,
      });

      if (!buyResult.success) {
        // Vendor rejected the purchase
        const reason = buyResult.message || 'Vendor rejected purchase';

        logger.warn(
          { userId, symbol, quantity, price, reason },
          'Purchase failed: vendor rejected'
        );

        const transaction = new Transaction(
          userId,
          symbol,
          quantity,
          price,
          TransactionOutcome.FAILURE,
          reason
        );

        await this.saveTransactionSafely(transaction);

        return {
          success: false,
          transaction,
          error: reason,
        };
      }

      // Vendor accepted the purchase - create successful transaction
      logger.info(
        { userId, symbol, quantity, price, total: buyResult.order?.total },
        'Purchase executed successfully with vendor'
      );

      const transaction = new Transaction(
        userId,
        symbol,
        quantity,
        price,
        TransactionOutcome.SUCCESS
      );

      // Update portfolio (this should be atomic)
      await this.portfolioRepository.upsertPosition(userId, symbol, quantity);

      logger.info({ userId, symbol, quantity }, 'Portfolio updated successfully');

      // Record the successful transaction (don't throw if this fails)
      await this.saveTransactionSafely(transaction);

      this.emitPurchaseCompletedIfPresent(transaction, buyResult.order?.total);

      return {
        success: true,
        transaction,
      };
    } catch (error: unknown) {
      // Handle vendor or other errors
      const err = error as Error;
      const reason = err.message || 'Unknown error occurred';

      logger.error(
        { error: err.message, userId, symbol, quantity, price },
        'Purchase failed due to error'
      );

      // Record the failed transaction
      const transaction = new Transaction(
        userId,
        symbol,
        quantity,
        price,
        TransactionOutcome.FAILURE,
        reason
      );

      await this.saveTransactionSafely(transaction);

      return {
        success: false,
        transaction,
        error: reason,
      };
    }
  }

  /**
   * Validate purchase request
   * @throws ValidationError if validation fails
   */
  private validateRequest(request: ExecutePurchaseRequest): void {
    const { userId, symbol, quantity, price } = request;

    if (!userId || userId.trim() === '') {
      throw new ValidationError('UserId cannot be empty');
    }

    if (!symbol || symbol.trim() === '') {
      throw new ValidationError('Symbol cannot be empty');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }

    if (price <= 0) {
      throw new ValidationError('Price must be positive');
    }
  }

  /**
   * Emit purchase_completed event if EventPublisherPort is provided (best-effort, fire-and-forget).
   */
  private emitPurchaseCompletedIfPresent(transaction: Transaction, total?: number): void {
    if (!this.eventPublisher) return;
    const payload: PurchaseCompletedPayload = {
      type: 'purchase_completed',
      userId: transaction.userId,
      symbol: transaction.symbol,
      quantity: transaction.quantity,
      success: true,
      price: transaction.price,
      total: total ?? transaction.quantity * transaction.price,
      timestamp: new Date().toISOString(),
    };
    try {
      const result = this.eventPublisher.publishPurchaseCompleted(payload);
      if (result instanceof Promise) result.catch(() => {});
    } catch {
      // Best-effort: do not fail the purchase
    }
  }

  /**
   * Save transaction without throwing if it fails
   * Logs error but doesn't propagate it
   */
  private async saveTransactionSafely(transaction: Transaction): Promise<void> {
    try {
      await this.transactionRepository.save(transaction);
      logger.info(
        {
          userId: transaction.userId,
          symbol: transaction.symbol,
          outcome: transaction.outcome,
        },
        'Transaction recorded'
      );
    } catch (error) {
      const err = error as Error;
      logger.error(
        { error: err.message, transaction: transaction.toJSON() },
        'Failed to save transaction (continuing anyway)'
      );
      // Don't throw - transaction recording failure shouldn't block the purchase
    }
  }
}
