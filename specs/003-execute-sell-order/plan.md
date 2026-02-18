# Implementation Plan: Execute Sell Order

**Branch**: `003-execute-sell-order` | **Date**: 2025-02-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-execute-sell-order/spec.md`

## Summary

Implement a **market sell order** capability: the user submits a sell request (userId, symbol, quantity). The system validates that the user holds at least that quantity, that the market is available and the execution price is within the allowed tolerance (e.g. 2%), then updates the portfolio locally (no vendor sell API) and records the outcome for reporting. Errors for insufficient shares must include the current held quantity. Execution is local-only (vendor used only for current price and market availability).

## Technical Context

**Language/Version**: Node.js ≥20, TypeScript 5.6  
**Primary Dependencies**: Express 4.x, Mongoose 8.x, Zod 3.x, Pino, Vitest  
**Storage**: MongoDB (existing portfolio and transaction collections)  
**Testing**: Vitest (unit, integration, contract with Supertest), coverage ≥80%  
**Target Platform**: Linux server (existing API)  
**Project Type**: Single Node.js REST API (hexagonal)  
**Performance Goals**: Sell response within a few seconds under normal load (numeric target deferrable to ops)  
**Constraints**: Hexagonal layers, SOLID, max 20-line functions / 200-line files where justified  
**Scale/Scope**: Same as existing API (single service; portfolio/transaction volume as per current design)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Architecture Compliance**:
- [x] Hexagonal Architecture: Domain, Application, and Infrastructure layers clearly separated
- [x] No business logic in controllers/HTTP handlers (must be in domain/application layers)
- [x] Ports (interfaces) defined for all external dependencies
- [x] Infrastructure adapters implement ports (not vice versa)

**Code Quality Compliance**:
- [x] SOLID principles applied (single responsibility, dependency inversion, etc.)
- [x] Modules structured by business components (not technical layers)
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
- [x] `unhandledRejection` and `uncaughtException` handlers registered

**Security Compliance**:
- [x] ESLint with security plugins configured
- [x] Input validation with schemas (joi/zod/ajv)
- [x] No secrets in code (use environment variables)
- [x] Rate limiting on all endpoints
- [x] Helmet middleware for secure headers
- [x] ORM/ODM used to prevent injection attacks (Mongoose)

**Production Readiness Compliance**:
- [x] Structured logging to stdout (pino)
- [x] `/health` and `/metrics` endpoints exposed
- [x] Graceful shutdown handlers (SIGTERM, SIGINT)
- [x] Configuration validated at startup
- [x] Dependencies locked (package-lock.json)
- [x] `NODE_ENV=production` set in production

## Project Structure

### Documentation (this feature)

```text
specs/003-execute-sell-order/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI sell extension)
└── tasks.md             # Phase 2 output (/speckit.tasks - not created by plan)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── entities/        # portfolio.ts, transaction.ts, stock.ts (transaction extended for type)
│   ├── services/        # price-tolerance.ts (reused for sell)
│   └── errors/          # ValidationError, InsufficientSharesError, etc.
├── application/
│   └── use-cases/       # execute-purchase.ts, execute-sell.ts (new)
├── infrastructure/
│   ├── http/            # routes: purchases.routes.ts, sales.routes.ts (new); controllers: sales.controller.ts (new); openapi.yaml (extended)
│   ├── persistence/     # portfolio.repository.ts (extend with reducePosition), transaction (reuse)
│   ├── external/        # stock-vendor.adapter.ts (getCurrentPrice only for sell)
│   └── config/          # container.ts (wire ExecuteSell)
└── ports/
    ├── repositories/    # portfolio-repository.port.ts (add reducePosition), transaction-repository.port.ts
    └── services/       # stock-vendor.port.ts (unchanged; sell does not call executeBuy)

tests/
├── unit/                # execute-sell use case, price tolerance, domain errors
├── integration/         # portfolio reducePosition, transaction save for sell
├── contract/            # POST /users/:userId/sales
└── e2e/                 # (optional) full sell flow
```

**Structure Decision**: Single Node.js API with hexagonal layout. Sell reuses existing domain (Transaction, Portfolio, Position), ports (StockVendorPort.getCurrentPrice, TransactionRepositoryPort.save), and adds a new use case (ExecuteSell) and a new port method (PortfolioRepositoryPort.reducePosition) for atomic sell. New route `POST /users/:userId/sales` and SalesController mirror the purchase flow.

## Complexity Tracking

No constitution violations. Optional: if Transaction entity gains a `type` field (purchase | sell) for reporting, it is a small, justified extension.
