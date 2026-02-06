import { Router, Request, Response } from 'express';

const router = Router();

// Simple Prometheus-compatible metrics
router.get('/metrics', (req: Request, res: Response) => {
  const metrics = [
    '# HELP nodejs_process_uptime_seconds Node.js process uptime in seconds',
    '# TYPE nodejs_process_uptime_seconds gauge',
    `nodejs_process_uptime_seconds ${process.uptime()}`,
    '',
    '# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes',
    '# TYPE nodejs_memory_usage_bytes gauge',
    `nodejs_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
    `nodejs_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}`,
    `nodejs_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}`,
    `nodejs_memory_usage_bytes{type="external"} ${process.memoryUsage().external}`,
    '',
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});

export default router;
