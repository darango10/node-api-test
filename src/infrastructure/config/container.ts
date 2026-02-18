import { getConfig } from './index';
import { StockVendorAdapter } from '../external/stock-vendor.adapter';
import { StockVendorPort } from '../../ports/services/stock-vendor.port';
import { ListStocks } from '../../application/use-cases/list-stocks';
import { PortfolioRepositoryImpl } from '../persistence/portfolio.repository';
import { PortfolioRepositoryPort } from '../../ports/repositories/portfolio-repository.port';
import { GetPortfolio } from '../../application/use-cases/get-portfolio';
import { TransactionRepositoryImpl } from '../persistence/transaction.repository';
import { TransactionRepositoryPort } from '../../ports/repositories/transaction-repository.port';
import { ExecutePurchase } from '../../application/use-cases/execute-purchase';
import { ExecuteSell } from '../../application/use-cases/execute-sell';

/**
 * Dependency injection container / factory for ports.
 * Adapters (StockVendor, PortfolioRepository, etc.) are registered here.
 * Controllers and use cases receive dependencies from this container.
 */

export interface Container {
  stockVendorPort: StockVendorPort;
  portfolioRepository: PortfolioRepositoryPort;
  transactionRepository: TransactionRepositoryPort;
  listStocksUseCase: ListStocks;
  getPortfolioUseCase: GetPortfolio;
  executePurchaseUseCase: ExecutePurchase;
  executeSellUseCase: ExecuteSell;
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

  const portfolioRepository = new PortfolioRepositoryImpl();
  const transactionRepository = new TransactionRepositoryImpl();

  // Application use cases
  const listStocksUseCase = new ListStocks(stockVendorPort);
  const getPortfolioUseCase = new GetPortfolio(portfolioRepository);
  const executePurchaseUseCase = new ExecutePurchase(
    stockVendorPort,
    portfolioRepository,
    transactionRepository
  );

  const executeSellUseCase = new ExecuteSell(
    stockVendorPort,
    portfolioRepository,
    transactionRepository
  );

  return {
    stockVendorPort,
    portfolioRepository,
    transactionRepository,
    listStocksUseCase,
    getPortfolioUseCase,
    executePurchaseUseCase,
    executeSellUseCase,
  };
}
