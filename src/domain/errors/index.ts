/**
 * Custom error classes for the application
 * All errors extend the base Error class
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true);
  }
}

export class DomainError extends AppError {
  constructor(message: string) {
    super(message, 422, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    message: string = 'External service unavailable',
    statusCode: number = 502
  ) {
    super(message, statusCode, true);
  }
}

export class InsufficientSharesError extends AppError {
  public readonly currentHeldQuantity: number;

  constructor(message: string, currentHeldQuantity: number) {
    super(message, 400, true);
    this.currentHeldQuantity = currentHeldQuantity;
  }
}
