/**
 * Port for sending failed invoice payloads to a dead-letter path (outbound).
 * Implemented by file-based or queue adapter; consumed when VTEX call fails after max retries.
 */

/** Inbound order status payload (same shape as webhook body). */
export interface OrderStatusPayload {
  orderId: string;
  orderStatus: string;
  items: Array<{
    id: string;
    price: number;
    quantity: number;
    description: string;
  }>;
}

/** Optional metadata when routing to DLQ (e.g. attempt count, last error). */
export interface DLQMetadata {
  orderId?: string;
  attemptCount?: number;
  lastError?: string;
  timestamp?: string;
}

export interface DLQPort {
  /**
   * Send a failed payload to the dead-letter path for manual intervention.
   * @param payload - Original order status update payload that failed after max retries.
   * @param metadata - Optional context (orderId, attempt count, last error, timestamp).
   */
  sendFailedPayload(payload: OrderStatusPayload, metadata?: DLQMetadata): Promise<void>;
}
