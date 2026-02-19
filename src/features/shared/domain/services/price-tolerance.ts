/**
 * Price tolerance domain service
 *
 * Validates if a requested price is within acceptable tolerance range
 * of the current market price.
 */

/**
 * Check if requested price is within tolerance of current price
 *
 * @param requestedPrice - The price the user wants to pay
 * @param currentPrice - The current market price
 * @param tolerancePercent - Tolerance as a decimal (e.g., 0.02 for 2%)
 * @returns true if requested price is within tolerance, false otherwise
 *
 * @example
 * isWithinTolerance(100, 100, 0.02) // true - exact match
 * isWithinTolerance(101, 100, 0.02) // true - within 2%
 * isWithinTolerance(103, 100, 0.02) // false - more than 2% above
 * isWithinTolerance(98, 100, 0.02) // true - within 2%
 * isWithinTolerance(97, 100, 0.02) // false - more than 2% below
 */
export function isWithinTolerance(
  requestedPrice: number,
  currentPrice: number,
  tolerancePercent: number
): boolean {
  // Handle edge case where current price is zero
  if (currentPrice === 0) {
    return requestedPrice === 0;
  }

  // Calculate tolerance amount
  const toleranceAmount = currentPrice * tolerancePercent;

  // Calculate bounds
  const lowerBound = currentPrice - toleranceAmount;
  const upperBound = currentPrice + toleranceAmount;

  // Check if requested price is within bounds (inclusive)
  return requestedPrice >= lowerBound && requestedPrice <= upperBound;
}

/**
 * Calculate the tolerance range for a given price
 *
 * @param currentPrice - The current market price
 * @param tolerancePercent - Tolerance as a decimal (e.g., 0.02 for 2%)
 * @returns Object with lower and upper bounds
 */
export function getToleranceRange(
  currentPrice: number,
  tolerancePercent: number
): { lowerBound: number; upperBound: number } {
  const toleranceAmount = currentPrice * tolerancePercent;

  return {
    lowerBound: currentPrice - toleranceAmount,
    upperBound: currentPrice + toleranceAmount,
  };
}
