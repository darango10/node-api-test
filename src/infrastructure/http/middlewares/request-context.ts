import { AsyncLocalStorage } from 'node:async_hooks';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

interface RequestContext {
  correlationId: string;
  userId?: string;
  startTime: number;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = (req.headers['x-correlation-id'] as string) || 
                        randomUUID();
  
  const context: RequestContext = {
    correlationId,
    userId: req.params.userId,
    startTime: Date.now(),
  };

  res.setHeader('x-correlation-id', correlationId);

  asyncLocalStorage.run(context, () => {
    next();
  });
};

export const getRequestContext = (): RequestContext | undefined => {
  return asyncLocalStorage.getStore();
};
