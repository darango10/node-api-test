import { Transaction } from '../../domain/entities/transaction';

/**
 * Port for transaction persistence
 */
export interface TransactionRepositoryPort {
  /**
   * Save a transaction record
   * @param transaction - Transaction to save
   */
  save(transaction: Transaction): Promise<void>;

  /**
   * Find transactions created since a given date
   * @param sinceDate - Find transactions created on or after this date
   * @returns List of transactions sorted by createdAt ascending
   */
  findSince(sinceDate: Date): Promise<Transaction[]>;
}
