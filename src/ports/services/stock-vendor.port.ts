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

export interface BuyStockRequest {
  symbol: string;
  quantity: number;
  price: number;
}

export interface BuyStockResponse {
  success: boolean;
  order?: {
    symbol: string;
    quantity: number;
    price: number;
    total: number;
  };
  message?: string;
}

export interface StockVendorPort {
  listStocks(params: ListStocksRequest): Promise<ListStocksResponse>;

  getCurrentPrice(symbol: string): Promise<number>;

  executeBuy(request: BuyStockRequest): Promise<BuyStockResponse>;
}
