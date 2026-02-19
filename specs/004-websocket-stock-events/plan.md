# Implementation Plan: Real-Time Events on Stock Purchase

**Branch**: `004-websocket-stock-events` | **Date**: 2025-02-19 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-websocket-stock-events/spec.md`

## Summary

Add a real-time event channel so that when a user successfully completes a stock purchase, connected clients receive a push event (user, symbol, quantity, success). Implementation uses a WebSocket server alongside the existing Express API; the purchase use case depends on an event-publisher port so domain/application layers stay free of transport details. Events are emitted only after a purchase is committed and persisted; delivery is scoped by user (subscriber receives only their own purchase events).

## Technical Context

**Language/Version**: TypeScript 5.6 / Node.js ≥20  
**Primary Dependencies**: Express 4.x, existing stack (pino, zod, mongoose); add WebSocket library (see research.md)  
**Storage**: MongoDB (existing); events are not persisted (best-effort push only)  
**Testing**: Vitest, Supertest; unit (use case + port), integration (WS adapter + purchase flow), contract (WS message shape)  
**Target Platform**: Linux server (Node API process)  
**Project Type**: Single Node.js API (vertical-slice features under `src/features/`)  
**Performance Goals**: Event delivery &lt;2s from purchase commit; support 100+ concurrent WS subscribers and ~10 purchases/sec without systematic loss or reorder per user  
**Constraints**: User-scoped event delivery; no persistence of events; graceful shutdown closes WS connections  
**Scale/Scope**: Per spec (100 concurrent subscribers, 10 purchases/sec as expected load)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Architecture Compliance**:
- [x] Hexagonal Architecture: Domain, Application, and Infrastructure layers clearly separated
- [x] No business logic in controllers/HTTP handlers (must be in domain/application layers)
- [x] Ports (interfaces) defined for all external dependencies (new EventPublisherPort for real-time push)
- [x] Infrastructure adapters implement ports (WebSocket server adapter implements EventPublisherPort)

**Code Quality Compliance**:
- [x] SOLID principles applied (single responsibility, dependency inversion, etc.)
- [x] Modules structured by business components (new feature slice: events or under purchases/shared)
- [x] No functions > 20 lines without justification
- [x] No files > 200 lines without justification
- [x] Naming conventions followed (camelCase, PascalCase, UPPER_SNAKE_CASE)

**Testing Compliance**:
- [x] TDD approach: Tests written before implementation
- [x] Testing pyramid followed: 70% unit, 20% integration, 5% contract, 5% e2e
- [x] Test coverage target ≥ 80%
- [x] AAA pattern (Arrange-Act-Assert) in all tests
- [x] Test names follow format: "should [expected behavior] when [condition]"

**Error Handling Compliance**:
- [x] Custom error classes extend built-in Error
- [x] Operational vs. programmer errors distinguished
- [x] Centralized error handler implemented
- [x] All async code uses async/await (no callbacks)
- [x] unhandledRejection and uncaughtException handlers registered

**Security Compliance**:
- [x] ESLint with security plugins configured
- [x] Input validation with schemas (joi/zod/ajv) — WS connection auth/params validated
- [x] No secrets in code (use environment variables)
- [x] Rate limiting on all endpoints; WS connection rate considered
- [x] Helmet middleware for secure headers
- [x] ORM/ODM used to prevent injection attacks (existing)

**Production Readiness Compliance**:
- [x] Structured logging to stdout (pino)
- [x] `/health` and `/metrics` endpoints exposed
- [x] Graceful shutdown handlers (SIGTERM, SIGINT) — must close WS server
- [x] Configuration validated at startup
- [x] Dependencies locked (package-lock.json)
- [x] NODE_ENV=production set in production

## Project Structure

### Documentation (this feature)

```text
specs/004-websocket-stock-events/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (WS message schema)
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── purchases/
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       └── execute-purchase.ts   # Inject EventPublisherPort; emit after success
│   │   ├── infrastructure/
│   │   │   ├── controllers/
│   │   │   └── routes/
│   │   └── ports/                         # (optional) or shared/ports
│   ├── events/                            # NEW: real-time event feature slice
│   │   ├── domain/                        # Event payload types (or shared)
│   │   ├── application/                   # Optional: orchestration if needed
│   │   ├── infrastructure/
│   │   │   └── websocket/                 # WS server adapter, connection store
│   │   └── ports/
│   │       └── event-publisher.port.ts    # publishPurchaseCompleted(userId, payload)
│   ├── stocks/
│   ├── portfolio/
│   ├── sales/
│   └── shared/
│       ├── domain/
│       ├── infrastructure/
│       │   ├── http/
│       │   │   └── app.ts                 # Mount WS server or upgrade handler
│       │   └── config/
│       │       └── container.ts           # Wire EventPublisherPort + ExecutePurchase
│       └── ports/
tests/
├── unit/
├── integration/
├── contract/
└── e2e/
```

**Structure Decision**: Existing codebase uses vertical slices under `src/features/` (purchases, sales, portfolio, stocks, shared). Add a new slice `events` for the event-publisher port and WebSocket infrastructure, or place the port in `shared/ports` and the WebSocket adapter in `shared/infrastructure/websocket` to avoid a tiny feature. Either way: ExecutePurchase receives an optional EventPublisherPort and calls it after a successful purchase; the adapter broadcasts to connected clients scoped by userId.

## Complexity Tracking

No constitution violations. Optional: if EventPublisherPort is added under `shared/ports` and a single WS adapter under `shared/infrastructure/websocket`, the "events" feature slice can be omitted to reduce new top-level folders.
