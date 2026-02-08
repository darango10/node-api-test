import rateLimit from 'express-rate-limit';

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

export const purchaseRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit to 10 purchase requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many purchase requests, please try again later',
  skipSuccessfulRequests: false,
});
