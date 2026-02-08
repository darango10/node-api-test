import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutePurchase } from '../../../src/application/use-cases/execute-purchase';
import { StockVendorPort } from '../../../src/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../../src/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../../src/ports/repositories/transaction-repository.port';
import { ValidationError } from '../../../src/domain/errors';
import { TransactionOutcome } from '../../../src/domain/entities/transaction';

describe('ExecutePurchase Use Case', () => {
  let executePurchase: ExecutePurchase;
  let mockStockVendorPort: StockVendorPort;
  let mockPortfolioRepository: PortfolioRepositoryPort;
  let mockTransactionRepository: TransactionRepositoryPort;

  beforeEach(() => {
    // Create mocks
    mockStockVendorPort = {
      listStocks: vi.fn(),
      getCurrentPrice: vi.fn(),
    };

    mockPortfolioRepository = {
      getByUserId: vi.fn(),
      upsertPosition: vi.fn(),
    };

    mockTransactionRepository = {
      save: vi.fn(),
      findSince: vi.fn(),
    };

    // Create use case instance
    executePurchase = new ExecutePurchase(
      mockStockVendorPort,
      mockPortfolioRepository,
      mockTransactionRepository
    );
  });

  describe('successful purchase', () => {
    it('should execute purchase when price is within tolerance', async () => {
      // Arrange
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 10;
      const requestedPrice = 150.00;
      const currentPrice = 151.00; // Within 2% (148.5 - 153)

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(currentPrice);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      // Act
      const result = await executePurchase.execute({
        userId,
        symbol,
        quantity,
        price: requestedPrice,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.outcome).toBe(TransactionOutcome.SUCCESS);
      expect(result.transaction?.userId).toBe(userId);
      expect(result.transaction?.symbol).toBe(symbol);
      expect(result.transaction?.quantity).toBe(quantity);
      expect(result.transaction?.price).toBe(requestedPrice);

      // Verify vendor was called
      expect(mockStockVendorPort.getCurrentPrice).toHaveBeenCalledWith(symbol);

      // Verify transaction was saved
      expect(mockTransactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          symbol,
          quantity,
          price: requestedPrice,
          outcome: TransactionOutcome.SUCCESS,
        })
      );

      // Verify portfolio was updated
      expect(mockPortfolioRepository.upsertPosition).toHaveBeenCalledWith(
        userId,
        symbol,
        quantity
      );
    });

    it('should execute purchase when price exactly matches current price', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 5;
      const price = 150.00;

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(price);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      const result = await executePurchase.execute({
        userId,
        symbol,
        quantity,
        price,
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.SUCCESS);
      expect(mockPortfolioRepository.upsertPosition).toHaveBeenCalled();
    });

    it('should execute purchase at upper 2% tolerance boundary', async () => {
      const currentPrice = 100.00;
      const requestedPrice = 102.00; // Exactly at 2% above

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(currentPrice);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: requestedPrice,
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.SUCCESS);
    });

    it('should execute purchase at lower 2% tolerance boundary', async () => {
      const currentPrice = 100.00;
      const requestedPrice = 98.00; // Exactly at 2% below

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(currentPrice);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: requestedPrice,
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.SUCCESS);
    });
  });

  describe('failed purchase - price out of tolerance', () => {
    it('should fail when requested price is more than 2% above current price', async () => {
      const currentPrice = 100.00;
      const requestedPrice = 103.00; // More than 2% above

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(currentPrice);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: requestedPrice,
      });

      expect(result.success).toBe(false);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.FAILURE);
      expect(result.transaction?.reason).toContain('Price out of tolerance');
      expect(result.error).toContain('Price out of tolerance');

      // Verify transaction was saved even though it failed
      expect(mockTransactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: TransactionOutcome.FAILURE,
          reason: expect.stringContaining('Price out of tolerance'),
        })
      );

      // Verify portfolio was NOT updated
      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });

    it('should fail when requested price is more than 2% below current price', async () => {
      const currentPrice = 100.00;
      const requestedPrice = 97.00; // More than 2% below

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(currentPrice);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: requestedPrice,
      });

      expect(result.success).toBe(false);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.FAILURE);
      expect(result.transaction?.reason).toContain('Price out of tolerance');
      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });
  });

  describe('failed purchase - vendor errors', () => {
    it('should fail when vendor is unavailable', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(
        new Error('Vendor service unavailable')
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00,
      });

      expect(result.success).toBe(false);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.FAILURE);
      expect(result.transaction?.reason).toContain('Vendor service unavailable');
      expect(result.error).toContain('Vendor service unavailable');

      // Verify transaction was saved with failure
      expect(mockTransactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: TransactionOutcome.FAILURE,
          reason: expect.stringContaining('Vendor service unavailable'),
        })
      );

      // Verify portfolio was NOT updated
      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });

    it('should fail when stock symbol is not found', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(
        new Error('Stock symbol XYZ not found')
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'XYZ',
        quantity: 10,
        price: 150.00,
      });

      expect(result.success).toBe(false);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.FAILURE);
      expect(result.transaction?.reason).toContain('not found');
      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });

    it('should fail when vendor times out', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(
        new Error('Vendor request timeout')
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00,
      });

      expect(result.success).toBe(false);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.FAILURE);
      expect(result.transaction?.reason).toContain('timeout');
      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('should throw ValidationError when userId is empty', async () => {
      await expect(
        executePurchase.execute({
          userId: '',
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when symbol is empty', async () => {
      await expect(
        executePurchase.execute({
          userId: 'user123',
          symbol: '',
          quantity: 10,
          price: 150.00,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when quantity is not positive', async () => {
      await expect(
        executePurchase.execute({
          userId: 'user123',
          symbol: 'AAPL',
          quantity: 0,
          price: 150.00,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        executePurchase.execute({
          userId: 'user123',
          symbol: 'AAPL',
          quantity: -5,
          price: 150.00,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when quantity is not an integer', async () => {
      await expect(
        executePurchase.execute({
          userId: 'user123',
          symbol: 'AAPL',
          quantity: 10.5,
          price: 150.00,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when price is not positive', async () => {
      await expect(
        executePurchase.execute({
          userId: 'user123',
          symbol: 'AAPL',
          quantity: 10,
          price: 0,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        executePurchase.execute({
          userId: 'user123',
          symbol: 'AAPL',
          quantity: 10,
          price: -150,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('transaction recording', () => {
    it('should always record transaction regardless of outcome', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(100.00);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      // Success case
      await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 100.00,
      });

      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(1);

      // Failure case
      await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00, // Out of tolerance
      });

      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should continue even if transaction save fails', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(150.00);
      vi.mocked(mockTransactionRepository.save).mockRejectedValue(
        new Error('Database error')
      );
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      // Should not throw, but log the error
      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00,
      });

      // Purchase should still succeed even if transaction recording failed
      expect(result.success).toBe(true);
      expect(mockPortfolioRepository.upsertPosition).toHaveBeenCalled();
    });
  });

  describe('atomicity', () => {
    it('should not update portfolio if price is out of tolerance', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(100.00);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00, // Out of tolerance
      });

      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });

    it('should not update portfolio if vendor fails', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(
        new Error('Vendor unavailable')
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00,
      });

      expect(mockPortfolioRepository.upsertPosition).not.toHaveBeenCalled();
    });

    it('should rollback if portfolio update fails', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(150.00);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockRejectedValue(
        new Error('Database error')
      );

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00,
      });

      // Purchase should fail if portfolio update fails
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });
});
