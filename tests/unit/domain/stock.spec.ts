import { describe, it, expect } from 'vitest';
import { Stock, validateStock } from '../../../src/features/stocks/domain/entities/stock';

describe('Stock Entity', () => {
  describe('should be valid', () => {
    it('when symbol and price are provided correctly', () => {
      // Arrange
      const stock: Stock = {
        symbol: 'AAPL',
        price: 150.0,
      };

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('when price is very small positive number', () => {
      // Arrange
      const stock: Stock = {
        symbol: 'PENNY',
        price: 0.01,
      };

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('should be invalid', () => {
    it('when symbol is empty', () => {
      // Arrange
      const stock: Stock = {
        symbol: '',
        price: 100.0,
      };

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Symbol is required');
    });

    it('when price is zero', () => {
      // Arrange
      const stock: Stock = {
        symbol: 'TEST',
        price: 0,
      };

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be greater than 0');
    });

    it('when price is negative', () => {
      // Arrange
      const stock: Stock = {
        symbol: 'TEST',
        price: -10.0,
      };

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be greater than 0');
    });

    it('when symbol is missing', () => {
      // Arrange
      const stock = {
        price: 100.0,
      } as Stock;

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Symbol is required');
    });

    it('when price is missing', () => {
      // Arrange
      const stock = {
        symbol: 'AAPL',
      } as Stock;

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be greater than 0');
    });
  });

  describe('should handle whitespace in symbol', () => {
    it('when symbol has leading or trailing spaces', () => {
      // Arrange
      const stock: Stock = {
        symbol: '  AAPL  ',
        price: 150.0,
      };

      // Act
      const result = validateStock(stock);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Symbol cannot contain whitespace');
    });
  });
});
