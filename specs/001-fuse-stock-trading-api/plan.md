# Implementation Plan: Stock Trading Backend Service

**Branch**: `001-fuse-stock-trading-api` | **Date**: 2025-02-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fuse-stock-trading-api/spec.md`

**User preferences**: MongoDB as database, Express as framework, OpenAPI and Swagger for endpoint documentation.

## Summary

Backend REST API for stock trading operations: list available stocks (paginated), get user portfolio, execute purchases with price tolerance validation, and daily email report of transactions. Implemented with **Express**, **MongoDB**, and **OpenAPI/Swagger** for API documentation. Architecture follows hexagonal layout (domain, application, infrastructure) with ports for vendor API, persistence, and email; business logic remains in domain/application layers.

## Technical Context

**Language/Version**: Node.js (LTS, e.g. 20.x)  
**Primary Dependencies**: Express (HTTP), Mongoose (MongoDB ODM), swagger-ui-express + openapi spec for docs  
**Storage**: MongoDB (portfolios, transactions; stocks/catalog from vendor API)  
**Testing**: Jest or Vitest; Supertest for contract/API tests; TDD, pyramid 70% unit / 20% integration / 5% contract / 5% e2e  
**Target Platform**: Linux server (local/dev and production)  
**Project Type**: Single Node.js API (REST)  
**API Documentation**: OpenAPI 3.x spec; Swagger UI served from `/api-docs` (or similar)  
**Performance Goals**: Normal trading load; vendor latency dominates; p95 &lt; 2s for purchase acceptable  
**Constraints**: Price tolerance 2%; no auth (rate limit + validation per constitution); graceful shutdown, structured logging  
**Scale/Scope**: Single service; report window = since last successful report; transaction retention for reporting only  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Architecture Compliance**:
- [x] Hexagonal Architecture: Domain, Application, and Infrastructure layers clearly separated
- [x] No business logic in controllers/HTTP handlers (must be in domain/application layers)
- [x] Ports (interfaces) defined for all external dependencies (vendor, persistence, email)
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
- [x] ORM/ODM used to prevent injection attacks (Mongoose for MongoDB)

**Production Readiness Compliance**:
- [x] Structured logging to stdout (pino/winston)
- [x] `/health` and `/metrics` endpoints exposed
- [x] Graceful shutdown handlers (SIGTERM, SIGINT)
- [x] Configuration validated at startup
- [x] Dependencies locked (package-lock.json)
- [x] `NODE_ENV=production` set in production

## Project Structure

### Documentation (this feature)

```text
specs/001-fuse-stock-trading-api/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output - OpenAPI spec + Swagger
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── domain/              # Business logic, entities, domain services (NO external deps)
│   ├── entities/        # Stock, Portfolio, Position, Transaction (value objects/aggregates)
│   ├── services/        # Domain services (e.g. price tolerance validation)
│   └── errors/         # Custom domain errors
├── application/         # Use cases, application services
│   ├── use-cases/       # ListStocks, GetPortfolio, ExecutePurchase, DailyReport
│   └── services/        # Application services
├── infrastructure/      # Adapters for external concerns
│   ├── http/            # Express app, routes, controllers, Swagger UI mount
│   ├── persistence/     # MongoDB/Mongoose adapters (portfolios, transactions)
│   ├── external/        # Vendor API client adapter
│   ├── email/           # Email sender adapter (daily report)
│   └── config/          # Configuration management
└── ports/               # Interfaces (domain/application define, infrastructure implements)
    ├── repositories/    # PortfolioRepository, TransactionRepository
    └── services/        # StockVendorPort, EmailSenderPort

tests/
├── unit/                # Domain & application layer tests (70%)
├── integration/         # Infrastructure adapter tests (20%)
├── contract/            # API contract tests vs OpenAPI (5%)
└── e2e/                 # End-to-end user journey tests (5%)
```

**Structure Decision**: Single Node.js API with hexagonal architecture. Express in `infrastructure/http`, MongoDB via Mongoose in `infrastructure/persistence`. OpenAPI spec lives in `contracts/` and is served via Swagger UI. No monorepo or separate frontend for this feature.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |
