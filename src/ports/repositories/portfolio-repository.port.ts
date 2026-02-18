import { Portfolio } from '../../domain/entities/portfolio';

/**
 * Port for portfolio persistence
 */
export interface PortfolioRepositoryPort {
  getByUserId(userId: string): Promise<Portfolio | null>;

  upsertPosition(
    userId: string,
    symbol: string,
    quantityDelta: number
  ): Promise<void>;

  /**
   * Atomically reduce the position for (userId, symbol) by quantity.
   * @throws InsufficientSharesError when user has no position or holds fewer than quantity (error includes currentHeldQuantity)
   */
  reducePosition(
    userId: string,
    symbol: string,
    quantity: number
  ): Promise<void>;
}
