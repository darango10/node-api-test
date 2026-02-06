import { getConfig } from './index';
import { StockVendorAdapter } from '../external/stock-vendor.adapter';
import { StockVendorPort } from '../../ports/services/stock-vendor.port';
import { ListStocks } from '../../application/use-cases/list-stocks';

/**
 * Dependency injection container / factory for ports.
 * Adapters (StockVendor, PortfolioRepository, etc.) are registered here.
 * Controllers and use cases receive dependencies from this container.
 */

export interface Container {
  stockVendorPort: StockVendorPort;
  listStocksUseCase: ListStocks;
}

/**
 * Creates and returns the application container with all adapters wired.
 * Config is read from environment (validated before this is called).
 */
export function createContainer(): Container {
  const config = getConfig();

  // Infrastructure adapters
  const stockVendorPort = new StockVendorAdapter(
    config.VENDOR_API_URL,
    config.VENDOR_API_KEY || '', // API key for vendor authentication
    5000 // 5 second timeout
  );

  // Application use cases
  const listStocksUseCase = new ListStocks(stockVendorPort);

  return {
    stockVendorPort,
    listStocksUseCase,
  };
}
