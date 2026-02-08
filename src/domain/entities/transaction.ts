import { ValidationError } from '../errors';

/**
 * Transaction outcome enum
 */
export enum TransactionOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

/**
 * Transaction entity representing a purchase attempt
 * Immutable record of each transaction (success or failure)
 */
export class Transaction {
  public readonly userId: string;
  public readonly symbol: string;
  public readonly quantity: number;
  public readonly price: number;
  public readonly outcome: TransactionOutcome;
  public readonly reason?: string;
  public readonly createdAt: Date;

  constructor(
    userId: string,
    symbol: string,
    quantity: number,
    price: number,
    outcome: TransactionOutcome,
    reason?: string,
    createdAt?: Date
  ) {
    // Validate userId
    if (!userId || userId.trim() === '') {
      throw new ValidationError('UserId cannot be empty');
    }

    // Validate symbol
    if (!symbol || symbol.trim() === '') {
      throw new ValidationError('Symbol cannot be empty');
    }

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }

    // Validate price
    if (price <= 0) {
      throw new ValidationError('Price must be positive');
    }

    this.userId = userId;
    this.symbol = symbol;
    this.quantity = quantity;
    this.price = price;
    this.outcome = outcome;
    this.reason = reason;
    this.createdAt = createdAt || new Date();

    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Convert transaction to plain JSON object
   */
  toJSON(): {
    userId: string;
    symbol: string;
    quantity: number;
    price: number;
    outcome: string;
    reason?: string;
    createdAt: Date;
  } {
    return {
      userId: this.userId,
      symbol: this.symbol,
      quantity: this.quantity,
      price: this.price,
      outcome: this.outcome,
      reason: this.reason,
      createdAt: this.createdAt,
    };
  }
}
