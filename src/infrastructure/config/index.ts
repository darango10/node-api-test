import { z } from 'zod';
import { logger } from './logger.js';

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535))
    .default('3000'),
  MONGODB_URI: z.string().url().min(1),
  VENDOR_API_URL: z.string().url().min(1),
  VENDOR_API_KEY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  REPORT_RECIPIENTS: z.string().min(1).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).pipe(z.number())
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export const loadConfig = (): Config => {
  if (config) {
    return config;
  }

  try {
    config = configSchema.parse(process.env);
    logger.info('Configuration loaded and validated successfully');
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ errors: error.errors }, 'Configuration validation failed');
      throw new Error(
        `Configuration validation failed: ${JSON.stringify(error.errors)}`
      );
    }
    throw error;
  }
};

export const getConfig = (): Config => {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return config;
};
