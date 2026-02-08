import { Transaction, TransactionOutcome } from '../../../src/domain/entities/transaction';
import { ValidationError } from '../../../src/domain/errors';

describe('Transaction Entity', () => {
  describe('constructor', () => {
    it('should create a valid transaction with success outcome', () => {
      const transaction = new Transaction(
        'user123',
        'AAPL',
        10,
        150.50,
        TransactionOutcome.SUCCESS
      );

      expect(transaction.userId).toBe('user123');
      expect(transaction.symbol).toBe('AAPL');
      expect(transaction.quantity).toBe(10);
      expect(transaction.price).toBe(150.50);
      expect(transaction.outcome).toBe(TransactionOutcome.SUCCESS);
      expect(transaction.reason).toBeUndefined();
      expect(transaction.createdAt).toBeInstanceOf(Date);
    });

    it('should create a valid transaction with failure outcome and reason', () => {
      const transaction = new Transaction(
        'user456',
        'GOOGL',
        5,
        2800.00,
        TransactionOutcome.FAILURE,
        'Price out of tolerance'
      );

      expect(transaction.userId).toBe('user456');
      expect(transaction.symbol).toBe('GOOGL');
      expect(transaction.quantity).toBe(5);
      expect(transaction.price).toBe(2800.00);
      expect(transaction.outcome).toBe(TransactionOutcome.FAILURE);
      expect(transaction.reason).toBe('Price out of tolerance');
      expect(transaction.createdAt).toBeInstanceOf(Date);
    });

    it('should throw ValidationError when userId is empty', () => {
      expect(() => {
        new Transaction('', 'AAPL', 10, 150, TransactionOutcome.SUCCESS);
      }).toThrow(ValidationError);

      expect(() => {
        new Transaction('   ', 'AAPL', 10, 150, TransactionOutcome.SUCCESS);
      }).toThrow('UserId cannot be empty');
    });

    it('should throw ValidationError when symbol is empty', () => {
      expect(() => {
        new Transaction('user123', '', 10, 150, TransactionOutcome.SUCCESS);
      }).toThrow(ValidationError);

      expect(() => {
        new Transaction('user123', '   ', 10, 150, TransactionOutcome.SUCCESS);
      }).toThrow('Symbol cannot be empty');
    });

    it('should throw ValidationError when quantity is not positive', () => {
      expect(() => {
        new Transaction('user123', 'AAPL', 0, 150, TransactionOutcome.SUCCESS);
      }).toThrow(ValidationError);

      expect(() => {
        new Transaction('user123', 'AAPL', -5, 150, TransactionOutcome.SUCCESS);
      }).toThrow('Quantity must be a positive integer');
    });

    it('should throw ValidationError when quantity is not an integer', () => {
      expect(() => {
        new Transaction('user123', 'AAPL', 10.5, 150, TransactionOutcome.SUCCESS);
      }).toThrow(ValidationError);

      expect(() => {
        new Transaction('user123', 'AAPL', 10.5, 150, TransactionOutcome.SUCCESS);
      }).toThrow('Quantity must be a positive integer');
    });

    it('should throw ValidationError when price is not positive', () => {
      expect(() => {
        new Transaction('user123', 'AAPL', 10, 0, TransactionOutcome.SUCCESS);
      }).toThrow(ValidationError);

      expect(() => {
        new Transaction('user123', 'AAPL', 10, -150, TransactionOutcome.SUCCESS);
      }).toThrow('Price must be positive');
    });

    it('should accept decimal prices', () => {
      const transaction = new Transaction(
        'user123',
        'AAPL',
        10,
        150.75,
        TransactionOutcome.SUCCESS
      );

      expect(transaction.price).toBe(150.75);
    });
  });

  describe('TransactionOutcome enum', () => {
    it('should have SUCCESS and FAILURE values', () => {
      expect(TransactionOutcome.SUCCESS).toBe('success');
      expect(TransactionOutcome.FAILURE).toBe('failure');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON format', () => {
      const transaction = new Transaction(
        'user123',
        'AAPL',
        10,
        150.50,
        TransactionOutcome.SUCCESS
      );

      const json = transaction.toJSON();

      expect(json).toMatchObject({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.50,
        outcome: 'success',
        createdAt: expect.any(Date),
      });
      expect(json.reason).toBeUndefined();
    });

    it('should include reason in JSON when present', () => {
      const transaction = new Transaction(
        'user123',
        'AAPL',
        10,
        150.50,
        TransactionOutcome.FAILURE,
        'Vendor unavailable'
      );

      const json = transaction.toJSON();

      expect(json).toMatchObject({
        userId: 'user123',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.50,
        outcome: 'failure',
        reason: 'Vendor unavailable',
        createdAt: expect.any(Date),
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of properties after creation', () => {
      const transaction = new Transaction(
        'user123',
        'AAPL',
        10,
        150.50,
        TransactionOutcome.SUCCESS
      );

      // TypeScript prevents this at compile time, but testing runtime behavior
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (transaction as any).userId = 'user456';
      }).toThrow();
    });
  });
});
