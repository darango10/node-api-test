import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  InsufficientSharesError,
} from '../../../src/domain/errors';

describe('Domain Errors', () => {
  describe('InsufficientSharesError', () => {
    it('should extend AppError and have statusCode 400', () => {
      const err = new InsufficientSharesError('Insufficient shares', 30);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.isOperational).toBe(true);
    });

    it('should expose currentHeldQuantity in response', () => {
      const err = new InsufficientSharesError('You have 30 shares', 30);
      expect(err.currentHeldQuantity).toBe(30);
      expect(err.message).toBe('You have 30 shares');
    });

    it('should support zero for no position', () => {
      const err = new InsufficientSharesError('No position', 0);
      expect(err.currentHeldQuantity).toBe(0);
    });
  });

  describe('ValidationError', () => {
    it('should have statusCode 400', () => {
      const err = new ValidationError('Invalid input');
      expect(err.statusCode).toBe(400);
    });
  });

  describe('NotFoundError', () => {
    it('should have statusCode 404', () => {
      const err = new NotFoundError();
      expect(err.statusCode).toBe(404);
    });
  });
});
