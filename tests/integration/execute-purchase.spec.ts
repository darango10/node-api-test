import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ExecutePurchase } from '../../src/features/purchases/application/use-cases/execute-purchase';
import { PortfolioRepositoryImpl } from '../../src/features/portfolio/infrastructure/repositories/portfolio.repository';
import { TransactionRepositoryImpl } from '../../src/features/shared/infrastructure/repositories/transaction.repository';
import type {
  StockVendorPort,
  BuyStockRequest,
  BuyStockResponse,
} from '../../src/features/stocks/ports/services/stock-vendor.port';
import { PortfolioModel } from '../../src/features/portfolio/infrastructure/repositories/portfolio.model';
import { TransactionModel } from '../../src/features/shared/infrastructure/repositories/transaction.model';

/** Port with Vitest mocks so .mockResolvedValue etc. are typed. */
type MockedStockVendorPort = StockVendorPort & {
  listStocks: Mock;
  getCurrentPrice: Mock<(symbol: string) => Promise<number>>;
  executeBuy: Mock<(request: BuyStockRequest) => Promise<BuyStockResponse>>;
};

describe('ExecutePurchase Integration', () => {
  let mongoServer: MongoMemoryServer;
  let executePurchase: ExecutePurchase;
  let portfolioRepository: PortfolioRepositoryImpl;
  let transactionRepository: TransactionRepositoryImpl;
  let mockStockVendorPort: MockedStockVendorPort;

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
    // Clear collections
    await PortfolioModel.deleteMany({});
    await TransactionModel.deleteMany({});

    // Create real repository instances
    portfolioRepository = new PortfolioRepositoryImpl();
    transactionRepository = new TransactionRepositoryImpl();

    // Mock vendor port
    mockStockVendorPort = {
      listStocks: vi.fn(),
      getCurrentPrice: vi.fn(),
      executeBuy: vi.fn(),
    } as MockedStockVendorPort;

    // Create use case with real repositories
    executePurchase = new ExecutePurchase(
      mockStockVendorPort,
      portfolioRepository,
      transactionRepository
    );
  });

  /** Mock vendor executeBuy to succeed (required after price check in purchase flow). */
  const mockVendorExecuteBuySuccess = (symbol: string, quantity: number, price: number) => {
    mockStockVendorPort.executeBuy.mockResolvedValue({
      success: true,
      order: { symbol, quantity, price, total: quantity * price },
      message: 'Order placed successfully',
    });
  };

  describe('successful purchase flow', () => {
    it('should create portfolio and record transaction on first purchase', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 10;
      const price = 150.0;

      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess(symbol, quantity, price);

      const result = await executePurchase.execute({
        userId,
        symbol,
        quantity,
        price,
      });

      expect(result.success).toBe(true);

      // Verify portfolio was created in database
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio).toBeDefined();
      expect(portfolio?.positions).toHaveLength(1);
      expect(portfolio?.positions[0].symbol).toBe(symbol);
      expect(portfolio?.positions[0].quantity).toBe(quantity);

      // Verify transaction was recorded
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].outcome).toBe('success');
      expect(transactions[0].symbol).toBe(symbol);
    });

    it('should update existing portfolio position on subsequent purchase', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';

      // First purchase
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess(symbol, 10, 150.0);
      await executePurchase.execute({
        userId,
        symbol,
        quantity: 10,
        price: 150.0,
      });

      // Second purchase of same stock
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(152.0);
      mockVendorExecuteBuySuccess(symbol, 5, 152.0);
      await executePurchase.execute({
        userId,
        symbol,
        quantity: 5,
        price: 152.0,
      });

      // Verify portfolio has single position with combined quantity
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio?.positions).toHaveLength(1);
      expect(portfolio?.positions[0].symbol).toBe(symbol);
      expect(portfolio?.positions[0].quantity).toBe(15); // 10 + 5

      // Verify both transactions were recorded
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(2);
      expect(transactions.every((t) => t.outcome === 'success')).toBe(true);
    });

    it('should add new position when purchasing different stock', async () => {
      const userId = 'user123';

      // First purchase - AAPL
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess('AAPL', 10, 150.0);
      await executePurchase.execute({
        userId,
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
      });

      // Second purchase - GOOGL
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(2800.0);
      mockVendorExecuteBuySuccess('GOOGL', 5, 2800.0);
      await executePurchase.execute({
        userId,
        symbol: 'GOOGL',
        quantity: 5,
        price: 2800.0,
      });

      // Verify portfolio has two positions
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio?.positions).toHaveLength(2);

      const aaplPosition = portfolio?.positions.find((p) => p.symbol === 'AAPL');
      const googlPosition = portfolio?.positions.find((p) => p.symbol === 'GOOGL');

      expect(aaplPosition?.quantity).toBe(10);
      expect(googlPosition?.quantity).toBe(5);

      // Verify both transactions were recorded
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(2);
    });

    it('should handle multiple users independently', async () => {
      const symbol = 'AAPL';
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess(symbol, 10, 150.0);

      // User 1 purchase
      await executePurchase.execute({
        userId: 'user1',
        symbol,
        quantity: 10,
        price: 150.0,
      });

      mockVendorExecuteBuySuccess(symbol, 5, 150.0);
      // User 2 purchase
      await executePurchase.execute({
        userId: 'user2',
        symbol,
        quantity: 5,
        price: 150.0,
      });

      // Verify separate portfolios
      const portfolio1 = await PortfolioModel.findOne({ userId: 'user1' });
      const portfolio2 = await PortfolioModel.findOne({ userId: 'user2' });

      expect(portfolio1?.positions[0].quantity).toBe(10);
      expect(portfolio2?.positions[0].quantity).toBe(5);

      // Verify separate transactions
      const trans1 = await TransactionModel.find({ userId: 'user1' });
      const trans2 = await TransactionModel.find({ userId: 'user2' });

      expect(trans1).toHaveLength(1);
      expect(trans2).toHaveLength(1);
    });
  });

  describe('failed purchase flow', () => {
    it('should record failure but not update portfolio when price out of tolerance', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';

      mockStockVendorPort.getCurrentPrice.mockResolvedValue(100.0);

      const result = await executePurchase.execute({
        userId,
        symbol,
        quantity: 10,
        price: 110.0, // More than 2% above current price
      });

      expect(result.success).toBe(false);

      // Verify portfolio was NOT created
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio).toBeNull();

      // Verify transaction was recorded with failure
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].outcome).toBe('failure');
      expect(transactions[0].reason).toContain('Price out of tolerance');
    });

    it('should not update portfolio when vendor is unavailable', async () => {
      const userId = 'user123';

      mockStockVendorPort.getCurrentPrice.mockRejectedValue(
        new Error('Vendor service unavailable')
      );

      const result = await executePurchase.execute({
        userId,
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
      });

      expect(result.success).toBe(false);

      // Verify portfolio was NOT created
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio).toBeNull();

      // Verify transaction was recorded with failure
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].outcome).toBe('failure');
    });

    it('should not modify existing portfolio on failed purchase', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';

      // First successful purchase
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess(symbol, 10, 150.0);
      await executePurchase.execute({
        userId,
        symbol,
        quantity: 10,
        price: 150.0,
      });

      const beforePortfolio = await PortfolioModel.findOne({ userId });
      const beforeQuantity = beforePortfolio?.positions[0].quantity;

      // Second purchase fails
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(100.0);
      await executePurchase.execute({
        userId,
        symbol,
        quantity: 5,
        price: 110.0, // Out of tolerance
      });

      // Verify portfolio unchanged
      const afterPortfolio = await PortfolioModel.findOne({ userId });
      const afterQuantity = afterPortfolio?.positions[0].quantity;

      expect(afterQuantity).toBe(beforeQuantity);
      expect(afterQuantity).toBe(10);

      // Verify two transactions (one success, one failure)
      const transactions = await TransactionModel.find({ userId }).sort({ createdAt: 1 });
      expect(transactions).toHaveLength(2);
      expect(transactions[0].outcome).toBe('success');
      expect(transactions[1].outcome).toBe('failure');
    });
  });

  describe('concurrent purchases', () => {
    it('should handle concurrent purchases for same user and stock', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';

      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockStockVendorPort.executeBuy.mockResolvedValue({
        success: true,
        order: { symbol, quantity: 10, price: 150.0, total: 1500 },
        message: 'Order placed successfully',
      });

      // Execute 5 concurrent purchases
      const purchases = Array.from({ length: 5 }, () =>
        executePurchase.execute({
          userId,
          symbol,
          quantity: 10,
          price: 150.0,
        })
      );

      const results = await Promise.all(purchases);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // Verify portfolio has correct total quantity (50)
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio?.positions).toHaveLength(1);
      expect(portfolio?.positions[0].quantity).toBe(50);

      // Verify all transactions recorded
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(5);
      expect(transactions.every((t) => t.outcome === 'success')).toBe(true);
    });

    it('should handle concurrent purchases of different stocks', async () => {
      const userId = 'user123';

      const getPrice = (symbol: string): number => {
        if (symbol === 'AAPL') return 150.0;
        if (symbol === 'GOOGL') return 2800.0;
        if (symbol === 'MSFT') return 300.0;
        return 0;
      };
      mockStockVendorPort.getCurrentPrice.mockImplementation(async (symbol) => getPrice(symbol));
      mockStockVendorPort.executeBuy.mockImplementation(async (req) => ({
        success: true,
        order: {
          symbol: req.symbol,
          quantity: req.quantity,
          price: req.price,
          total: req.quantity * req.price,
        },
        message: 'Order placed',
      }));

      // Execute concurrent purchases of different stocks
      const results = await Promise.all([
        executePurchase.execute({ userId, symbol: 'AAPL', quantity: 10, price: 150.0 }),
        executePurchase.execute({ userId, symbol: 'GOOGL', quantity: 5, price: 2800.0 }),
        executePurchase.execute({ userId, symbol: 'MSFT', quantity: 20, price: 300.0 }),
      ]);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // Verify portfolio has three positions
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio?.positions).toHaveLength(3);
    });

    it('should handle mix of successful and failed concurrent purchases', async () => {
      const userId = 'user123';

      mockStockVendorPort.getCurrentPrice.mockResolvedValue(100.0);
      mockStockVendorPort.executeBuy.mockResolvedValue({
        success: true,
        order: { symbol: 'AAPL', quantity: 10, price: 100.0, total: 1000 },
        message: 'Order placed',
      });

      const results = await Promise.all([
        executePurchase.execute({ userId, symbol: 'AAPL', quantity: 10, price: 100.0 }), // Success
        executePurchase.execute({ userId, symbol: 'GOOGL', quantity: 5, price: 150.0 }), // Fail (out of tolerance)
        executePurchase.execute({ userId, symbol: 'MSFT', quantity: 20, price: 101.0 }), // Success
      ]);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);

      // Verify portfolio has only successful purchases
      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio?.positions).toHaveLength(2);

      // Verify all transactions recorded
      const transactions = await TransactionModel.find({ userId });
      expect(transactions).toHaveLength(3);
    });
  });

  describe('data integrity', () => {
    it('should maintain portfolio updatedAt timestamp', async () => {
      const userId = 'user123';
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess('AAPL', 10, 150.0);

      await executePurchase.execute({
        userId,
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
      });

      const portfolio1 = await PortfolioModel.findOne({ userId });
      const updatedAt1 = portfolio1?.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockVendorExecuteBuySuccess('AAPL', 5, 150.0);
      await executePurchase.execute({
        userId,
        symbol: 'AAPL',
        quantity: 5,
        price: 150.0,
      });

      const portfolio2 = await PortfolioModel.findOne({ userId });
      const updatedAt2 = portfolio2?.updatedAt;

      expect(updatedAt1).toBeDefined();
      expect(updatedAt2).toBeDefined();
      expect(updatedAt2!.getTime()).toBeGreaterThan(updatedAt1!.getTime());
    });

    it('should maintain transaction createdAt order', async () => {
      const userId = 'user123';
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.0);
      mockVendorExecuteBuySuccess('AAPL', 10, 150.0);

      // Execute multiple purchases with small delays
      for (let i = 0; i < 3; i++) {
        await executePurchase.execute({
          userId,
          symbol: 'AAPL',
          quantity: 10,
          price: 150.0,
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const transactions = await TransactionModel.find({ userId }).sort({ createdAt: 1 });

      let prevTime = 0;
      for (const tx of transactions) {
        const createdAt = tx.createdAt.getTime();
        expect(createdAt).toBeGreaterThanOrEqual(prevTime);
        prevTime = createdAt;
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very large quantity', async () => {
      const userId = 'user123';
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(1.0);
      mockVendorExecuteBuySuccess('PENNY', 1000000, 1.0);

      const result = await executePurchase.execute({
        userId,
        symbol: 'PENNY',
        quantity: 1000000,
        price: 1.0,
      });

      expect(result.success).toBe(true);

      const portfolio = await PortfolioModel.findOne({ userId });
      expect(portfolio?.positions[0].quantity).toBe(1000000);
    });

    it('should handle very high price', async () => {
      const userId = 'user123';
      const highPrice = 999999.99;

      mockStockVendorPort.getCurrentPrice.mockResolvedValue(highPrice);
      mockVendorExecuteBuySuccess('EXPENSIVE', 1, highPrice);

      const result = await executePurchase.execute({
        userId,
        symbol: 'EXPENSIVE',
        quantity: 1,
        price: highPrice,
      });

      expect(result.success).toBe(true);

      const transaction = await TransactionModel.findOne({ userId });
      expect(transaction?.price).toBe(highPrice);
    });
  });
});
