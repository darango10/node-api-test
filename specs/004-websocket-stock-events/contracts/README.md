# Contracts: Real-Time Events (004-websocket-stock-events)

## WebSocket endpoint

- **Path**: Implementation-defined (e.g. `/ws` or `/events`).
- **Protocol**: Standard WebSocket (no Socket.IO or custom subprotocol required).
- **Authentication / scoping**: Client is associated with a `userId` at connection time (e.g. query parameter `?userId=...` or first JSON message). Server sends purchase-completed events only to connections registered for that user.

## Message format

- **Encoding**: JSON.
- **Direction**: Server → Client only for this feature (no client commands required).
- **Schema**: [purchase-completed-event.schema.json](./purchase-completed-event.schema.json) — one message per successful purchase, containing at least `type`, `userId`, `symbol`, `quantity`, `success`.

## Example (server → client)

```json
{
  "type": "purchase_completed",
  "userId": "user123",
  "symbol": "AAPL",
  "quantity": 10,
  "success": true,
  "price": 150.0,
  "total": 1500.0,
  "timestamp": "2025-02-19T14:30:00.000Z"
}
```

## Contract tests

- Validate that messages sent by the server conform to `purchase-completed-event.schema.json`.
- Optionally: connect with a userId, trigger a purchase for that user, assert one matching message is received within a timeout.
