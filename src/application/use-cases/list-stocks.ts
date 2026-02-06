import { Stock } from '../../domain/entities/stock';
import { StockVendorPort } from '../../ports/services/stock-vendor.port';

/**
 * Request for listing stocks
 */
export interface ListStocksRequest {
  nextToken?: string;
  limit?: number;
}

/**
 * Response from listing stocks
 */
export interface ListStocksResponse {
  stocks: Stock[];
  nextToken: string | null;
}

/**
 * Use case for listing available stocks from vendor
 */
export class ListStocks {
  constructor(private readonly stockVendorPort: StockVendorPort) {}

  /**
   * Execute the list stocks use case
   * @param request - The list stocks request with optional pagination
   * @returns Promise with stocks and nextToken
   * @throws Error if vendor is unavailable
   */
  async execute(request: ListStocksRequest): Promise<ListStocksResponse> {
    const { nextToken, limit = 20 } = request;

    const result = await this.stockVendorPort.listStocks({
      nextToken,
      limit,
    });

    return {
      stocks: result.stocks,
      nextToken: result.nextToken,
    };
  }
}
