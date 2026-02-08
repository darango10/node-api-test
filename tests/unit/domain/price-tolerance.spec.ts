import { isWithinTolerance } from '../../../src/domain/services/price-tolerance';

describe('Price Tolerance Service', () => {
  describe('isWithinTolerance', () => {
    it('should return true when requested price equals current price', () => {
      const result = isWithinTolerance(100, 100, 0.02);
      expect(result).toBe(true);
    });

    it('should return true when requested price is within 2% above current price', () => {
      // 100 + 2% = 102
      expect(isWithinTolerance(101, 100, 0.02)).toBe(true);
      expect(isWithinTolerance(102, 100, 0.02)).toBe(true);
    });

    it('should return true when requested price is within 2% below current price', () => {
      // 100 - 2% = 98
      expect(isWithinTolerance(99, 100, 0.02)).toBe(true);
      expect(isWithinTolerance(98, 100, 0.02)).toBe(true);
    });

    it('should return false when requested price is more than 2% above current price', () => {
      expect(isWithinTolerance(102.01, 100, 0.02)).toBe(false);
      expect(isWithinTolerance(105, 100, 0.02)).toBe(false);
    });

    it('should return false when requested price is more than 2% below current price', () => {
      expect(isWithinTolerance(97.99, 100, 0.02)).toBe(false);
      expect(isWithinTolerance(95, 100, 0.02)).toBe(false);
    });

    it('should handle edge case with exact 2% boundary', () => {
      const currentPrice = 50;
      const tolerance = 0.02;
      const upperBound = 51; // 50 + 2%
      const lowerBound = 49; // 50 - 2%

      expect(isWithinTolerance(upperBound, currentPrice, tolerance)).toBe(true);
      expect(isWithinTolerance(lowerBound, currentPrice, tolerance)).toBe(true);
    });

    it('should handle decimal prices correctly', () => {
      const currentPrice = 123.45;
      const tolerance = 0.02;
      // Within tolerance: 120.98 - 125.92
      expect(isWithinTolerance(123.45, currentPrice, tolerance)).toBe(true);
      expect(isWithinTolerance(121, currentPrice, tolerance)).toBe(true);
      expect(isWithinTolerance(125, currentPrice, tolerance)).toBe(true);
      expect(isWithinTolerance(120, currentPrice, tolerance)).toBe(false);
      expect(isWithinTolerance(126, currentPrice, tolerance)).toBe(false);
    });

    it('should handle different tolerance percentages', () => {
      const currentPrice = 100;
      
      // 5% tolerance: 95 - 105
      expect(isWithinTolerance(94, currentPrice, 0.05)).toBe(false);
      expect(isWithinTolerance(95, currentPrice, 0.05)).toBe(true);
      expect(isWithinTolerance(105, currentPrice, 0.05)).toBe(true);
      expect(isWithinTolerance(106, currentPrice, 0.05)).toBe(false);
      
      // 1% tolerance: 99 - 101
      expect(isWithinTolerance(98.5, currentPrice, 0.01)).toBe(false);
      expect(isWithinTolerance(99, currentPrice, 0.01)).toBe(true);
      expect(isWithinTolerance(101, currentPrice, 0.01)).toBe(true);
      expect(isWithinTolerance(101.5, currentPrice, 0.01)).toBe(false);
    });

    it('should handle zero and negative prices (edge cases)', () => {
      // These might be prevented by validation, but testing behavior
      expect(isWithinTolerance(0, 0, 0.02)).toBe(true);
      expect(isWithinTolerance(0, 100, 0.02)).toBe(false);
      expect(isWithinTolerance(100, 0, 0.02)).toBe(false);
    });
  });
});
