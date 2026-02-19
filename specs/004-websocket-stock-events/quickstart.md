# Quickstart: Real-Time Events on Stock Purchase (004)

**Feature branch**: `004-websocket-stock-events`

## What this feature adds

- **WebSocket endpoint**: Clients connect (e.g. to `/ws?userId=...`) and receive **purchase_completed** events when that user successfully completes a stock purchase.
- **Behavior**: Events are emitted only after a purchase is committed and persisted; delivery is best-effort and user-scoped. No event replay on reconnect.

## Prerequisites

- Same as main API: Node.js ≥20, MongoDB, env for vendor API.
- Existing purchase flow working (ExecutePurchase use case, POST purchase endpoint).

## Implementation checklist (high level)

1. **Port**: Add `EventPublisherPort` (e.g. `publishPurchaseCompleted(payload)`) in `shared/ports` or `events/ports`; define payload type (userId, symbol, quantity, success, price?, total?, timestamp?).
2. **Use case**: Inject optional `EventPublisherPort` into `ExecutePurchase`; after successful purchase and persist, call `publishPurchaseCompleted(...)` with data from the transaction (do not await if adapter is async; best-effort).
3. **Infrastructure**: Add WebSocket server (e.g. `ws` package) — either same HTTP server `upgrade` on a path (e.g. `/ws`) or separate port. On connection, associate socket with userId (query or first message); store in `Map<userId, Set<WebSocket>>`. Implement `EventPublisherPort` by sending JSON to the set for the given userId.
4. **App entry**: In `index.ts` (or where HTTP server is created), attach upgrade handler for the WS path; pass the same server to the WS adapter so it can handle upgrades.
5. **DI**: Register the WebSocket adapter as `EventPublisherPort` in the container; pass it into `ExecutePurchase`.
6. **Graceful shutdown**: On SIGTERM/SIGINT, close all WebSocket connections and the WS server before closing the HTTP server.
7. **Tests**: Unit — ExecutePurchase calls port with correct payload when purchase succeeds; does not call when purchase fails. Integration — connect WS, execute purchase for that user, assert one `purchase_completed` message. Contract — validate message shape against `contracts/purchase-completed-event.schema.json`.

## Key files to add or touch

| Artifact | Path |
|----------|------|
| Port | `src/features/shared/ports/event-publisher.port.ts` (or `events/ports/`) |
| Payload type | Same file or `events/domain/` |
| WS adapter | `src/features/shared/infrastructure/websocket/` (or `events/infrastructure/`) — server, connection store, port impl |
| Use case | `src/features/purchases/application/use-cases/execute-purchase.ts` — inject port, call after success |
| App / server | `src/features/shared/infrastructure/http/app.ts` or `src/index.ts` — attach upgrade, wire WS |
| Container | `src/features/shared/infrastructure/config/container.ts` — create WS adapter, pass to ExecutePurchase |
| Contract | `specs/004-websocket-stock-events/contracts/purchase-completed-event.schema.json` |

## Running after implementation

- Start API and MongoDB as today. WebSocket endpoint available at e.g. `ws://localhost:3000/ws?userId=USER_ID`.
- Open a WS client (e.g. browser or `wscat`), connect with a userId, then trigger a purchase for that user via `POST /users/:userId/purchases`. Client should receive one JSON message of type `purchase_completed`.

### Verification (manual)

1. Start the API (`npm run dev` or `npm start`); ensure MongoDB is running.
2. Connect a WebSocket client to `ws://localhost:3000/ws?userId=user123` (replace with your WS path and userId).
3. In another terminal, execute a purchase for `user123`:

   ```bash
   curl -X POST http://localhost:3000/users/user123/purchases \
     -H "Content-Type: application/json" \
     -d '{"symbol":"AAPL","quantity":1,"price":150}'
   ```

4. Confirm the WS client receives one message with `type: "purchase_completed"`, `userId: "user123"`, `symbol: "AAPL"`, `quantity: 1`, `success: true`.
