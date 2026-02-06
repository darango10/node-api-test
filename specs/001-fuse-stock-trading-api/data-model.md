# Data Model: Stock Trading Backend Service

**Branch**: `001-fuse-stock-trading-api`  
**Phase**: 1 (Design & Contracts)

## Overview

Entities and persistence model for the stock trading API. Domain entities are framework-agnostic; MongoDB/Mongoose models in infrastructure map to these for persistence. User is identified by client-supplied `userId` (path); no user CRUD in scope.

---

## 1. Stock (Vendor / Read-Only)

**Source**: Vendor API (not persisted in MongoDB for catalog; may cache briefly in app if needed).

| Field    | Type   | Description                    |
|----------|--------|--------------------------------|
| symbol   | string | Stock symbol (e.g. AAPL)      |
| price    | number | Current price from vendor     |
| (others) | —      | Per vendor API response        |

**Validation**: Symbol required; price > 0 when used for purchase validation.  
**State**: No state transitions; vendor is source of truth.  
**Persistence**: Optional short-lived cache only; no Stock collection required for MVP.

---

## 2. User (Reference Only)

**Scope**: User identity is supplied by the client as a path parameter (`userId`). No user entity persisted by this service; no create/update/delete.

| Conceptual | Usage |
|------------|--------|
| userId    | string, e.g. UUID or stable id; used in routes `/users/:userId/portfolio`, `/users/:userId/purchases` |

**Validation**: Non-empty string; format can be validated (e.g. alphanumeric + hyphen).  
**Persistence**: No User collection; userId is stored only as reference in Portfolio and Transaction documents.

---

## 3. Portfolio (MongoDB)

One logical portfolio per user: list of positions (stock symbol + quantity). Updated only when a purchase **succeeds**.

**Collection**: `portfolios` (or single document per user, e.g. `userId` as unique key).

| Field     | Type   | Required | Description |
|-----------|--------|----------|-------------|
| userId    | string | yes      | User identifier (path param) |
| positions | array  | yes      | List of { symbol, quantity } |
| updatedAt | date  | yes      | Last update time             |

**Position item**:

| Field    | Type   | Description        |
|----------|--------|--------------------|
| symbol  | string | Stock symbol       |
| quantity | number | Integer ≥ 0        |

**Validation**:
- `userId`: non-empty.
- `positions[].symbol`: non-empty, allowed set or pattern per vendor.
- `positions[].quantity`: integer ≥ 0.

**State**: No explicit state machine; consistency via atomic updates on purchase (add or increment position).

**Indexes**:
- `userId` unique (one portfolio per user).

**Concurrency**: Use atomic update (e.g. `findOneAndUpdate` with `$inc` or array update) when adding/incrementing position for same user+symbol so concurrent purchases do not lose or double-count shares.

---

## 4. Transaction (Purchase Attempt) (MongoDB)

Records each purchase attempt (success or failure) for the daily report. Retention: current report window only (since last successful report or process start); older records may be discarded or archived.

**Collection**: `transactions`

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| userId     | string | yes      | User who attempted purchase |
| symbol     | string | yes      | Stock symbol               |
| quantity   | number | yes      | Requested quantity         |
| price      | number | yes      | Requested price per share  |
| outcome    | string | yes      | `success` \| `failure`     |
| reason     | string | no       | Failure reason (e.g. price out of range, vendor error) |
| createdAt  | date   | yes      | When the attempt was processed |
| (vendorTxId) | string | no    | If vendor returns transaction id |

**Validation**:
- `quantity`: integer > 0.
- `price`: number > 0.
- `outcome`: enum `success` | `failure`.

**State**: Immutable once written (no transitions).  
**Indexes**: `createdAt` (for report window query); optionally `userId`, `outcome` for filtering.  
**TTL / archival**: Optional TTL or job to delete/archive records older than report window to limit growth.

---

## 5. Daily Report (Generated, Not Stored)

Report is generated at schedule time and sent by email; it is not stored as an entity. Metadata for “report window” can be stored in config or a small `report_runs` collection (e.g. last successful run timestamp).

**Report run metadata (optional collection or config)**:

| Field               | Type   | Description |
|--------------------|--------|-------------|
| lastSuccessAt      | date   | Last time report was sent successfully |
| (or lastRunAt)     | date   | Last run attempt (success or fail)     |

**Report content (in-memory / email body)**:
- List of successful transactions in window (e.g. userId, symbol, quantity, price, time).
- List of failed transactions in window (userId, symbol, quantity, price, reason).
- If no transactions: “No transactions in period.”

---

## Entity Relationship Summary

```
User (id only, from path)
  └── 1 Portfolio (positions[])
  └── N Transactions (purchase attempts)

Stock (vendor; symbol, price)
  └── Referenced by Portfolio positions and Transactions
```

---

## Ports (Interfaces)

- **PortfolioRepository**: getByUserId(userId), upsertPosition(userId, symbol, quantityDelta) with atomic semantics.
- **TransactionRepository**: save(transaction), findSince(sinceDate) for report window.
- **StockVendorPort**: listStocks(pageToken?), getCurrentPrice(symbol), executeBuy?(symbol, quantity, price) if vendor supports it—or “validate price + record locally” only.
- **EmailSenderPort**: send(toAddresses[], subject, body).

---

## Validation Rules (Recap)

- **Purchase request**: symbol (required), quantity (integer > 0), price (number > 0). Validated before calling vendor.
- **Price tolerance**: Requested price must be within 2% of current vendor price (domain rule).
- **Portfolio positions**: quantity ≥ 0; symbol non-empty.
- **Report window**: Transactions with `createdAt >= lastSuccessReportAt` (or process start).
