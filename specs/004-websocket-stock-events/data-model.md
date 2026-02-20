# Data Model: Real-Time Events on Stock Purchase

**Feature**: 004-websocket-stock-events  
**Date**: 2025-02-19

## Scope

This feature does not introduce new persisted entities. It defines the **shape of the purchase-completed event** sent over the real-time channel and how **subscribers** are associated with users. No new database collections or tables.

---

## Event payload (in-memory / wire only)

**Purchase-completed event** — sent once per successful stock purchase to scoped subscribers.


| Field     | Type    | Required | Description                                             |
| --------- | ------- | -------- | ------------------------------------------------------- |
| type      | string  | yes      | Literal `"purchase_completed"` for routing.             |
| userId    | string  | yes      | User who performed the purchase.                        |
| symbol    | string  | yes      | Stock symbol (e.g. `AAPL`).                             |
| quantity  | number  | yes      | Number of shares purchased (positive integer).          |
| success   | boolean | yes      | Always `true` for this event (only emitted on success). |
| price     | number  | optional | Execution price per share.                              |
| total     | number  | optional | Total cost (quantity × price).                          |
| timestamp | string  | optional | ISO 8601 time when the event was emitted (server time). |


- Validation: `userId`, `symbol` non-empty; `quantity` positive integer; `price`/`total` positive if present.
- Events are **not** stored; they are best-effort push only.

---

## Subscriber / connection (in-memory only)

- **Subscriber**: A single WebSocket connection that has been **associated with a userId** (via query param or first message).
- **Storage**: In-process only — e.g. `Map<userId, Set<WebSocket>>` so that when `publishPurchaseCompleted(userId, payload)` is called, the implementation sends the payload to all sockets in the set for that `userId`.
- **Lifecycle**: On connection, server validates/attaches userId and adds the socket to the set; on close/error, remove from the set. No persistence.

---

## Port (interface)

**EventPublisherPort** (or **PurchaseEventPublisherPort**)

- `publishPurchaseCompleted(payload: PurchaseCompletedPayload): void | Promise<void>`
  - Payload: `{ userId, symbol, quantity, success: true, price?, total?, timestamp? }`
  - Implementation sends to all connections currently registered for `payload.userId`; may be fire-and-forget (best-effort).
- Optional: `publishPurchaseCompleted` returns `Promise<void>` if the adapter needs async work (e.g. logging); use case can await or not depending on whether purchase response should wait (spec says purchase still succeeds if event fails, so optional await).

---

## Integration with existing entities

- **Transaction**: Already has `userId`, `symbol`, `quantity`, `price`, `outcome`. After a successful purchase, the use case has a `Transaction` with `outcome === SUCCESS`; it builds the event payload from that (and optionally from vendor order total) and calls the port. No change to Transaction schema.
- **Portfolio / Position**: Unchanged; no event-specific fields.

