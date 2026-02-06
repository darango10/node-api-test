/**
 * Dependency injection container / factory for ports.
 * Adapters (StockVendor, PortfolioRepository, etc.) will be registered in Phase 2+.
 * Controllers and use cases receive dependencies from here.
 */

/** Container holds port implementations; getters added in Phase 2+. */
export type Container = Record<string, unknown>;

/**
 * Creates and returns the application container with all adapters wired.
 * Config is read from environment (validated in Phase 2).
 */
export function createContainer(): Container {
  const container: Container = {};
  return container;
}
