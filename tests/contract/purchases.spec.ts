import request from 'supertest';
import express, { Express } from 'express';
import { purchasesRouter } from '../../src/infrastructure/http/routes/purchases.routes';
import { ExecutePurchase } from '../../src/application/use-cases/execute-purchase';
import { StockVendorPort } from '../../src/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../src/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../src/ports/repositories/transaction-repository.port';
import { errorHandler } from '../../src/infrastructure/http/middlewares/error-handler';

describe('POST /users/:userId/purchases - Contract', () => {
  let app: Express;
  let mockStockVendorPort: jest.Mocked<StockVendorPort>;
  let mockPortfolioRepository: jest.Mocked<PortfolioRepositoryPort>;
  let mockTransactionRepository: jest.Mocked<TransactionRepositoryPort>;

  beforeEach(() => {
    // Create mocks
    mockStockVendorPort = {
      listStocks: jest.fn(),
      getCurrentPrice: jest.fn(),
    };

    mockPortfolioRepository = {
      getByUserId: jest.fn(),
      upsertPosition: jest.fn(),
    };

    mockTransactionRepository = {
      save: jest.fn(),
      findSince: jest.fn(),
    };

    // Create Express app
    app = express();
    app.use(express.json());

    // Create use case
    const executePurchase = new ExecutePurchase(
      mockStockVendorPort,
      mockPortfolioRepository,
      mockTransactionRepository
    );

    // Mount router
    app.use('/users/:userId/purchases', purchasesRouter(executePurchase));
    
    // Error handler
    app.use(errorHandler);
  });

  describe('201 - Successful purchase', () => {
    it('should return 201 with transaction details on successful purchase', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        success: true,
        transaction: {
          userId: 'user123',
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
          outcome: 'success',
          createdAt: expect.any(String),
        },
      });

      expect(response.body.message).toContain('successfully');
    });

    it('should accept decimal prices', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.75);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.50,
        })
        .expect(201);

      expect(response.body.transaction.price).toBe(150.50);
    });

    it('should handle large quantities', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(1.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'PENNY',
          quantity: 100000,
          price: 1.00,
        })
        .expect(201);

      expect(response.body.transaction.quantity).toBe(100000);
    });
  });

  describe('400 - Price out of tolerance', () => {
    it('should return 400 when requested price is too high', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(100.00);
      mockTransactionRepository.save.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 110.00, // More than 2% above current
        })
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Price out of tolerance'),
        transaction: {
          outcome: 'failure',
          reason: expect.stringContaining('Price out of tolerance'),
        },
      });
    });

    it('should return 400 when requested price is too low', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(100.00);
      mockTransactionRepository.save.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 90.00, // More than 2% below current
        })
        .expect(400);

      expect(response.body.error).toContain('Price out of tolerance');
      expect(response.body.transaction.outcome).toBe('failure');
    });
  });

  describe('400 - Validation errors', () => {
    it('should return 400 when symbol is missing', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          quantity: 10,
          price: 150.00,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when quantity is missing', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          price: 150.00,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when price is missing', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when quantity is not positive', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 0,
          price: 150.00,
        })
        .expect(400);

      expect(response.body.error).toContain('positive');
    });

    it('should return 400 when quantity is negative', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: -5,
          price: 150.00,
        })
        .expect(400);

      expect(response.body.error).toContain('positive');
    });

    it('should return 400 when quantity is not an integer', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10.5,
          price: 150.00,
        })
        .expect(400);

      expect(response.body.error).toContain('integer');
    });

    it('should return 400 when price is not positive', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 0,
        })
        .expect(400);

      expect(response.body.error).toContain('positive');
    });

    it('should return 400 when price is negative', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: -150.00,
        })
        .expect(400);

      expect(response.body.error).toContain('positive');
    });

    it('should return 400 when symbol is empty string', async () => {
      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: '',
          quantity: 10,
          price: 150.00,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 404 when userId is empty in path', async () => {
      // Route not found when userId is empty
      await request(app)
        .post('/users//purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect(404);

      // This is caught earlier by routing
    });
  });

  describe('404 - Invalid stock symbol', () => {
    it('should return 404 when stock symbol is not found', async () => {
      mockStockVendorPort.getCurrentPrice.mockRejectedValue(
        new Error('Stock symbol XYZ not found')
      );
      mockTransactionRepository.save.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'XYZ',
          quantity: 10,
          price: 150.00,
        })
        .expect(404);

      expect(response.body.error).toContain('not found');
      expect(response.body.transaction.outcome).toBe('failure');
    });
  });

  describe('502 - Vendor errors', () => {
    it('should return 502 when vendor is unavailable', async () => {
      mockStockVendorPort.getCurrentPrice.mockRejectedValue(
        new Error('Vendor service unavailable')
      );
      mockTransactionRepository.save.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect(502);

      expect(response.body.error).toContain('unavailable');
      expect(response.body.transaction.outcome).toBe('failure');
    });

    it('should return 502 when vendor times out', async () => {
      mockStockVendorPort.getCurrentPrice.mockRejectedValue(
        new Error('Vendor request timeout')
      );
      mockTransactionRepository.save.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect(502);

      expect(response.body.error).toContain('timeout');
    });
  });

  describe('response format', () => {
    it('should have consistent success response structure', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction).toHaveProperty('userId');
      expect(response.body.transaction).toHaveProperty('symbol');
      expect(response.body.transaction).toHaveProperty('quantity');
      expect(response.body.transaction).toHaveProperty('price');
      expect(response.body.transaction).toHaveProperty('outcome');
      expect(response.body.transaction).toHaveProperty('createdAt');
    });

    it('should have consistent error response structure', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(100.00);
      mockTransactionRepository.save.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 110.00,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction).toHaveProperty('outcome', 'failure');
      expect(response.body.transaction).toHaveProperty('reason');
    });

    it('should include ISO 8601 timestamp in transaction', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect(201);

      const timestamp = response.body.transaction.createdAt;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(new Date(timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('HTTP headers', () => {
    it('should return JSON content type', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      await request(app)
        .post('/users/user123/purchases')
        .send({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        })
        .expect('Content-Type', /json/);
    });

    it('should accept JSON request body', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      await request(app)
        .post('/users/user123/purchases')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          symbol: 'AAPL',
          quantity: 10,
          price: 150.00,
        }))
        .expect(201);
    });
  });

  describe('idempotency and safety', () => {
    it('should treat multiple identical requests as separate purchases', async () => {
      mockStockVendorPort.getCurrentPrice.mockResolvedValue(150.00);
      mockTransactionRepository.save.mockResolvedValue();
      mockPortfolioRepository.upsertPosition.mockResolvedValue();

      const requestBody = {
        symbol: 'AAPL',
        quantity: 10,
        price: 150.00,
      };

      // First request
      const response1 = await request(app)
        .post('/users/user123/purchases')
        .send(requestBody)
        .expect(201);

      // Second identical request
      const response2 = await request(app)
        .post('/users/user123/purchases')
        .send(requestBody)
        .expect(201);

      // Both should succeed as separate purchases
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(mockPortfolioRepository.upsertPosition).toHaveBeenCalledTimes(2);
    });
  });
});
