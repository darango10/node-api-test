/**
 * Port for portfolio persistence
 */

export interface Position {
  symbol: string;
  quantity: number;
}

export interface Portfolio {
  userId: string;
  positions: Position[];
  updatedAt: Date;
}

export interface PortfolioRepositoryPort {
  getByUserId(userId: string): Promise<Portfolio | null>;

  upsertPosition(
    userId: string,
    symbol: string,
    quantityDelta: number
  ): Promise<void>;
}
