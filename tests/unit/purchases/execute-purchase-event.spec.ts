import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutePurchase } from '../../../src/features/purchases/application/use-cases/execute-purchase';
import { StockVendorPort } from '../../../src/features/stocks/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../../src/features/portfolio/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../../src/features/shared/ports/repositories/transaction-repository.port';
import { EventPublisherPort } from '../../../src/features/shared/ports/event-publisher.port';
import { TransactionOutcome } from '../../../src/features/shared/domain/entities/transaction';

describe('ExecutePurchase EventPublisherPort (US1)', () => {
  let mockStockVendorPort: StockVendorPort;
  let mockPortfolioRepository: PortfolioRepositoryPort;
  let mockTransactionRepository: TransactionRepositoryPort;
  let mockEventPublisher: EventPublisherPort;

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
    mockEventPublisher = {
      publishPurchaseCompleted: vi.fn(),
    };
  });

  describe('when purchase succeeds', () => {
    it('should call EventPublisherPort.publishPurchaseCompleted with correct payload when purchase succeeds', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 10;
      const price = 150.0;
      const total = 1500.0;

      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(price);
      vi.mocked(mockStockVendorPort.executeBuy).mockResolvedValue({
        success: true,
        order: { symbol, quantity, price, total },
        message: 'Order placed successfully',
      });
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();
      vi.mocked(mockPortfolioRepository.upsertPosition).mockResolvedValue();

      const executePurchase = new ExecutePurchase(
        mockStockVendorPort,
        mockPortfolioRepository,
        mockTransactionRepository,
        mockEventPublisher
      );

      const result = await executePurchase.execute({
        userId,
        symbol,
        quantity,
        price,
      });

      expect(result.success).toBe(true);
      expect(mockEventPublisher.publishPurchaseCompleted).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publishPurchaseCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'purchase_completed',
          userId,
          symbol,
          quantity,
          success: true,
          price,
          total,
        })
      );
      const payload = vi.mocked(mockEventPublisher.publishPurchaseCompleted).mock.calls[0][0];
      expect(payload.userId).toBe(userId);
      expect(payload.symbol).toBe(symbol);
      expect(payload.quantity).toBe(quantity);
      expect(payload.success).toBe(true);
      if (payload.timestamp) expect(typeof payload.timestamp).toBe('string');
    });
  });

  describe('when purchase fails', () => {
    it('should not call EventPublisherPort when price is out of tolerance', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(100.0);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const executePurchase = new ExecutePurchase(
        mockStockVendorPort,
        mockPortfolioRepository,
        mockTransactionRepository,
        mockEventPublisher
      );

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 103.0,
      });

      expect(result.success).toBe(false);
      expect(result.transaction?.outcome).toBe(TransactionOutcome.FAILURE);
      expect(mockEventPublisher.publishPurchaseCompleted).not.toHaveBeenCalled();
    });

    it('should not call EventPublisherPort when vendor rejects the buy', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(150.0);
      vi.mocked(mockStockVendorPort.executeBuy).mockResolvedValue({
        success: false,
        message: 'Insufficient funds',
      });
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const executePurchase = new ExecutePurchase(
        mockStockVendorPort,
        mockPortfolioRepository,
        mockTransactionRepository,
        mockEventPublisher
      );

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
      });

      expect(result.success).toBe(false);
      expect(mockEventPublisher.publishPurchaseCompleted).not.toHaveBeenCalled();
    });

    it('should not call EventPublisherPort when vendor getCurrentPrice throws', async () => {
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(new Error('Vendor down'));
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const executePurchase = new ExecutePurchase(
        mockStockVendorPort,
        mockPortfolioRepository,
        mockTransactionRepository,
        mockEventPublisher
      );

      const result = await executePurchase.execute({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
      });

      expect(result.success).toBe(false);
      expect(mockEventPublisher.publishPurchaseCompleted).not.toHaveBeenCalled();
    });
  });
});
