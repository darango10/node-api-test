import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PortfolioRepositoryImpl } from '../../src/features/portfolio/infrastructure/repositories/portfolio.repository';
import { InsufficientSharesError } from '../../src/features/shared/domain/errors';

describe('PortfolioRepository Integration', () => {
  let mongoServer: MongoMemoryServer;
  let repository: PortfolioRepositoryImpl;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    repository = new PortfolioRepositoryImpl();
  });

  describe('getByUserId', () => {
    it('should return null when portfolio does not exist', async () => {
      const result = await repository.getByUserId('non-existent-user');
      expect(result).toBeNull();
    });

    it('should return portfolio when it exists', async () => {
      // Create a portfolio first
      await repository.upsertPosition('user-123', 'AAPL', 10);

      const result = await repository.getByUserId('user-123');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.positions).toHaveLength(1);
      expect(result?.positions[0].symbol).toBe('AAPL');
      expect(result?.positions[0].quantity).toBe(10);
    });

    it('should return portfolio with multiple positions', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 10);
      await repository.upsertPosition('user-123', 'GOOGL', 5);

      const result = await repository.getByUserId('user-123');

      expect(result?.positions).toHaveLength(2);
    });
  });

  describe('upsertPosition', () => {
    it('should create new portfolio when user has no portfolio', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 10);

      const result = await repository.getByUserId('user-123');

      expect(result).not.toBeNull();
      expect(result?.positions).toHaveLength(1);
      expect(result?.positions[0].symbol).toBe('AAPL');
      expect(result?.positions[0].quantity).toBe(10);
    });

    it('should add new position to existing portfolio', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 10);
      await repository.upsertPosition('user-123', 'GOOGL', 5);

      const result = await repository.getByUserId('user-123');

      expect(result?.positions).toHaveLength(2);
    });

    it('should increment quantity when position already exists', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 10);
      await repository.upsertPosition('user-123', 'AAPL', 5);

      const result = await repository.getByUserId('user-123');

      expect(result?.positions).toHaveLength(1);
      expect(result?.positions[0].quantity).toBe(15);
    });

    it('should handle concurrent updates atomically', async () => {
      // Simulate concurrent purchases
      const promises = [
        repository.upsertPosition('user-123', 'AAPL', 1),
        repository.upsertPosition('user-123', 'AAPL', 1),
        repository.upsertPosition('user-123', 'AAPL', 1),
        repository.upsertPosition('user-123', 'AAPL', 1),
        repository.upsertPosition('user-123', 'AAPL', 1),
      ];

      await Promise.all(promises);

      const result = await repository.getByUserId('user-123');

      // Should have exactly 5 shares, not lost updates
      expect(result?.positions[0].quantity).toBe(5);
    });

    it('should update updatedAt timestamp on upsert', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 10);
      const first = await repository.getByUserId('user-123');

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await repository.upsertPosition('user-123', 'AAPL', 5);
      const second = await repository.getByUserId('user-123');

      expect(second?.updatedAt.getTime()).toBeGreaterThan(first?.updatedAt.getTime() || 0);
    });

    it('should throw error when quantityDelta is negative', async () => {
      await expect(repository.upsertPosition('user-123', 'AAPL', -5)).rejects.toThrow(
        'Quantity delta must be positive'
      );
    });

    it('should throw error when symbol is empty', async () => {
      await expect(repository.upsertPosition('user-123', '', 10)).rejects.toThrow(
        'Symbol cannot be empty'
      );
    });

    it('should throw error when userId is empty', async () => {
      await expect(repository.upsertPosition('', 'AAPL', 10)).rejects.toThrow(
        'UserId cannot be empty'
      );
    });
  });

  describe('reducePosition', () => {
    it('should throw InsufficientSharesError with currentHeldQuantity 0 when user has no position', async () => {
      await expect(repository.reducePosition('user-no-portfolio', 'AAPL', 10)).rejects.toThrow(
        InsufficientSharesError
      );

      try {
        await repository.reducePosition('user-no-portfolio', 'AAPL', 10);
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientSharesError);
        expect((err as InsufficientSharesError).currentHeldQuantity).toBe(0);
      }
    });

    it('should throw InsufficientSharesError with currentHeldQuantity when user holds fewer than requested', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 30);

      await expect(repository.reducePosition('user-123', 'AAPL', 50)).rejects.toThrow(
        InsufficientSharesError
      );

      try {
        await repository.reducePosition('user-123', 'AAPL', 50);
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientSharesError);
        expect((err as InsufficientSharesError).currentHeldQuantity).toBe(30);
      }
    });

    it('should atomically reduce position by quantity on success', async () => {
      await repository.upsertPosition('user-123', 'AAPL', 100);
      await repository.reducePosition('user-123', 'AAPL', 40);

      const portfolio = await repository.getByUserId('user-123');
      expect(portfolio?.findPosition('AAPL')?.quantity).toBe(60);
    });

    it('should remove position when selling full quantity', async () => {
      await repository.upsertPosition('user-123', 'MSFT', 20);
      await repository.reducePosition('user-123', 'MSFT', 20);

      const portfolio = await repository.getByUserId('user-123');
      const pos = portfolio?.findPosition('MSFT');
      expect(pos === undefined || pos.quantity === 0).toBe(true);
    });
  });
});
