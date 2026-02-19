import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi, type Mock } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { ExecutePurchase } from '../../src/features/purchases/application/use-cases/execute-purchase';
import { PortfolioRepositoryImpl } from '../../src/features/portfolio/infrastructure/repositories/portfolio.repository';
import { TransactionRepositoryImpl } from '../../src/features/shared/infrastructure/repositories/transaction.repository';
import { WebSocketServerAdapter } from '../../src/features/shared/infrastructure/websocket/websocket-server.adapter';
import type {
  StockVendorPort,
  BuyStockRequest,
  BuyStockResponse,
} from '../../src/features/stocks/ports/services/stock-vendor.port';
import { PortfolioModel } from '../../src/features/portfolio/infrastructure/repositories/portfolio.model';
import { TransactionModel } from '../../src/features/shared/infrastructure/repositories/transaction.model';

type MockedStockVendorPort = StockVendorPort & {
  listStocks: Mock;
  getCurrentPrice: Mock<(symbol: string) => Promise<number>>;
  executeBuy: Mock<(request: BuyStockRequest) => Promise<BuyStockResponse>>;
};

describe('WebSocket purchase_completed event (US1)', () => {
  let mongoServer: MongoMemoryServer;
  let httpServer: ReturnType<typeof createServer>;
  let wsAdapter: WebSocketServerAdapter;
  let executePurchase: ExecutePurchase;
  let portfolioRepository: PortfolioRepositoryImpl;
  let transactionRepository: TransactionRepositoryImpl;
  let mockStockVendorPort: MockedStockVendorPort;
  let serverPort: number;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 30000);

  afterAll(async () => {
    wsAdapter?.close();
    httpServer?.close();
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await PortfolioModel.deleteMany({});
    await TransactionModel.deleteMany({});

    portfolioRepository = new PortfolioRepositoryImpl();
    transactionRepository = new TransactionRepositoryImpl();
    mockStockVendorPort = {
      listStocks: vi.fn(),
      getCurrentPrice: vi.fn(),
      executeBuy: vi.fn(),
    } as MockedStockVendorPort;

    wsAdapter = new WebSocketServerAdapter();
    executePurchase = new ExecutePurchase(
      mockStockVendorPort,
      portfolioRepository,
      transactionRepository,
      wsAdapter
    );

    httpServer = createServer((_req, res) => res.end());
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
    wsAdapter.attachToServer(httpServer);
  });

  afterEach(() => {
    wsAdapter?.close();
    httpServer?.close();
  });

  const mockVendorSuccess = (symbol: string, quantity: number, price: number) => {
    mockStockVendorPort.getCurrentPrice.mockResolvedValue(price);
    mockStockVendorPort.executeBuy.mockResolvedValue({
      success: true,
      order: { symbol, quantity, price, total: quantity * price },
      message: 'Order placed successfully',
    });
  };

  it('should receive exactly one purchase_completed message when user completes a successful purchase', async () => {
    const userId = 'user-ws-1';
    const symbol = 'AAPL';
    const quantity = 5;
    const price = 150.0;

    const messages: unknown[] = [];
    const client = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?userId=${userId}`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', resolve);
      client.on('error', reject);
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
    });

    mockVendorSuccess(symbol, quantity, price);

    const result = await executePurchase.execute({ userId, symbol, quantity, price });
    expect(result.success).toBe(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: 'purchase_completed',
      userId,
      symbol,
      quantity,
      success: true,
      price,
      total: quantity * price,
    });

    client.close();
  });
});
