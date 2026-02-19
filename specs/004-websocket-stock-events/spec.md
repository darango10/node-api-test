# Feature Specification: Real-Time Events on Stock Purchase

**Feature Branch**: `004-websocket-stock-events`  
**Created**: 2025-02-19  
**Status**: Draft  
**Input**: User description: "Add a WebSocket to the API to post events, every time a user buys a stock"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Event When a Purchase Completes (Priority: P1)

A client application (e.g. dashboard or trading UI) maintains a live connection to the API. Whenever a stock purchase completed successfully for a user, the system delivers an event over that connection so the client can update the UI, refresh balances, or trigger follow-up actions without polling.

**Why this priority**: Real-time feedback is the core value; without it, clients must poll or reload to see purchase results.

**Independent Test**: Complete a stock purchase via the existing purchase flow; assert that a connected client receives exactly one event describing that purchase (e.g. user, symbol, quantity, outcome) within a defined time window. Delivers value by enabling instant UI updates after a buy.

**Acceptance Scenarios**:

1. **Given** a client is connected to the real-time event channel and a user successfully completes a stock purchase, **When** the purchase is committed, **Then** the client receives an event containing the purchase outcome (e.g. user identifier, symbol, quantity, and success status) within a short, bounded delay.
2. **Given** a client is connected and the same user completes multiple purchases in sequence, **When** each purchase commits, **Then** the client receives one event per purchase in the same order as completion.
3. **Given** no purchase has occurred, **When** a client is connected, **Then** the client receives no purchase event until a purchase completes.

---

### User Story 2 - Events Only for Completed Purchases (Priority: P2)

Events are emitted only when a stock purchase has been successfully executed and persisted. Failed, rejected, or in-progress orders do not produce an event.

**Why this priority**: Prevents clients from reacting to incomplete or failed operations and keeps the event stream consistent with actual state.

**Independent Test**: Trigger a purchase that fails (e.g. insufficient funds, invalid symbol, or market closed); assert no purchase-completed event is delivered. Then trigger a successful purchase and assert one event is delivered.

**Acceptance Scenarios**:

1. **Given** a user submits a purchase that is rejected (e.g. insufficient funds, invalid symbol, market closed), **When** the order is rejected, **Then** no purchase-completed event is sent to subscribers.
2. **Given** a purchase is in progress (e.g. pending vendor or validation), **When** the outcome is not yet committed, **Then** no purchase-completed event is sent until the purchase succeeds.

---

### User Story 3 - Subscribers Receive Only Relevant Events (Priority: P3)

Event delivery is scoped so that a subscriber receives only events they are entitled to see (e.g. purchases for a specific user or session), protecting privacy and reducing noise.

**Why this priority**: Ensures correct access control and usable event volume for clients.

**Independent Test**: Connect as user A and as user B; complete a purchase as user A only. Assert that the client subscribed for user A receives the event and the client subscribed for user B does not (or that a global subscriber receives events in a way that allows filtering by user).

**Acceptance Scenarios**:

1. **Given** a subscriber is associated with a specific user (e.g. by session or token), **When** a purchase completes for that user, **Then** the subscriber receives the event; when a purchase completes for another user, **Then** the subscriber does not receive that event (or receives only events for users they are authorized to see).
2. **Given** a subscriber connects without a user scope (e.g. admin or service), **When** the system supports such a role, **Then** event delivery follows defined rules (e.g. no events, or only events the role is authorized to see).

---

### Edge Cases

