import axios, { AxiosInstance } from 'axios';
import { Stock } from '../../domain/entities/stock';
import { 
  StockVendorPort, 
  ListStocksRequest, 
  ListStocksResponse 
} from '../../ports/services/stock-vendor.port';
import { logger } from '../config/logger';

/**
 * HTTP adapter for the stock vendor API
 */
export class StockVendorAdapter implements StockVendorPort {
  private readonly client: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number = 5000
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });
  }

  /**
   * List stocks from vendor API with automatic pagination
   * Fetches ALL stocks by following pagination tokens
   * @param request - Pagination request (limit is used per page)
   * @returns List of ALL stocks (paginated internally)
   * @throws Error if vendor is unavailable or returns invalid data
   */
  async listStocks(request: ListStocksRequest): Promise<ListStocksResponse> {
    try {
      const allStocks: Stock[] = [];
      let currentToken: string | undefined = request.nextToken;
      let pageCount = 0;
      const maxPages = 100; // Safety limit to prevent infinite loops

      logger.info({ limit: request.limit }, 'Starting to fetch all stocks from vendor');

      // Loop through all pages
      do {
        pageCount++;
        
        if (pageCount > maxPages) {
          logger.warn({ pageCount }, 'Reached maximum page limit');
          break;
        }

        const params: Record<string, string | number> = { limit: request.limit };
        if (currentToken) {
          params.nextToken = currentToken;
        }

        logger.debug({ page: pageCount, nextToken: currentToken }, 'Fetching page');

        const response = await this.client.get('/stocks', { params });

        // Validate response structure (vendor format: data.items, data.nextToken)
        if (!response.data?.data?.items || !Array.isArray(response.data.data.items)) {
          throw new Error('Invalid response format from vendor');
        }

        // Map vendor response to domain Stock entities
        const pageStocks: Stock[] = response.data.data.items.map(
          (item: { symbol: string; price: number; name?: string }) => ({
            symbol: item.symbol,
            price: item.price,
          })
        );

        allStocks.push(...pageStocks);

        // Get next token for pagination
        currentToken = response.data.data.nextToken;

        logger.debug(
          { 
            page: pageCount, 
            pageSize: pageStocks.length, 
            totalSoFar: allStocks.length,
            hasNextPage: !!currentToken 
          },
          'Page fetched successfully'
        );

        // Continue if there's a next token
      } while (currentToken);

      logger.info(
        { totalStocks: allStocks.length, pages: pageCount },
        'All stocks fetched successfully from vendor'
      );

      return {
        stocks: allStocks,
        nextToken: null, // Always null since we fetch all stocks
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(
        { error: err.message },
        'Failed to fetch stocks from vendor'
      );

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Vendor request timeout');
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('Vendor service unavailable');
        }
        if (error.response?.status === 404) {
          throw new Error('Vendor endpoint not found');
        }
      }

      throw new Error(
        `Failed to fetch stocks: ${err.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Get current price for a specific stock symbol
   * @param symbol - Stock symbol
   * @returns Current price
   * @throws Error if vendor is unavailable or symbol not found
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      logger.info({ symbol }, 'Fetching current price from vendor');

      const response = await this.client.get(`/stocks/${symbol}/price`);

      // Try nested data structure first (data.data.price), then fallback to data.price
      const price = response.data?.data?.price ?? response.data?.price;

      if (typeof price !== 'number') {
        throw new Error('Invalid price response from vendor');
      }

      logger.info(
        { symbol, price },
        'Price fetched successfully'
      );

      return price;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(
        { error: err.message, symbol },
        'Failed to fetch price from vendor'
      );

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Vendor request timeout');
        }
        if (error.response?.status === 404) {
          throw new Error(`Stock symbol ${symbol} not found`);
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('Vendor service unavailable');
        }
      }

      throw new Error(
        `Failed to fetch price: ${err.message || 'Unknown error'}`
      );
    }
  }
}
