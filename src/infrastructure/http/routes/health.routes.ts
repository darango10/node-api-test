import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    checks: {
      liveness: 'ok',
      readiness: 'ok',
      mongodb: 'unknown',
    },
  };

  try {
    if (mongoose.connection.readyState === 1) {
      health.checks.mongodb = 'connected';
    } else if (mongoose.connection.readyState === 2) {
      health.checks.mongodb = 'connecting';
      health.checks.readiness = 'degraded';
    } else {
      health.checks.mongodb = 'disconnected';
      health.checks.readiness = 'fail';
      health.status = 'degraded';
    }
  } catch {
    health.checks.mongodb = 'error';
    health.checks.readiness = 'fail';
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
