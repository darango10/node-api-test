/**
 * Application entry point
 */
// Load environment variables from .env file (must be first)
import 'dotenv/config';

import { loadConfig } from './infrastructure/config/index.js';
import { logger } from './infrastructure/config/logger.js';
import { connectDatabase, disconnectDatabase } from './infrastructure/persistence/mongo-connection.js';
import { createApp } from './infrastructure/http/app.js';
import { logAvailableEndpoints } from './infrastructure/http/utils/list-routes.js';
import { Server } from 'http';

// Global error handlers
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ err: error }, 'Uncaught Exception');
  process.exit(1);
});

const startServer = async (): Promise<Server> => {
  try {
    // Load and validate configuration
    const config = loadConfig();

    // Connect to MongoDB
    await connectDatabase(config.MONGODB_URI);

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info(`🚀 Server listening on port ${config.PORT}`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
      logger.info(`📚 API Documentation: http://localhost:${config.PORT}/api-docs`);

      // List all available endpoints
      logAvailableEndpoints(app);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error({ err: error }, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

// Start the server
startServer();
