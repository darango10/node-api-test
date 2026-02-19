import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { StockVendorAdapter } from '../../src/features/stocks/infrastructure/adapters/stock-vendor.adapter';

describe('StockVendorAdapter Integration', () => {
  let adapter: StockVendorAdapter;
  const vendorBaseUrl = 'http://test-vendor-api.com';
  const testApiKey = 'test-api-key-123';

  beforeEach(() => {
    adapter = new StockVendorAdapter(vendorBaseUrl, testApiKey, 5000);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('listStocks', () => {
    describe('should return all stocks from paginated vendor response', () => {
      it('when vendor API returns multiple pages', async () => {
        // Arrange - First page
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 20 })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, {
            status: 200,
            data: {
              items: [
                { symbol: 'AAPL', price: 150.0, name: 'Apple Inc.' },
                { symbol: 'GOOGL', price: 2800.0, name: 'Alphabet Inc.' },
              ],
              nextToken: 'page2token',
            },
          });

        // Arrange - Second page
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 20, nextToken: 'page2token' })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, {
            status: 200,
            data: {
              items: [{ symbol: 'MSFT', price: 300.0, name: 'Microsoft Corp.' }],
              nextToken: null,
            },
          });

        // Act
        const result = await adapter.listStocks({ limit: 20 });

        // Assert - Should return all stocks from both pages
        expect(result.stocks).toHaveLength(3);
        expect(result.stocks[0].symbol).toBe('AAPL');
        expect(result.stocks[1].symbol).toBe('GOOGL');
        expect(result.stocks[2].symbol).toBe('MSFT');
        expect(result.nextToken).toBeNull(); // Always null since we fetch all
      });
    });

    describe('should handle single page response', () => {
      it('when vendor returns all stocks in one page', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 10 })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, {
            status: 200,
            data: {
              items: [{ symbol: 'MSFT', price: 300.0, name: 'Microsoft Corp.' }],
              nextToken: null,
            },
          });

        // Act
        const result = await adapter.listStocks({ limit: 10 });

        // Assert
        expect(result.stocks).toHaveLength(1);
        expect(result.nextToken).toBeNull();
      });
    });

    describe('should throw error', () => {
      it('when vendor returns 5xx error', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 20 })
          .matchHeader('x-api-key', testApiKey)
          .reply(503, { error: 'Service temporarily unavailable' });

        // Act & Assert
        await expect(adapter.listStocks({ limit: 20 })).rejects.toThrow();
      });

      it('when vendor times out', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 20 })
          .matchHeader('x-api-key', testApiKey)
          .delayConnection(6000)
          .reply(200, {
            status: 200,
            data: { items: [], nextToken: null },
          });

        // Act & Assert
        await expect(adapter.listStocks({ limit: 20 })).rejects.toThrow();
      }, 10000); // 10 second timeout for this test

      it('when vendor returns invalid response format', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 20 })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, { invalid: 'response' });

        // Act & Assert
        await expect(adapter.listStocks({ limit: 20 })).rejects.toThrow(
          'Invalid response format from vendor'
        );
      });
    });

    describe('should return empty list', () => {
      it('when vendor returns no stocks', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 20 })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, {
            status: 200,
            data: {
              items: [],
              nextToken: null,
            },
          });

        // Act
        const result = await adapter.listStocks({ limit: 20 });

        // Assert
        expect(result.stocks).toEqual([]);
        expect(result.nextToken).toBeNull();
      });
    });
  });

  describe('getCurrentPrice', () => {
    describe('should return current price', () => {
      it('when vendor returns valid price for symbol', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 1000 })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, {
            status: 200,
            data: {
              items: [
                { symbol: 'AAPL', price: 155.5, name: 'Apple Inc.' },
                { symbol: 'GOOGL', price: 2800.0, name: 'Alphabet Inc.' },
              ],
              nextToken: null,
            },
          });

        // Act
        const price = await adapter.getCurrentPrice('AAPL');

        // Assert
        expect(price).toBe(155.5);
      });
    });

    describe('should throw error', () => {
      it('when symbol is not found', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 1000 })
          .matchHeader('x-api-key', testApiKey)
          .reply(200, {
            status: 200,
            data: {
              items: [{ symbol: 'AAPL', price: 155.5, name: 'Apple Inc.' }],
              nextToken: null,
            },
          });

        // Act & Assert
        await expect(adapter.getCurrentPrice('INVALID')).rejects.toThrow(
          'Stock symbol INVALID not found'
        );
      });

      it('when vendor returns 5xx error', async () => {
        // Arrange
        nock(vendorBaseUrl)
          .get('/stocks')
          .query({ limit: 1000 })
          .matchHeader('x-api-key', testApiKey)
          .reply(500, {
            status: 500,
            error: 'Internal server error',
          });

        // Act & Assert
        await expect(adapter.getCurrentPrice('AAPL')).rejects.toThrow('Vendor service unavailable');
      });
    });
  });
});
