import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TransactionRepositoryImpl } from '../../src/features/shared/infrastructure/repositories/transaction.repository';
import {
  Transaction,
  TransactionOutcome,
} from '../../src/features/shared/domain/entities/transaction';
import { TransactionModel } from '../../src/features/shared/infrastructure/repositories/transaction.model';

describe('TransactionRepository Integration', () => {
  let mongoServer: MongoMemoryServer;
  let repository: TransactionRepositoryImpl;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    repository = new TransactionRepositoryImpl();
    await TransactionModel.deleteMany({});
  });

  describe('save', () => {
    it('should save a successful transaction to database', async () => {
      const transaction = new Transaction('user123', 'AAPL', 10, 150.5, TransactionOutcome.SUCCESS);

      await repository.save(transaction);

      const saved = await TransactionModel.findOne({ userId: 'user123' });
      expect(saved).toBeDefined();
      expect(saved?.userId).toBe('user123');
      expect(saved?.symbol).toBe('AAPL');
      expect(saved?.quantity).toBe(10);
      expect(saved?.price).toBe(150.5);
      expect(saved?.outcome).toBe('success');
      expect(saved?.reason).toBeUndefined();
      expect(saved?.createdAt).toBeInstanceOf(Date);
    });

    it('should save a failed transaction with reason', async () => {
      const transaction = new Transaction(
        'user456',
        'GOOGL',
        5,
        2800.0,
        TransactionOutcome.FAILURE,
        'Price out of tolerance'
      );

      await repository.save(transaction);

      const saved = await TransactionModel.findOne({ userId: 'user456' });
      expect(saved).toBeDefined();
      expect(saved?.outcome).toBe('failure');
      expect(saved?.reason).toBe('Price out of tolerance');
    });

    it('should save multiple transactions for the same user', async () => {
      const transaction1 = new Transaction(
        'user123',
        'AAPL',
        10,
        150.0,
        TransactionOutcome.SUCCESS
      );

      const transaction2 = new Transaction(
        'user123',
        'GOOGL',
        5,
        2800.0,
        TransactionOutcome.SUCCESS
      );

      await repository.save(transaction1);
      await repository.save(transaction2);

      const count = await TransactionModel.countDocuments({ userId: 'user123' });
      expect(count).toBe(2);
    });

    it('should handle concurrent saves', async () => {
      const transactions = Array.from(
        { length: 10 },
        (_, i) => new Transaction('user123', 'AAPL', i + 1, 150.0 + i, TransactionOutcome.SUCCESS)
      );

      await Promise.all(transactions.map((t) => repository.save(t)));

      const count = await TransactionModel.countDocuments({ userId: 'user123' });
      expect(count).toBe(10);
    });
  });

  describe('findSince', () => {
    beforeEach(async () => {
      // Create test data with specific timestamps
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      await TransactionModel.create([
        {
          userId: 'user1',
          symbol: 'AAPL',
          quantity: 10,
          price: 150,
          outcome: 'success',
          createdAt: threeDaysAgo,
        },
        {
          userId: 'user2',
          symbol: 'GOOGL',
          quantity: 5,
          price: 2800,
          outcome: 'success',
          createdAt: twoDaysAgo,
        },
        {
          userId: 'user3',
          symbol: 'MSFT',
          quantity: 20,
          price: 300,
          outcome: 'failure',
          reason: 'Price out of tolerance',
          createdAt: oneDayAgo,
        },
        {
          userId: 'user4',
          symbol: 'TSLA',
          quantity: 3,
          price: 200,
          outcome: 'success',
          createdAt: now,
        },
      ]);
    });

    it('should return transactions since the given date', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const transactions = await repository.findSince(twoDaysAgo);

      // Should return transactions from 2 days ago, 1 day ago, and now (3 total)
      expect(transactions.length).toBeGreaterThanOrEqual(2);
      expect(transactions.every((t) => t.createdAt >= twoDaysAgo)).toBe(true);
    });

    it('should return all transactions when since date is very old', async () => {
      const veryOld = new Date('2020-01-01');
      const transactions = await repository.findSince(veryOld);

      expect(transactions.length).toBe(4);
    });

    it('should return empty array when no transactions match', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const transactions = await repository.findSince(future);

      expect(transactions).toEqual([]);
    });

    it('should return transactions sorted by createdAt ascending', async () => {
      const veryOld = new Date('2020-01-01');
      const transactions = await repository.findSince(veryOld);

      for (let i = 1; i < transactions.length; i++) {
        expect(transactions[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          transactions[i - 1].createdAt.getTime()
        );
      }
    });

    it('should include both success and failure outcomes', async () => {
      const veryOld = new Date('2020-01-01');
      const transactions = await repository.findSince(veryOld);

      const hasSuccess = transactions.some((t) => t.outcome === TransactionOutcome.SUCCESS);
      const hasFailure = transactions.some((t) => t.outcome === TransactionOutcome.FAILURE);

      expect(hasSuccess).toBe(true);
      expect(hasFailure).toBe(true);
    });

    it('should map database documents to Transaction entities correctly', async () => {
      const veryOld = new Date('2020-01-01');
      const transactions = await repository.findSince(veryOld);

      transactions.forEach((t) => {
        expect(t).toBeInstanceOf(Transaction);
        expect(t.userId).toBeDefined();
        expect(t.symbol).toBeDefined();
        expect(t.quantity).toBeGreaterThan(0);
        expect(t.price).toBeGreaterThan(0);
        expect([TransactionOutcome.SUCCESS, TransactionOutcome.FAILURE]).toContain(t.outcome);
        expect(t.createdAt).toBeInstanceOf(Date);
      });
    });

    it('should handle exact timestamp boundary', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create a transaction exactly at the boundary
      const boundaryTransaction = new Transaction(
        'boundary-user',
        'AAPL',
        1,
        100,
        TransactionOutcome.SUCCESS
      );

      // Manually set createdAt to test boundary
      await TransactionModel.create({
        ...boundaryTransaction.toJSON(),
        createdAt: oneDayAgo,
      });

      const transactions = await repository.findSince(oneDayAgo);
      const foundBoundary = transactions.find((t) => t.userId === 'boundary-user');

      expect(foundBoundary).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid transaction data gracefully', async () => {
      // This tests MongoDB validation, not domain validation
      const invalidDoc = {
        userId: 'test',
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        outcome: 'invalid-outcome', // Invalid enum value
      };

      await expect(TransactionModel.create(invalidDoc)).rejects.toThrow();
    });
  });

  describe('performance', () => {
    it('should handle large batch of transactions efficiently', async () => {
      const batchSize = 1000;
      const transactions = Array.from(
        { length: batchSize },
        (_, i) =>
          new Transaction(
            `user${i}`,
            'AAPL',
            10,
            150.0,
            i % 2 === 0 ? TransactionOutcome.SUCCESS : TransactionOutcome.FAILURE,
            i % 2 === 0 ? undefined : 'Test failure'
          )
      );

      const startTime = Date.now();
      await Promise.all(transactions.map((t) => repository.save(t)));
      const endTime = Date.now();

      const count = await TransactionModel.countDocuments({});
      expect(count).toBe(batchSize);

      // Should complete within reasonable time (10 seconds for 1000 records)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('should query efficiently with index on createdAt', async () => {
      // Create 100 transactions spread over time
      const transactions = Array.from(
        { length: 100 },
        (_, i) => new Transaction(`user${i}`, 'AAPL', 10, 150.0, TransactionOutcome.SUCCESS)
      );

      await Promise.all(transactions.map((t) => repository.save(t)));

      // Query should be fast with index
      const startTime = Date.now();
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await repository.findSince(twoDaysAgo);
      const endTime = Date.now();

      // Should complete quickly (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
