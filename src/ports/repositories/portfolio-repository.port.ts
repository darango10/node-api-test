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
}
