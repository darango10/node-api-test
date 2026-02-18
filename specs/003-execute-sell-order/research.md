# Research: Execute Sell Order

**Feature**: 003-execute-sell-order  
**Date**: 2025-02-18

## 1. Atomic portfolio reduction (no oversell)

**Decision**: Add a dedicated port method `reducePosition(userId, symbol, quantity): Promise<number>` that atomically decrements the position by `quantity` and returns the new quantity, or throws/returns an error if the user holds fewer shares than requested. Implement in MongoDB using a single `findOneAndUpdate` with `$inc: { 'positions.$.quantity': -quantity }` and a condition that the position exists and `positions.$.quantity >= quantity` (or equivalent).

**Rationale**: The current `upsertPosition` only accepts positive deltas and is designed for buys. Selling requires an atomic "decrement if sufficient" to prevent overselling under concurrency. A separate method keeps the contract clear and allows the implementation to use MongoDB's atomic operators.

**Alternatives considered**:
- Allow negative delta in `upsertPosition`: would complicate the existing buy flow and blur the contract; rejected.
- Application-level read-then-write: race condition risk; rejected.
- Pessimistic locking (lock by userId/symbol): adds complexity and potential deadlocks; atomic update is simpler.

---

## 2. Transaction entity: reuse for sell vs new type

**Decision**: Reuse the existing `Transaction` entity and persistence for sell attempts. Add an optional `type?: 'purchase' | 'sell'` (or equivalent) so the daily report can distinguish purchase vs sell transactions. For sell, `price` is the execution (market) price at time of sell.

**Rationale**: Spec states "aligned with existing transaction recording for purchases" and "sell outcomes are included in the same daily report". One collection and one entity reduce code and schema drift. A discriminator field supports reporting and future filtering.

**Alternatives considered**:
- Separate SellTransaction entity and collection: duplicates structure and reporting logic; rejected.
- No type field: report could still list all transactions; adding a type later is a small migration; acceptable but adding type now is minimal cost and clearer.

---

## 3. Price tolerance for sell

**Decision**: Reuse the same tolerance (2%) and the existing domain service `isWithinTolerance(requestedPrice, currentPrice, tolerancePercent)`. For sell, "requested" price is the current market price at execution time (we fetch once and use it as both the execution price and the value to check within tolerance). So the check is effectively "current price is within 2% of itself" unless we introduce a separate "requested sell price" in the future (out of scope). For market sell, we treat execution price as the vendor's current price and do not allow execution if the vendor is unavailable (no price); no separate tolerance check needed for a single fetch, but we retain the same tolerance constant for consistency and for any future extension (e.g. limit sell).

**Rationale**: Spec says "same conceptual tolerance used for buys (e.g. execution price within X% of current market price) applies to sells". Reusing the same constant and service keeps behavior consistent. For a pure market sell with a single price fetch, the only check is "we have a current price"; if we later support a client-provided "max slippage" we can plug in the same tolerance helper.

**Alternatives considered**:
- Different tolerance for sell: spec says same as buys; rejected.
- No tolerance for market sell: acceptable for MVP since we execute at fetched price; documenting reuse of tolerance for consistency and future use.

---

## 4. Error responses and HTTP status codes

**Decision**: Use 400 for validation errors (missing/invalid fields, non-integer quantity). Use 400 for insufficient shares (with `currentHeldQuantity` in body). Use 400 for price out of tolerance. Use 502 when the vendor is unavailable or market cannot be determined. Use 404 only if we explicitly treat "user not found" separately from "no position" (optional); otherwise insufficient shares (including zero position) as 400 with `currentHeldQuantity: 0` is sufficient.

**Rationale**: Aligns with existing purchase controller pattern (getErrorStatusCode). Client can display error message and currentHeldQuantity for all insufficient-share cases.

**Alternatives considered**:
- 409 Conflict for insufficient shares: valid alternative; 400 with clear message and held quantity is simpler and consistent with price-out-of-tolerance as 400.

---

## 5. Vendor port usage for sell

**Decision**: For sell, use only `StockVendorPort.getCurrentPrice(symbol)`. Do not call `executeBuy` or any vendor "sell" API. If `getCurrentPrice` throws or the vendor is unavailable, reject the sell with a market-unavailable error (502). No new vendor methods required.

**Rationale**: Clarification from spec: "We only update: validate position, get current price from vendor, update our portfolio and record the transaction; no vendor sell API."

**Alternatives considered**: None; spec is explicit.
