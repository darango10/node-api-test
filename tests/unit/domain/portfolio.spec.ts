import { Portfolio, Position } from '../../../src/features/portfolio/domain/entities/portfolio';

describe('Portfolio Entity', () => {
  describe('Position', () => {
    it('should create a valid position when given valid data', () => {
      const position = new Position('AAPL', 10);
      expect(position.symbol).toBe('AAPL');
      expect(position.quantity).toBe(10);
    });

    it('should throw error when symbol is empty', () => {
      expect(() => new Position('', 10)).toThrow('Symbol cannot be empty');
    });

    it('should throw error when quantity is negative', () => {
      expect(() => new Position('AAPL', -1)).toThrow('Quantity must be non-negative');
    });

    it('should throw error when quantity is not an integer', () => {
      expect(() => new Position('AAPL', 10.5)).toThrow('Quantity must be an integer');
    });

    it('should allow zero quantity', () => {
      const position = new Position('AAPL', 0);
      expect(position.quantity).toBe(0);
    });
  });

  describe('Portfolio', () => {
    it('should create an empty portfolio when given valid userId', () => {
      const portfolio = new Portfolio('user-123', []);
      expect(portfolio.userId).toBe('user-123');
      expect(portfolio.positions).toEqual([]);
    });

    it('should create portfolio with positions when given valid data', () => {
      const positions = [new Position('AAPL', 10), new Position('GOOGL', 5)];
      const portfolio = new Portfolio('user-123', positions);
      expect(portfolio.userId).toBe('user-123');
      expect(portfolio.positions).toHaveLength(2);
      expect(portfolio.positions[0].symbol).toBe('AAPL');
      expect(portfolio.positions[1].symbol).toBe('GOOGL');
    });

    it('should throw error when userId is empty', () => {
      expect(() => new Portfolio('', [])).toThrow('UserId cannot be empty');
    });

    it('should throw error when positions is not an array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new Portfolio('user-123', null as any)).toThrow('Positions must be an array');
    });

    it('should filter out positions with zero quantity when getting active positions', () => {
      const positions = [
        new Position('AAPL', 10),
        new Position('GOOGL', 0),
        new Position('MSFT', 5),
      ];
      const portfolio = new Portfolio('user-123', positions);
      const activePositions = portfolio.getActivePositions();

      expect(activePositions).toHaveLength(2);
      expect(activePositions.find((p) => p.symbol === 'GOOGL')).toBeUndefined();
    });

    it('should return empty array when no active positions', () => {
      const positions = [new Position('AAPL', 0)];
      const portfolio = new Portfolio('user-123', positions);
      expect(portfolio.getActivePositions()).toEqual([]);
    });

    it('should find position by symbol', () => {
      const positions = [new Position('AAPL', 10), new Position('GOOGL', 5)];
      const portfolio = new Portfolio('user-123', positions);
      const position = portfolio.findPosition('GOOGL');

      expect(position).toBeDefined();
      expect(position?.symbol).toBe('GOOGL');
      expect(position?.quantity).toBe(5);
    });

    it('should return undefined when position not found', () => {
      const portfolio = new Portfolio('user-123', []);
      expect(portfolio.findPosition('AAPL')).toBeUndefined();
    });
  });
});
