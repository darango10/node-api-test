import { getConfig } from './index';
import { StockVendorAdapter } from '../../../stocks/infrastructure/adapters/stock-vendor.adapter';
import { StockVendorPort } from '../../../stocks/ports/services/stock-vendor.port';
import { ListStocks } from '../../../stocks/application/use-cases/list-stocks';
import { PortfolioRepositoryImpl } from '../../../portfolio/infrastructure/repositories/portfolio.repository';
import { PortfolioRepositoryPort } from '../../../portfolio/ports/repositories/portfolio-repository.port';
import { GetPortfolio } from '../../../portfolio/application/use-cases/get-portfolio';
import { TransactionRepositoryImpl } from '../repositories/transaction.repository';
import { TransactionRepositoryPort } from '../../ports/repositories/transaction-repository.port';
import { ExecutePurchase } from '../../../purchases/application/use-cases/execute-purchase';
import { ExecuteSell } from '../../../sales/application/use-cases/execute-sell';
import { WebSocketServerAdapter } from '../websocket/websocket-server.adapter';

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
  websocketAdapter: WebSocketServerAdapter;
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
  const websocketAdapter = new WebSocketServerAdapter();

  // Application use cases
  const listStocksUseCase = new ListStocks(stockVendorPort);
  const getPortfolioUseCase = new GetPortfolio(portfolioRepository);
  const executePurchaseUseCase = new ExecutePurchase(
    stockVendorPort,
    portfolioRepository,
    transactionRepository,
    websocketAdapter
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
    websocketAdapter,
  };
}
