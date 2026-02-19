import rateLimit from 'express-rate-limit';

const generalWindowMs = process.env.RATE_LIMIT_WINDOW_MS
  ? Number(process.env.RATE_LIMIT_WINDOW_MS)
  : 15 * 60 * 1000; // 15 minutes
const generalMax = process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 100;

export const generalRateLimiter = rateLimit({
  windowMs: generalWindowMs,
  max: generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

const purchaseWindowMs = process.env.PURCHASE_RATE_LIMIT_WINDOW_MS
  ? Number(process.env.PURCHASE_RATE_LIMIT_WINDOW_MS)
  : 60 * 1000; // 1 minute
const purchaseMax = process.env.PURCHASE_RATE_LIMIT_MAX
  ? Number(process.env.PURCHASE_RATE_LIMIT_MAX)
  : 10;

export const purchaseRateLimiter = rateLimit({
  windowMs: purchaseWindowMs,
  max: purchaseMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many purchase requests, please try again later',
  skipSuccessfulRequests: false,
});
