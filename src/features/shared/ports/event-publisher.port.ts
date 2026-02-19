/**
 * Payload for purchase-completed event (real-time channel).
 * Sent once per successful stock purchase to scoped subscribers.
 * Per data-model: type, userId, symbol, quantity, success required; price, total, timestamp optional.
 */
export interface PurchaseCompletedPayload {
  type: 'purchase_completed';
  userId: string;
  symbol: string;
  quantity: number;
  success: true;
  price?: number;
  total?: number;
  timestamp?: string;
}

/**
 * Port for publishing real-time events (e.g. WebSocket).
 * Implementation sends to connections registered for payload.userId; best-effort, fire-and-forget.
 */
export interface EventPublisherPort {
  /**
   * Publish a purchase-completed event to subscribers for the given user.
   * Called after a successful purchase is committed and persisted.
   * @param payload - Event payload (userId, symbol, quantity, success, price?, total?, timestamp?)
   */
  publishPurchaseCompleted(payload: PurchaseCompletedPayload): void | Promise<void>;
}
