import { ValidationError } from '../errors';

/**
 * Position represents a holding in a user's portfolio
 */
export class Position {
  constructor(
    public readonly symbol: string,
    public readonly quantity: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.symbol || this.symbol.trim() === '') {
      throw new ValidationError('Symbol cannot be empty');
    }

    if (this.quantity < 0) {
      throw new ValidationError('Quantity must be non-negative');
    }

    if (!Number.isInteger(this.quantity)) {
      throw new ValidationError('Quantity must be an integer');
    }
  }
}

/**
 * Portfolio represents a user's collection of stock positions
 */
export class Portfolio {
  public readonly updatedAt: Date;

  constructor(
    public readonly userId: string,
    public readonly positions: Position[],
    updatedAt?: Date
  ) {
    this.validate();
    this.updatedAt = updatedAt || new Date();
  }

  private validate(): void {
    if (!this.userId || this.userId.trim() === '') {
      throw new ValidationError('UserId cannot be empty');
    }

    if (!Array.isArray(this.positions)) {
      throw new ValidationError('Positions must be an array');
    }
  }

  /**
   * Get positions that have quantity > 0
   */
  getActivePositions(): Position[] {
    return this.positions.filter(p => p.quantity > 0);
  }

  /**
   * Find a position by symbol
   */
  findPosition(symbol: string): Position | undefined {
    return this.positions.find(p => p.symbol === symbol);
  }

  /**
   * Serializes portfolio to plain object for API response
   */
  toJSON(): { userId: string; positions: Array<{ symbol: string; quantity: number }> } {
    return {
      userId: this.userId,
      positions: this.getActivePositions().map(p => ({
        symbol: p.symbol,
        quantity: p.quantity
      }))
    };
  }
}
