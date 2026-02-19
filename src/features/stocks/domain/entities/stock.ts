/**
 * Stock entity representing a tradeable stock from the vendor.
 * Framework-agnostic value object.
 */
export interface Stock {
  symbol: string;
  price: number;
}

/**
 * Validation result for Stock entity
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a Stock entity
 * @param stock - The stock to validate
 * @returns ValidationResult with isValid flag and errors array
 */
export function validateStock(stock: Stock): ValidationResult {
  const errors: string[] = [];

  // Validate symbol
  if (!stock.symbol || stock.symbol.trim().length === 0) {
    errors.push('Symbol is required');
  } else if (stock.symbol !== stock.symbol.trim()) {
    errors.push('Symbol cannot contain whitespace');
  }

  // Validate price
  if (typeof stock.price !== 'number' || stock.price <= 0) {
    errors.push('Price must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a validated Stock entity
 * @param symbol - Stock symbol
 * @param price - Stock price
 * @returns Stock entity
 * @throws Error if validation fails
 */
export function createStock(symbol: string, price: number): Stock {
  const stock: Stock = { symbol, price };
  const validation = validateStock(stock);

  if (!validation.isValid) {
    throw new Error(`Invalid stock: ${validation.errors.join(', ')}`);
  }

  return stock;
}
