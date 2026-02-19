# Tasks: Real-Time Events on Stock Purchase

**Input**: Design documents from `/specs/004-websocket-stock-events/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution requires TDD; tasks include unit, integration, and contract tests for this feature.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` and `tests/` at repository root (see plan.md: `src/features/` vertical slices)
- Port: `src/features/shared/ports/`; WebSocket adapter: `src/features/shared/infrastructure/websocket/`
- Entry: `src/index.ts` (HTTP server created here; attach WS upgrade here)

---

## Phase 1: Setup (Feature Dependencies)

**Purpose**: Add only what this feature needs; existing API structure remains.

- [x] T001 [P] Add `ws` dependency to package.json (npm install ws; add types if needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Port and payload type required by both use case and WebSocket adapter.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [x] T002 [P] Define EventPublisherPort (publishPurchaseCompleted(payload)) and PurchaseCompletedPayload type in src/features/shared/ports/event-publisher.port.ts per data-model.md

**Checkpoint**: Port and payload type defined; US1 implementation can start.

---

## Phase 3: User Story 1 – Receive Event When a Purchase Completes (Priority: P1) – MVP

**Goal**: Connected client receives a purchase_completed event (userId, symbol, quantity, success, etc.) within a short delay after that user successfully completes a stock purchase.

**Independent Test**: Connect a WebSocket client with a userId; execute a successful purchase for that user via POST /users/:userId/purchases; assert the client receives exactly one JSON message with type "purchase_completed" and matching user/symbol/quantity/success.

### Tests for User Story 1 (TDD – write first, then implement)

- [x] T003 [P] [US1] Unit test: ExecutePurchase calls EventPublisherPort.publishPurchaseCompleted with correct payload when purchase succeeds in tests/unit/purchases/execute-purchase-event.spec.ts
- [x] T004 [P] [US1] Unit test: ExecutePurchase does not call EventPublisherPort when purchase fails (e.g. price out of tolerance or vendor reject) in tests/unit/purchases/execute-purchase-event.spec.ts
- [x] T005 [US1] Integration test: WebSocket client connected with userId receives exactly one purchase_completed message when that user completes a successful purchase in tests/integration/websocket-purchase-event.spec.ts
- [x] T006 [P] [US1] Contract test: purchase_completed message conforms to specs/004-websocket-stock-events/contracts/purchase-completed-event.schema.json in tests/contract/websocket-purchase-event.spec.ts

### Implementation for User Story 1 (after tests are written and failing)

- [x] T007 [US1] Implement WebSocket server adapter: connection store Map<userId, Set<WebSocket>>; on upgrade parse userId from query, register socket; on close unregister; implement EventPublisherPort.publishPurchaseCompleted to send JSON payload to all sockets for payload.userId in src/features/shared/infrastructure/websocket/
- [x] T008 [US1] Attach WebSocket upgrade handler to HTTP server and instantiate WS adapter in src/index.ts (after server = app.listen(...))
- [x] T009 [US1] Inject optional EventPublisherPort into ExecutePurchase and call publishPurchaseCompleted(payload) after successful purchase and persist in src/features/purchases/application/use-cases/execute-purchase.ts
- [x] T010 [US1] Register EventPublisherPort (WebSocket adapter) in container and pass to ExecutePurchase in src/features/shared/infrastructure/config/container.ts

**Checkpoint**: User Story 1 complete — client receives event on successful purchase; independently testable.

---

## Phase 4: User Story 2 – Events Only for Completed Purchases (Priority: P2)

**Goal**: No purchase_completed event is sent when a purchase fails, is rejected, or is not yet committed.

**Independent Test**: Trigger a purchase that fails (e.g. price out of tolerance); assert no purchase_completed event is received. Trigger a successful purchase; assert one event is received.

- [ ] T011 [P] [US2] Integration test: failed purchase (e.g. price out of tolerance or vendor reject) does not emit purchase_completed event to connected client in tests/integration/websocket-purchase-event.spec.ts

**Checkpoint**: User Story 2 verified — events only on success.

---

## Phase 5: User Story 3 – Subscribers Receive Only Relevant Events (Priority: P3)

**Goal**: A subscriber receives only events for the user they are associated with (userId from connection); no cross-user event leakage.

**Independent Test**: Connect two clients as user A and user B; complete a purchase as user A only; assert only A’s client receives the purchase_completed event.

- [ ] T012 [US3] Reject WebSocket connection when userId query param is missing or invalid; only register socket for that userId in src/features/shared/infrastructure/websocket/
- [ ] T013 [US3] Integration test: connect as user A and user B; complete purchase as user A only; assert only A’s client receives purchase_completed in tests/integration/websocket-purchase-event.spec.ts

**Checkpoint**: User Story 3 complete — event delivery scoped by userId.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Graceful shutdown, docs, and verification.

- [ ] T014 Close WebSocket server and all client connections in graceful shutdown (before HTTP server.close) in src/index.ts
- [ ] T015 [P] Update specs/004-websocket-stock-events/quickstart.md or project README with WebSocket endpoint URL and verification steps if not already complete
- [ ] T016 Run full test suite (npm test) and ESLint (npm run lint); verify coverage ≥80% for new code paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user story implementation.
- **Phase 3 (US1)**: Depends on Phase 2. Tests T003–T006 can be written in parallel where marked [P]; implementation T007–T010 after tests (T007 before T008–T010; T009–T010 after T007).
- **Phase 4 (US2)**: Depends on Phase 3 — one test task; implementation already satisfies “events only on success.”
- **Phase 5 (US3)**: Depends on Phase 3 — T012 tightens connect validation; T013 verifies scoping.
- **Phase 6 (Polish)**: Depends on Phase 5 (or at least Phase 3 for T014).

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on US2/US3.
- **US2 (P2)**: After US1 — verification only (no new implementation).
- **US3 (P3)**: After US1 — connection validation and scoping test.

### Parallel Opportunities

- T001, T002: Can run in parallel.
- T003, T004, T006: Can run in parallel (different test files or cases).
- T011: Can run in parallel with other integration tests once US1 is done.
- T015: Can run in parallel with T014/T016.

---

## Parallel Example: User Story 1

```bash
# After Phase 2, write tests in parallel:
T003: Unit test ExecutePurchase calls port on success (tests/unit/purchases/execute-purchase-event.spec.ts)
T004: Unit test ExecutePurchase does not call port on failure (same file or separate)
T006: Contract test message shape (tests/contract/websocket-purchase-event.spec.ts)

# Then:
T005: Integration test connect + purchase → one message (tests/integration/websocket-purchase-event.spec.ts)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Write and run US1 tests (T003–T006); ensure they fail.
3. Implement T007–T010 until tests pass.
4. **Stop and validate**: Connect with wscat or browser, run a purchase, confirm one event.
5. Optionally deploy/demo.

### Incremental Delivery

1. Phase 1 + 2 → port and payload ready.
2. Phase 3 (US1) → event on success (MVP).
3. Phase 4 (US2) → confirm no event on failure.
4. Phase 5 (US3) → user-scoped delivery.
5. Phase 6 → shutdown, docs, lint/coverage.

### Task Count Summary

| Phase        | Tasks   | Count |
|-------------|---------|-------|
| Phase 1 Setup | T001    | 1     |
| Phase 2 Foundational | T002 | 1     |
| Phase 3 US1  | T003–T010 | 8  |
| Phase 4 US2  | T011    | 1     |
| Phase 5 US3  | T012–T013 | 2  |
| Phase 6 Polish | T014–T016 | 3  |
| **Total**    |         | **16** |

- **MVP scope**: Phases 1–3 (T001–T010).
- **Independent test criteria**: US1 = connect + purchase → one event; US2 = failed purchase → no event; US3 = two users, one purchase → only that user’s client gets event.

---

## Notes

- [P] tasks use different files or independent test cases; no ordering between them.
- [USn] maps tasks to spec.md user stories for traceability.
- ExecutePurchase must not depend on EventPublisherPort for correctness (best-effort emit); inject as optional or no-op if absent.
- Commit after each task or logical group; stop at any checkpoint to validate that story independently.
