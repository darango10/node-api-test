import request from 'supertest';
import express, { Express } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { salesRouter } from '../../src/features/sales/infrastructure/routes/sales.routes';
import { ExecuteSell } from '../../src/features/sales/application/use-cases/execute-sell';
import { StockVendorPort } from '../../src/features/stocks/ports/services/stock-vendor.port';
import { PortfolioRepositoryPort } from '../../src/features/portfolio/ports/repositories/portfolio-repository.port';
import { TransactionRepositoryPort } from '../../src/features/shared/ports/repositories/transaction-repository.port';
import { errorHandler } from '../../src/features/shared/infrastructure/http/middlewares/error-handler';
import { Portfolio, Position } from '../../src/features/portfolio/domain/entities/portfolio';

describe('POST /users/:userId/sales - Contract', () => {
  let app: Express;
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

    app = express();
    app.use(express.json());

    const executeSell = new ExecuteSell(
      mockStockVendorPort,
      mockPortfolioRepository,
      mockTransactionRepository
    );

    app.use('/users/:userId/sales', salesRouter(executeSell));
    app.use(errorHandler);
  });

  describe('201 - Successful sell', () => {
    it('should return 201 with transaction details on successful sell', async () => {
      const portfolio = new Portfolio('user123', [new Position('AAPL', 20)]);
      vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(portfolio);
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockResolvedValue(150.0);
      vi.mocked(mockPortfolioRepository.reducePosition).mockResolvedValue();
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/sales')
        .send({ symbol: 'AAPL', quantity: 10 })
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        success: true,
        transaction: {
          userId: 'user123',
          symbol: 'AAPL',
          quantity: 10,
          price: 150,
          outcome: 'success',
          createdAt: expect.any(String),
        },
      });
      expect(response.body.message).toContain('successfully');
    });
  });

  describe('400 - Validation and insufficient shares', () => {
    it('should return 400 with currentHeldQuantity when insufficient shares', async () => {
      const portfolio = new Portfolio('user123', [new Position('AAPL', 5)]);
      vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(portfolio);
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/sales')
        .send({ symbol: 'AAPL', quantity: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.currentHeldQuantity).toBe(5);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when quantity is missing', async () => {
      const response = await request(app)
        .post('/users/user123/sales')
        .send({ symbol: 'AAPL' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when quantity is not a positive integer', async () => {
      await request(app)
        .post('/users/user123/sales')
        .send({ symbol: 'AAPL', quantity: 0 })
        .expect(400);
    });
  });

  describe('502 - Market unavailable', () => {
    it('should return 502 when getCurrentPrice fails', async () => {
      const portfolio = new Portfolio('user123', [new Position('AAPL', 10)]);
      vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(portfolio);
      vi.mocked(mockStockVendorPort.getCurrentPrice).mockRejectedValue(
        new Error('Vendor unavailable')
      );
      vi.mocked(mockTransactionRepository.save).mockResolvedValue();

      const response = await request(app)
        .post('/users/user123/sales')
        .send({ symbol: 'AAPL', quantity: 10 })
        .expect(502);

      expect(response.body.error).toBeDefined();
    });
  });
});
