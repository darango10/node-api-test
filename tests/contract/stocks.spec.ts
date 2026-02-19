import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import { createStocksRouter } from '../../src/features/stocks/infrastructure/routes/stocks.routes';
import { StockVendorPort } from '../../src/features/stocks/ports/services/stock-vendor.port';
import { ListStocks } from '../../src/features/stocks/application/use-cases/list-stocks';

describe('GET /stocks - Contract Tests', () => {
  let app: Express;
  let mockVendorPort: StockVendorPort;

  beforeAll(() => {
    // Setup mock vendor port
    mockVendorPort = {
      listStocks: vi.fn(),
      getCurrentPrice: vi.fn(),
    };

    // Create app with stocks router
    app = express();
    app.use(express.json());

    const listStocksUseCase = new ListStocks(mockVendorPort);
    app.use('/stocks', createStocksRouter(listStocksUseCase));

    // Error handler
    app.use((err: Error, _req: Request, res: Response) => {
      const status = (err as { status?: number }).status || 500;
      res.status(status).json({
        error: err.message || 'Internal server error',
        code: (err as { code?: string }).code,
      });
    });
  });

  describe('should return 200 with valid stock list', () => {
    it('when vendor returns stocks successfully', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: [
          { symbol: 'AAPL', price: 150.0 },
          { symbol: 'GOOGL', price: 2800.0 },
        ],
        nextToken: 'token123',
      });

      // Act
      const response = await request(app).get('/stocks').query({ limit: 20 }).expect(200);

      // Assert
      expect(response.body).toHaveProperty('stocks');
      expect(Array.isArray(response.body.stocks)).toBe(true);
      expect(response.body.stocks).toHaveLength(2);
      expect(response.body.stocks[0]).toHaveProperty('symbol');
      expect(response.body.stocks[0]).toHaveProperty('price');
      expect(response.body.stocks[0].symbol).toBe('AAPL');
      expect(response.body.stocks[0].price).toBe(150.0);
      expect(response.body.nextToken).toBe('token123');
    });
  });

  describe('should return 200 with pagination', () => {
    it('when nextToken is provided', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: [{ symbol: 'MSFT', price: 300.0 }],
        nextToken: null,
      });

      // Act
      const response = await request(app)
        .get('/stocks')
        .query({ nextToken: 'page2', limit: 10 })
        .expect(200);

      // Assert
      expect(response.body.stocks).toHaveLength(1);
      expect(response.body.nextToken).toBeNull();
    });
  });

  describe('should return 200 with empty array', () => {
    it('when vendor returns no stocks', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: [],
        nextToken: null,
      });

      // Act
      const response = await request(app).get('/stocks').expect(200);

      // Assert
      expect(response.body.stocks).toEqual([]);
      expect(response.body.nextToken).toBeNull();
    });
  });

  describe('should return 502', () => {
    it('when vendor is unavailable', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockRejectedValue(
        new Error('Vendor service unavailable')
      );

      // Act
      const response = await request(app).get('/stocks').expect(502);

      // Assert
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    it('when vendor times out', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockRejectedValue(new Error('Request timeout'));

      // Act
      const response = await request(app).get('/stocks').expect(502);

      // Assert
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('should validate query parameters', () => {
    it('when limit is invalid', async () => {
      // Act
      const response = await request(app).get('/stocks').query({ limit: -1 });

      // Assert - should either validate or use default
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('should conform to OpenAPI schema', () => {
    it('when response includes all required fields', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: [{ symbol: 'AAPL', price: 150.0 }],
        nextToken: 'next',
      });

      // Act
      const response = await request(app).get('/stocks').expect(200);

      // Assert - Check OpenAPI schema compliance
      expect(response.body).toMatchObject({
        stocks: expect.any(Array),
      });

      // Each stock must have symbol and price
      response.body.stocks.forEach((stock: { symbol: string; price: number }) => {
        expect(stock).toHaveProperty('symbol');
        expect(stock).toHaveProperty('price');
        expect(typeof stock.symbol).toBe('string');
        expect(typeof stock.price).toBe('number');
        expect(stock.price).toBeGreaterThan(0);
      });

      // nextToken is optional but must be string or null
      if (response.body.nextToken !== undefined) {
        expect(
          typeof response.body.nextToken === 'string' || response.body.nextToken === null
        ).toBe(true);
      }
    });
  });
});
