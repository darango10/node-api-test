/**
 * Port for stock vendor external API
 */

export interface Stock {
  symbol: string;
  price: number;
  name?: string;
}

export interface ListStocksRequest {
  nextToken?: string;
  limit: number;
}

export interface ListStocksResponse {
  stocks: Stock[];
  nextToken: string | null;
}

export interface StockVendorPort {
  listStocks(params: ListStocksRequest): Promise<ListStocksResponse>;

  getCurrentPrice(symbol: string): Promise<number>;
}
