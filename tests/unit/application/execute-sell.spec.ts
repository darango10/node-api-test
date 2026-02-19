import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteSell } from '../../../src/features/sales/application/use-cases/execute-sell';
import { StockVendorPort } from '../../../src/features/stocks/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../../src/features/portfolio/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../../src/features/shared/ports/repositories/transaction-repository.port';
import {
  ValidationError,
  InsufficientSharesError,
} from '../../../src/features/shared/domain/errors';
import { TransactionOutcome } from '../../../src/features/shared/domain/entities/transaction';
import { Portfolio, Position } from '../../../src/features/portfolio/domain/entities/portfolio';

describe('ExecuteSell Use Case', () => {
  let executeSell: ExecuteSell;
  let mockStockVendorPort: StockVendorPort;
  let mockPortfolioRepository: PortfolioRepositoryPort;
  let mockTransactionRepository: TransactionRepositoryPort;

  beforeEach(() => {
    mockStockVendorPort = {
      listStocks: vi.fn(),
      getCurrentPrice: vi.fn(),
      executeBuy: vi.fn(),
    };

    mockPortfolioRepository = {
      getByUserId: vi.fn(),
      upsertPosition: vi.fn(),
      reducePosition: vi.fn(),
    };

    mockTransactionRepository = {
      save: vi.fn(),
      findSince: vi.fn(),
    };

    executeSell = new ExecuteSell(
      mockStockVendorPort,
      mockPortfolioRepository,
      mockTransactionRepository
    );
  });

  describe('successful sell', () => {
    it('should execute sell when user holds sufficient shares and market is available', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 10;
      const currentPrice = 150.0;
      const portfolio = new Portfolio(userId, [new Position(symbol, 20)]);

      vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(portfolio);
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(currentPrice);
      vi.mocked(mockPortfolioRepository.reducePosition).mockResolvedValue();
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executeSell.execute({ userId, symbol, quantity });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.outcome).toBe(TransactionOutcome.SUCCESS);
      expect(result.transaction?.userId).toBe(userId);
      expect(result.transaction?.symbol).toBe(symbol);
      expect(result.transaction?.quantity).toBe(quantity);
      expect(result.transaction?.price).toBe(currentPrice);
      expect(mockPortfolioRepository.reducePosition).toHaveBeenCalledWith(userId, symbol, quantity);
      expect(mockStockVendorPort.getCurrentPrice).toHaveBeenCalledWith(symbol);
    });
  });

  describe('insufficient shares', () => {
    it('should return failure with currentHeldQuantity when reducePosition throws InsufficientSharesError', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 50;
      const held = 30;
      const portfolio = new Portfolio(userId, [new Position(symbol, held)]);

      vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(portfolio);
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(100);
      vi.mocked(mockPortfolioRepository.reducePosition).mockRejectedValue(
        new InsufficientSharesError('Insufficient shares', held)
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executeSell.execute({ userId, symbol, quantity });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.currentHeldQuantity).toBe(held);
    });
  });

  describe('market unavailable', () => {
    it('should return failure when getCurrentPrice throws', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(
        new Error('Vendor unavailable')
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executeSell.execute({
        userId: 'user1',
        symbol: 'AAPL',
        quantity: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockPortfolioRepository.reducePosition).not.toHaveBeenCalled();
    });
  });

  describe('validation errors', () => {
    it('should throw ValidationError when userId is empty', async () => {
      await expect(
        executeSell.execute({ userId: '', symbol: 'AAPL', quantity: 10 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when symbol is empty', async () => {
      await expect(executeSell.execute({ userId: 'u1', symbol: '', quantity: 10 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when quantity is not a positive integer', async () => {
      await expect(
        executeSell.execute({ userId: 'u1', symbol: 'AAPL', quantity: 0 })
      ).rejects.toThrow(ValidationError);
      await expect(
        executeSell.execute({ userId: 'u1', symbol: 'AAPL', quantity: -1 })
      ).rejects.toThrow(ValidationError);
    });
  });
});
