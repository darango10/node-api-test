import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../domain/errors/index.js';
import { logger } from '../../config/logger.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.error(
      {
        err,
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
      },
      'Operational error'
    );

    res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
    return;
  }

  // Unknown errors
  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
    },
    'Unexpected error'
  );

  res.status(500).json({
    error: {
      message: 'Internal server error',
      statusCode: 500,
    },
  });
};
