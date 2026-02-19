import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListStocks } from '../../../src/features/stocks/application/use-cases/list-stocks';
import { StockVendorPort } from '../../../src/features/stocks/ports/services/stock-vendor.port';
import { Stock } from '../../../src/features/stocks/domain/entities/stock';

describe('ListStocks Use Case', () => {
  let mockVendorPort: StockVendorPort;
  let listStocks: ListStocks;

  beforeEach(() => {
    mockVendorPort = {
      listStocks: vi.fn(),
      getCurrentPrice: vi.fn(),
    };
    listStocks = new ListStocks(mockVendorPort);
  });

  describe('should return stocks with pagination', () => {
    it('when vendor returns valid stock list', async () => {
      // Arrange
      const mockStocks: Stock[] = [
        { symbol: 'AAPL', price: 150.0 },
        { symbol: 'GOOGL', price: 2800.0 },
      ];
      const mockNextToken = 'token123';
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: mockStocks,
        nextToken: mockNextToken,
      });

      // Act
      const result = await listStocks.execute({ limit: 20 });

      // Assert
      expect(result.stocks).toEqual(mockStocks);
      expect(result.nextToken).toBe(mockNextToken);
      expect(mockVendorPort.listStocks).toHaveBeenCalledWith({
        limit: 20,
        nextToken: undefined,
      });
    });
  });

  describe('should handle pagination token', () => {
    it('when nextToken is provided', async () => {
      // Arrange
      const mockStocks: Stock[] = [{ symbol: 'MSFT', price: 300.0 }];
      const inputToken = 'page2token';
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: mockStocks,
        nextToken: null,
      });

      // Act
      const result = await listStocks.execute({
        nextToken: inputToken,
        limit: 10,
      });

      // Assert
      expect(result.stocks).toEqual(mockStocks);
      expect(result.nextToken).toBeNull();
      expect(mockVendorPort.listStocks).toHaveBeenCalledWith({
        limit: 10,
        nextToken: inputToken,
      });
    });
  });

  describe('should return empty list', () => {
    it('when vendor returns no stocks', async () => {
      // Arrange
      vi.mocked(mockVendorPort.listStocks).mockResolvedValue({
        stocks: [],
        nextToken: null,
      });

      // Act
      const result = await listStocks.execute({ limit: 20 });

      // Assert
      expect(result.stocks).toEqual([]);
      expect(result.nextToken).toBeNull();
    });
  });

  describe('should propagate vendor errors', () => {
    it('when vendor throws error', async () => {
      // Arrange
      const vendorError = new Error('Vendor unavailable');
      vi.mocked(mockVendorPort.listStocks).mockRejectedValue(vendorError);

      // Act & Assert
      await expect(listStocks.execute({ limit: 20 })).rejects.toThrow('Vendor unavailable');
    });
  });
});
