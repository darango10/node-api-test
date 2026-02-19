import { Express } from 'express';
import { logger } from '../../config/logger';

interface Route {
  method: string;
  path: string;
}

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
  name?: string;
  handle?: {
    stack: RouteLayer[];
  };
  regexp?: RegExp;
}

/**
 * Extracts and lists all registered routes from Express app
 */
export function listRoutes(app: Express): Route[] {
  const routes: Route[] = [];

  // Extract routes from Express router stack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack = (app as any)._router?.stack as RouteLayer[] | undefined;

  if (!stack) {
    return routes;
  }

  stack.forEach((middleware: RouteLayer) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods)
        .filter((method) => {
          // eslint-disable-next-line security/detect-object-injection
          const methodValue = middleware.route?.methods[method];
          return methodValue === true;
        })
        .map((method) => method.toUpperCase());

      methods.forEach((method) => {
        routes.push({
          method,
          path: middleware.route?.path || '',
        });
      });
    } else if (middleware.name === 'router' && middleware.handle?.stack) {
      // Routes registered on a Router
      middleware.handle.stack.forEach((handler: RouteLayer) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods)
            .filter((method) => {
              // eslint-disable-next-line security/detect-object-injection
              const methodValue = handler.route?.methods[method];
              return methodValue === true;
            })
            .map((method) => method.toUpperCase());

          const basePath =
            middleware.regexp
              ?.toString()
              .replace('/^\\', '')
              .replace('\\/?(?=\\/|$)/i', '')
              .replace(/\\\//g, '/') || '';

          methods.forEach((method) => {
            routes.push({
              method,
              path: basePath + (handler.route?.path || ''),
            });
          });
        }
      });
    }
  });

  return routes;
}

/**
 * Logs all available endpoints in a formatted table
 */
export function logAvailableEndpoints(app: Express): void {
  const routes = listRoutes(app);

  if (routes.length === 0) {
    logger.warn('No routes registered');
    return;
  }

  // Sort routes by path, then method
  routes.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });

  logger.info('\n📍 Available Endpoints:');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  routes.forEach((route) => {
    const methodColor = getMethodColor(route.method);
    const paddedMethod = route.method.padEnd(6);
    logger.info(`  ${methodColor}${paddedMethod}\x1b[0m  ${route.path}`);
  });

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Returns ANSI color code for HTTP method
 */
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '\x1b[32m', // Green
    POST: '\x1b[33m', // Yellow
    PUT: '\x1b[34m', // Blue
    PATCH: '\x1b[36m', // Cyan
    DELETE: '\x1b[31m', // Red
  };

  // Safe object access with known HTTP method keys
  // eslint-disable-next-line security/detect-object-injection
  const color = colors[method];
  return color || '\x1b[37m'; // White default
}
