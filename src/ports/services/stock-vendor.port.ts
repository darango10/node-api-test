/**
 * Port for stock vendor external API
 */

export interface Stock {
  symbol: string;
  price: number;
  name?: string;
}

export interface ListStocksResponse {
  stocks: Stock[];
  nextToken?: string;
}

export interface StockVendorPort {
  listStocks(params?: {
    nextToken?: string;
    limit?: number;
  }): Promise<ListStocksResponse>;

  getCurrentPrice(symbol: string): Promise<number>;
}
