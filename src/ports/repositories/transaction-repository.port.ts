/**
 * Port for transaction persistence
 */

export interface Transaction {
  userId: string;
  symbol: string;
  quantity: number;
  price: number;
  outcome: 'success' | 'failure';
  reason?: string;
  createdAt: Date;
  vendorTxId?: string;
}

export interface TransactionRepositoryPort {
  save(transaction: Omit<Transaction, 'createdAt'>): Promise<Transaction>;

  findSince(sinceDate: Date): Promise<Transaction[]>;
}
