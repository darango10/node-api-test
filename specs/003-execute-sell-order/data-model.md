# Data Model: Execute Sell Order

**Feature**: 003-execute-sell-order  
**Date**: 2025-02-18

## Scope

This document describes the data and persistence impact for the Execute Sell Order feature. It reuses existing entities where possible and specifies only new or changed elements.

---

## Entities (domain)

### Portfolio / Position (unchanged)

- **Portfolio**: `userId`, `positions[]`, `updatedAt`. Same as today. Source of truth for "sufficient shares" for sell.
- **Position**: `symbol`, `quantity` (non-negative integer). Reduced or removed when a sell succeeds.

No schema change. Behavior: after a successful sell, the position's quantity is decreased by the sold amount, or the position is removed (or quantity set to 0) when the full holding is sold.

### Transaction (extended for reporting)

- **Existing fields**: `userId`, `symbol`, `quantity`, `price`, `outcome` (success | failure), `reason?`, `createdAt`.
- **New optional field**: `type?: 'purchase' | 'sell'` so the daily report (and any filtering) can distinguish purchase vs sell transactions. Default or missing can be treated as `purchase` for backward compatibility.

For a sell transaction:
- `price` = execution (market) price at time of sell.
- `quantity` = number of shares sold.
- `outcome` = success or failure; `reason` set on failure (e.g. insufficient shares, market unavailable, price out of tolerance).

### Sell order (request) — in-memory only

- **userId** (string, from path)
- **symbol** (string, required)
- **quantity** (positive integer, required)

Validated before use case runs. No persistence of the "order" itself; only the outcome is persisted as a Transaction.

---

## Ports (interfaces)

### PortfolioRepositoryPort (extended)

**Existing**:
- `getByUserId(userId: string): Promise<Portfolio | null>`
- `upsertPosition(userId: string, symbol: string, quantityDelta: number): Promise<void>` (positive delta only, for buys)

**New**:
- `reducePosition(userId: string, symbol: string, quantity: number): Promise<void>`
  - Semantics: Atomically reduce the position for `(userId, symbol)` by `quantity`. If the user has no position or holds fewer than `quantity`, the method throws (e.g. an operational error with `currentHeldQuantity` so the use case can return it in the error response).
  - Implementation must ensure no overselling under concurrent sell (and buy/sell) requests (e.g. MongoDB atomic update with condition).

### TransactionRepositoryPort (unchanged)

- `save(transaction: Transaction): Promise<void>` — used to record sell attempts (success and failure). Transaction may include `type: 'sell'` when the entity is extended.
- `findSince(sinceDate: Date): Promise<Transaction[]>` — used by daily report; will include sell transactions once type is set.

### StockVendorPort (unchanged)

- `getCurrentPrice(symbol: string): Promise<number>` — used by sell use case to get execution price and to infer market availability (if call fails, treat as market unavailable).
- No call to `executeBuy` or any sell API from the vendor.

---

## Validation rules (sell request)

| Field     | Rule |
|----------|------|
| userId   | Present, non-empty (from path). |
| symbol   | Non-empty, must refer to a known tradable stock (same as purchase). |
| quantity | Positive integer (whole shares only). Fractional or non-integer rejected. |

---

## Persistence (MongoDB)

### Portfolio collection

- No schema change. Positions are updated in place: `quantity` is decremented by the sold amount via an atomic update (e.g. `$inc: { 'positions.$.quantity': -quantity }` with a condition that the matching position has `quantity >= quantity` to sell). If the result would be 0, either set the position to 0 or remove the element from `positions` array (implementation choice; active positions are those with quantity > 0).

### Transaction collection

- Optional new field: `type: 'purchase' | 'sell'`. Existing documents remain valid (no type or type `purchase`). New sell records should set `type: 'sell'`.

---

## State transitions (sell flow)

1. **Request received** → Validate input (userId, symbol, quantity). If invalid → 400, no persistence.
2. **Load portfolio** → Get user portfolio. If no position for symbol or position.quantity < request.quantity → Reject with insufficient shares (include currentHeldQuantity in response), record failed transaction with reason, no portfolio update.
3. **Get current price** → Call vendor `getCurrentPrice(symbol)`. If vendor fails or unavailable → Reject with market unavailable, record failed transaction, no portfolio update.
4. **Price tolerance** → For market sell, execution price is the fetched price. Optionally validate with same tolerance as buy (research: single fetch makes this redundant for MVP; keep for consistency). If out of tolerance → Reject, record failed transaction, no portfolio update.
5. **Execute sell** → Call `reducePosition(userId, symbol, quantity)`. On success → Record successful transaction (price = execution price, type = 'sell'), return 201 with execution details.
6. **Concurrency** → reducePosition must be atomic so that concurrent sells (or buy+sell) for the same user/symbol do not lead to overselling or inconsistent quantities.

---

## Error payload (insufficient shares)

When the user has no position or holds fewer shares than requested, the API response must include:

- **error**: Human-readable message (e.g. "Insufficient shares").
- **currentHeldQuantity**: number (0 or the actual held quantity for that symbol). Required by spec.

This may be represented as a dedicated error code (e.g. `INSUFFICIENT_SHARES`) and a body shape documented in the API contract.
