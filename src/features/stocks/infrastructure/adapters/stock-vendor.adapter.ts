import axios, { AxiosInstance } from 'axios';
import { Stock } from '../../domain/entities/stock';
import {
  StockVendorPort,
  ListStocksRequest,
  ListStocksResponse,
  BuyStockRequest,
  BuyStockResponse,
} from '../../ports/services/stock-vendor.port';
import { logger } from '../../../shared/infrastructure/config/logger';

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

        // Log vendor response
        logger.debug(
          {
            page: pageCount,
            statusCode: response.status,
            itemsCount: response.data?.data?.items?.length || 0,
            hasNextToken: !!response.data?.data?.nextToken,
          },
          'Vendor response received for listStocks'
        );

        // Validate response structure (vendor format: data.items, data.nextToken)
        if (!response.data?.data?.items || !Array.isArray(response.data.data.items)) {
          logger.error({ responseData: response.data }, 'Invalid response format from vendor');
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
            hasNextPage: !!currentToken,
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

      if (axios.isAxiosError(error)) {
        // Log detailed vendor error response
        logger.error(
          {
            error: err.message,
            statusCode: error.response?.status,
            vendorResponse: error.response?.data,
            errorCode: error.code,
          },
          'Failed to fetch stocks from vendor'
        );

        if (error.code === 'ECONNABORTED') {
          throw new Error('Vendor request timeout');
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('Vendor service unavailable');
        }
        if (error.response?.status === 404) {
          throw new Error('Vendor endpoint not found');
        }
      } else {
        // Non-axios error
        logger.error({ error: err.message }, 'Unexpected error fetching stocks');
      }

      throw new Error(`Failed to fetch stocks: ${err.message || 'Unknown error'}`);
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

      // Fetch all stocks and find the specific symbol
      // The vendor API doesn't have a separate price endpoint
      const response = await this.client.get('/stocks', {
        params: { limit: 1000 }, // Get all stocks to search for the symbol
      });

      // Log vendor response
      logger.debug(
        {
          symbol,
          statusCode: response.status,
          totalStocks: response.data?.data?.items?.length || 0,
        },
        'Vendor response received for getCurrentPrice'
      );

      // Validate response structure
      if (!response.data?.data?.items || !Array.isArray(response.data.data.items)) {
        logger.error(
          { symbol, responseData: response.data },
          'Invalid response format from vendor for getCurrentPrice'
        );
        throw new Error('Invalid response format from vendor');
      }

      // Find the stock by symbol
      const stock = response.data.data.items.find(
        (item: { symbol: string; price: number }) =>
          item.symbol.toUpperCase() === symbol.toUpperCase()
      );

      if (!stock) {
        throw new Error(`Stock symbol ${symbol} not found`);
      }

      if (typeof stock.price !== 'number') {
        throw new Error('Invalid price response from vendor');
      }

      logger.info({ symbol, price: stock.price }, 'Price fetched successfully');

      return stock.price;
    } catch (error: unknown) {
      const err = error as Error;

      if (axios.isAxiosError(error)) {
        // Log detailed vendor error response
        logger.error(
          {
            error: err.message,
            symbol,
            statusCode: error.response?.status,
            vendorResponse: error.response?.data,
            errorCode: error.code,
          },
          'Failed to fetch price from vendor'
        );

        if (error.code === 'ECONNABORTED') {
          throw new Error('Vendor request timeout');
        }
        if (error.response?.status === 403) {
          throw new Error('Vendor authentication failed - invalid or expired API key');
        }
        if (error.response?.status === 404) {
          throw new Error(`Stock symbol ${symbol} not found`);
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('Vendor service unavailable');
        }
      } else {
        // Non-axios error
        logger.error({ error: err.message, symbol }, 'Unexpected error fetching price');
      }

      throw new Error(`Failed to fetch price: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Execute a stock purchase through the vendor API
   * @param request - Buy request with symbol, quantity, and price
   * @returns Buy response with order details
   * @throws Error if vendor is unavailable or purchase fails
   */
  async executeBuy(request: BuyStockRequest): Promise<BuyStockResponse> {
    const { symbol, quantity, price } = request;

    try {
      logger.info({ symbol, quantity, price }, 'Executing buy order with vendor');

      const response = await this.client.post(`/stocks/${symbol}/buy`, {
        quantity,
        price,
      });

      // Log full vendor response for buy order
      logger.info(
        {
          symbol,
          quantity,
          price,
          statusCode: response.status,
          vendorStatus: response.data?.status,
          vendorMessage: response.data?.message,
          order: response.data?.data?.order,
        },
        'Vendor response received for buy order'
      );

      // Vendor response format: { status, message, data: { order } }
      if (response.data?.status === 200 && response.data?.data?.order) {
        const order = response.data.data.order;

        logger.info(
          { symbol, quantity, price, total: order.total },
          'Buy order executed successfully with vendor'
        );

        return {
          success: true,
          order: {
            symbol: order.symbol,
            quantity: order.quantity,
            price: order.price,
            total: order.total,
          },
          message: response.data.message || 'Order placed successfully',
        };
      }

      // Unexpected response format
      logger.error(
        { symbol, quantity, price, responseData: response.data },
        'Invalid response format from vendor buy endpoint'
      );
      throw new Error('Invalid response format from vendor buy endpoint');
    } catch (error: unknown) {
      const err = error as Error;

      if (axios.isAxiosError(error)) {
        // Log detailed vendor error response
        logger.error(
          {
            error: err.message,
            symbol,
            quantity,
            price,
            statusCode: error.response?.status,
            vendorResponse: error.response?.data,
            errorCode: error.code,
          },
          'Failed to execute buy order with vendor'
        );

        if (error.code === 'ECONNABORTED') {
          throw new Error('Vendor request timeout');
        }
        if (error.response?.status === 403) {
          throw new Error('Vendor authentication failed - invalid or expired API key');
        }
        if (error.response?.status === 404) {
          throw new Error(`Stock symbol ${symbol} not found`);
        }
        if (error.response?.status === 400) {
          // Vendor rejected the purchase (e.g., invalid price, quantity)
          const message = error.response?.data?.message || 'Invalid purchase request';
          throw new Error(`Vendor rejected purchase: ${message}`);
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('Vendor service unavailable');
        }
      } else {
        // Non-axios error
        logger.error(
          { error: err.message, symbol, quantity, price },
          'Unexpected error executing buy order'
        );
      }

      throw new Error(`Failed to execute buy: ${err.message || 'Unknown error'}`);
    }
  }
}
