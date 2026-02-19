import { Transaction, TransactionOutcome } from '../../domain/entities/transaction';
import { TransactionRepositoryPort } from '../../ports/repositories/transaction-repository.port';
import { TransactionModel } from './transaction.model';
import { logger } from '../config/logger';

/**
 * MongoDB implementation of TransactionRepository using Mongoose
 */
export class TransactionRepositoryImpl implements TransactionRepositoryPort {
  /**
   * Save a transaction to the database
   */
  async save(transaction: Transaction): Promise<void> {
    try {
      await TransactionModel.create({
        userId: transaction.userId,
        symbol: transaction.symbol,
        quantity: transaction.quantity,
        price: transaction.price,
        outcome: transaction.outcome,
        reason: transaction.reason,
        createdAt: transaction.createdAt,
      });

      logger.debug(
        {
          userId: transaction.userId,
          symbol: transaction.symbol,
          outcome: transaction.outcome,
        },
        'Transaction saved to database'
      );
    } catch (error) {
      const err = error as Error;
      logger.error(
        { error: err.message, transaction: transaction.toJSON() },
        'Failed to save transaction to database'
      );
      throw new Error(`Failed to save transaction: ${err.message}`);
    }
  }

  /**
   * Find all transactions created since a given date
   * Returns transactions sorted by createdAt ascending
   */
  async findSince(sinceDate: Date): Promise<Transaction[]> {
    try {
      const documents = await TransactionModel.find({
        createdAt: { $gte: sinceDate },
      })
        .sort({ createdAt: 1 }) // Ascending order
        .lean();

      logger.debug({ sinceDate, count: documents.length }, 'Transactions retrieved from database');

      // Map documents to domain entities
      return documents.map(
        (doc) =>
          new Transaction(
            doc.userId,
            doc.symbol,
            doc.quantity,
            doc.price,
            doc.outcome as TransactionOutcome,
            doc.reason,
            doc.createdAt
          )
      );
    } catch (error) {
      const err = error as Error;
      logger.error(
        { error: err.message, sinceDate },
        'Failed to retrieve transactions from database'
      );
      throw new Error(`Failed to retrieve transactions: ${err.message}`);
    }
  }
}
