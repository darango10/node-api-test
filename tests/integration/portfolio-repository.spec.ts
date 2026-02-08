import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PortfolioRepositoryImpl } from '../../src/infrastructure/persistence/portfolio.repository';

describe('PortfolioRepository Integration', () => {
  let mongoServer: MongoMemoryServer;
  let repository: PortfolioRepositoryImpl;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
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
        repository.upsertPosition('user-123', 'AAPL', 1)
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
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await repository.upsertPosition('user-123', 'AAPL', 5);
      const second = await repository.getByUserId('user-123');
      
      expect(second?.updatedAt.getTime()).toBeGreaterThan(first?.updatedAt.getTime() || 0);
    });

    it('should throw error when quantityDelta is negative', async () => {
      await expect(
        repository.upsertPosition('user-123', 'AAPL', -5)
      ).rejects.toThrow('Quantity delta must be positive');
    });

    it('should throw error when symbol is empty', async () => {
      await expect(
        repository.upsertPosition('user-123', '', 10)
      ).rejects.toThrow('Symbol cannot be empty');
    });

    it('should throw error when userId is empty', async () => {
      await expect(
        repository.upsertPosition('', 'AAPL', 10)
      ).rejects.toThrow('UserId cannot be empty');
    });
  });
});
