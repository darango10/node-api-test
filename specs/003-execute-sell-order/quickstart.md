# Quickstart: Execute Sell Order (003)

**Feature branch**: `003-execute-sell-order`

## What this feature adds

- **Endpoint**: `POST /users/:userId/sales` — execute a market sell order (symbol, quantity).
- **Behavior**: Validates ownership and quantity, gets current price from vendor, updates portfolio locally (no vendor sell API), records transaction. Errors for insufficient shares include `currentHeldQuantity`.

## Prerequisites

- Same as main API: Node.js ≥20, MongoDB, env for vendor API (if used).
- Existing purchase and portfolio flows working (list stocks, get portfolio, execute purchase).

## Implementation checklist (high level)

1. **Port**: Add `reducePosition(userId, symbol, quantity)` to `PortfolioRepositoryPort`; implement atomically in `PortfolioRepositoryImpl` (MongoDB `$inc` with condition).
2. **Domain**: Optional — add `type?: 'purchase' | 'sell'` to Transaction for reporting.
3. **Use case**: Add `ExecuteSell` use case (validate → get portfolio → check quantity → get current price → optional tolerance check → reducePosition → save transaction).
4. **HTTP**: Add `POST /users/:userId/sales` route, controller, request validation (Zod); merge `contracts/openapi-sell.yaml` into `openapi.yaml`.
5. **Errors**: Define operational error for insufficient shares (include currentHeldQuantity); map to 400 and SellErrorResponse shape.
6. **DI**: Register ExecuteSell and SalesController in container; mount sales routes.
7. **Tests**: Unit (ExecuteSell, reducePosition contract), integration (repo + vendor mock), contract (Supertest against OpenAPI).

## Key files to add or touch

| Artifact | Path |
|----------|------|
| Port | `src/ports/repositories/portfolio-repository.port.ts` (add reducePosition) |
| Repo | `src/infrastructure/persistence/portfolio.repository.ts` (implement reducePosition) |
| Use case | `src/application/use-cases/execute-sell.ts` (new) |
| Controller | `src/infrastructure/http/controllers/sales.controller.ts` (new) |
| Routes | `src/infrastructure/http/routes/sales.routes.ts` (new) |
| OpenAPI | `src/infrastructure/http/openapi.yaml` (merge contracts/openapi-sell.yaml) |
| Container | `src/infrastructure/config/container.ts` (wire ExecuteSell, SalesController) |
| App | `src/infrastructure/http/app.ts` (mount sales routes) |

## Running after implementation

- Start API and MongoDB as today. Sell is available at `POST /users/:userId/sales` with body `{ "symbol": "AAPL", "quantity": 10 }`.
- User must have a position in the symbol with quantity ≥ requested; otherwise 400 with `currentHeldQuantity`.

### Verification (manual)

1. Start the API (`npm run dev` or `npm start`) and ensure MongoDB is running.
2. Create a user portfolio with at least one position (e.g. execute a purchase first).
3. Call the sell endpoint:

   ```bash
   curl -X POST http://localhost:3000/users/USER_ID/sales \
     -H "Content-Type: application/json" \
     -d '{"symbol":"AAPL","quantity":5}'
   ```

4. Expect 201 with `success: true` and a `transaction` object, or 400 with `currentHeldQuantity` when shares are insufficient.

## References

- Spec: [spec.md](../spec.md)
- Data model: [data-model.md](../data-model.md)
- Research: [research.md](../research.md)
- Contract: [contracts/openapi-sell.yaml](openapi-sell.yaml)