- What happens when a client disconnects mid-purchase? No event is sent to that client for purchases that complete after disconnect; reconnection does not replay past events unless a separate replay mechanism is specified.
- How does the system handle a burst of many purchases? Events are delivered in order per user or per channel; the system accepts a defined load and may apply backpressure or degradation behavior (e.g. drop or queue) if limits are exceeded.
- What happens when the event channel is temporarily unavailable? The purchase itself still completes and is persisted; event delivery may be best-effort or retried according to policy; clients may miss events for that window unless a replay or reconciliation mechanism exists.
- What happens when a subscriber connects after a purchase? The subscriber receives only events for purchases that complete after the connection is established; no automatic replay of past purchases unless explicitly specified elsewhere.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a real-time event channel that clients can connect to in order to receive push notifications.
- **FR-002**: System MUST emit an event whenever a user successfully completes a stock purchase (after the purchase is committed and persisted).
- **FR-003**: Each purchase-completed event MUST include at least: an identifier for the user who performed the purchase, the stock symbol, the quantity purchased, and an indication of successful completion.
- **FR-004**: System MUST NOT emit a purchase-completed event when a purchase fails, is rejected, or is not yet committed.
- **FR-005**: System MUST scope event delivery so that subscribers receive only events they are authorized to see (e.g. limited to the user they represent or to roles that are allowed to see those events).
- **FR-006**: System MUST deliver events within a defined, short delay after the purchase is committed so that clients experience near real-time updates.
- **FR-007**: System MUST support multiple concurrent subscribers without requiring a fixed upper limit per deployment, within reasonable resource bounds.

### Non-Functional Requirements (from Constitution)

**Architecture**:
- **NFR-001**: Implementation MUST follow hexagonal architecture (domain, application, infrastructure layers)
- **NFR-002**: Business logic MUST reside in domain layer with ZERO external dependencies
- **NFR-003**: All external dependencies MUST be accessed through ports (interfaces)

**Code Quality**:
- **NFR-004**: All code MUST adhere to SOLID principles
- **NFR-005**: Functions MUST NOT exceed 20 lines (unless justified)
- **NFR-006**: Files MUST NOT exceed 200 lines (unless justified)
- **NFR-007**: Code MUST pass ESLint with security plugins

**Testing**:
- **NFR-008**: Test coverage MUST be ≥ 80%
- **NFR-009**: Tests MUST be written before implementation (TDD)
- **NFR-010**: Tests MUST follow testing pyramid (70% unit, 20% integration, 5% contract, 5% e2e)

**Security**:
- **NFR-011**: All inputs MUST be validated with schemas (joi/zod/ajv)
- **NFR-012**: All endpoints MUST have rate limiting
- **NFR-013**: Passwords MUST be hashed with bcrypt/scrypt
- **NFR-014**: No secrets in code (use environment variables)

**Production Readiness**:
- **NFR-015**: System MUST expose `/health` and `/metrics` endpoints
- **NFR-016**: System MUST log to stdout with structured JSON format
- **NFR-017**: System MUST handle graceful shutdown (SIGTERM, SIGINT)
- **NFR-018**: System MUST distinguish operational vs. programmer errors

### Key Entities

- **Purchase-completed event**: A notification that a stock purchase was successfully committed; carries user identifier, symbol, quantity, and success status; no persistence of the event itself unless a separate audit or replay store is specified.
- **Subscriber**: A client session or connection that is entitled to receive events (e.g. scoped by user or role).
- **Real-time event channel**: The mechanism by which the system pushes events to connected subscribers; its concrete technology is an implementation choice.

## Assumptions

- "Stock purchase" means the existing purchase (buy) flow already implemented in the API; the event is emitted from the same business outcome that today returns a success response to the buyer.
- Events are best-effort or at-most-once unless a separate requirement adds replay or guaranteed delivery; clients that disconnect may miss events.
- Scoping is at least by user (subscriber sees only their own purchase events); broader or admin scopes can be added later.
- No requirement for historical replay of events in this feature; only live delivery after connection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Subscribers receive a purchase-completed event for every successful stock purchase within a defined short delay (e.g. under 2 seconds from commit) under normal load.
- **SC-002**: Zero purchase-completed events are delivered for failed or rejected purchases.
- **SC-003**: Under expected load (e.g. 100 concurrent subscribers and 10 purchases per second), event delivery remains stable with no systematic loss or reordering for a given user.
- **SC-004**: Clients can connect, receive events for their scope, and disconnect without affecting the correctness of the purchase flow or other subscribers.
