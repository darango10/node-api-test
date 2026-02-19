# Research: Real-Time Events on Stock Purchase

**Feature**: 004-websocket-stock-events  
**Date**: 2025-02-19

## 1. WebSocket library for Node.js (alongside Express)

**Decision**: Use the **`ws`** package for the WebSocket server.

**Rationale**:
- Standard, minimal WebSocket implementation; no protocol extensions required.
- Works alongside Express: run a separate HTTP server for WS upgrade (e.g. same port via server.on('upgrade', ...)) or a dedicated WS port; both are common.
- High adoption, maintained, and fits the “single process, moderate scale” goal (100+ subscribers, ~10 purchases/sec).
- No need for Socket.IO’s fallbacks or uWebSockets’ native bindings for this scale; keeps the stack simple and debuggable.

**Alternatives considered**:
- **Socket.IO**: Adds protocol and fallbacks (long-polling); not required when clients can use plain WebSocket.
- **uWebSockets.js**: Higher raw performance but adds native/C++ dependency and Express integration is via a compatibility layer; prefer `ws` for simplicity unless load testing shows a bottleneck.

---

## 2. Authenticating and scoping WebSocket connections (user-scoped events)

**Decision**: Scope connections by **userId** derived at connection time (e.g. token in query string or first JSON message), then broadcast purchase-completed events only to connections registered for that userId.

**Rationale**:
- Spec requires “subscribers receive only events they are authorized to see” (FR-005); per-user scope is the minimum.
- No existing auth system was specified; assume a simple bearer token or opaque user identifier in `?userId=...` or in the first client message so the server can associate the socket with a user.
- Store open sockets in a structure keyed by userId (e.g. `Map<userId, Set<WebSocket>>`) and send only to that set when publishing a purchase event for that user.

**Alternatives considered**:
- JWT in query string: valid option; decode and verify in upgrade handler, then attach userId to the socket.
- First-message auth: client sends `{ type: 'auth', userId: '...' }` after connect; server validates (e.g. against session/token) and then subscribes. Prefer query or upgrade-time auth so unauthenticated connections are rejected quickly.

---

## 3. Where to emit the event (hexagonal boundary)

**Decision**: **Application layer** (ExecutePurchase use case) calls a **port** (e.g. `EventPublisherPort.publishPurchaseCompleted(payload)`) after a successful purchase and after transaction/portfolio are persisted. An **infrastructure adapter** (WebSocket server) implements the port and broadcasts to the right clients.

**Rationale**:
- Keeps domain and application free of transport: they only “notify that something happened” via an interface.
- Purchase flow remains the same; we add an optional dependency (port) and one call after success.
- If the adapter fails (e.g. WS temporarily down), the use case does not fail the purchase (best-effort events per spec); the adapter can log and drop.

**Alternatives considered**:
- Domain event + in-process bus: more flexible for many subscribers (e.g. logging, analytics) but adds indirection; a single port is enough for “notify WS clients.”
- Emit from controller: would tie event emission to HTTP and mix layers; port from use case is cleaner.

---

## 4. Same process vs separate WebSocket server

**Decision**: Run the WebSocket server in the **same Node process** as the HTTP server: attach an `upgrade` listener to the same HTTP server so `/ws` (or chosen path) upgrades to WebSocket. No extra port or process.

**Rationale**:
- Simpler deployment and configuration; one process to monitor and graceful shutdown applies to both HTTP and WS.
- Fits expected scale; if needed later, the same port interface can be implemented by a separate service (e.g. Redis pub/sub adapter).

**Alternatives considered**:
- Separate port for WS: valid; slightly more configuration and two listen endpoints to manage.
- Separate process: unnecessary for current scale; adds operational complexity.
