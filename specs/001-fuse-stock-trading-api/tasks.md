# Tasks: Stock Trading Backend Service

**Input**: Design documents from `/specs/001-fuse-stock-trading-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included per Constitution (NFR-009 TDD, NFR-010 testing pyramid). Tests written first, then implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single Node.js API: `src/`, `tests/` at repository root (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and hexagonal structure per plan and constitution

- [X] T001 Create hexagonal architecture directories in src/ (domain/entities, domain/services, domain/errors, application/use-cases, application/services, infrastructure/http, infrastructure/persistence, infrastructure/external, infrastructure/email, infrastructure/config, ports/repositories, ports/services)
- [X] T002 Initialize Node.js project with package.json, TypeScript, and dependencies (express, mongoose, swagger-ui-express, joi or zod, pino or winston, helmet, express-rate-limit) in repository root
- [X] T003 [P] Configure ESLint with security plugins (eslint-plugin-security, eslint-plugin-node) in .eslintrc or eslint.config.js
- [X] T004 [P] Configure Prettier in .prettierrc or .prettierrc.js
- [X] T005 [P] Setup testing framework (Jest or Vitest) with coverage threshold ≥80% in package.json and config
- [X] T006 [P] Copy OpenAPI spec from specs/001-fuse-stock-trading-api/contracts/openapi.yaml to a location served by app (e.g. src/infrastructure/http/openapi.yaml or public/openapi.yaml)
- [X] T007 Setup dependency injection or factory pattern for ports (e.g. awilix/tsyringe or plain factories in src/infrastructure/config/container.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure per constitution. No user story work until this phase is complete.

**Error Handling (Constitution V)**:
- [X] T010 Create custom error classes extending Error (AppError, ValidationError, NotFoundError, DomainError) in src/domain/errors/index.ts
- [X] T011 Implement centralized error handler middleware in src/infrastructure/http/middlewares/error-handler.ts
- [X] T012 Register global unhandledRejection and uncaughtException handlers in src/index.ts or app bootstrap

**Logging & Observability (Constitution VI)**:
- [X] T013 [P] Setup structured logging (pino or winston) logging to stdout in src/infrastructure/config/logger.ts
- [X] T014 [P] Implement AsyncLocalStorage for request correlation ID in src/infrastructure/http/middlewares/request-context.ts
- [X] T015 [P] Create GET /health endpoint (liveness/readiness) in src/infrastructure/http/routes/health.routes.ts
- [X] T016 [P] Create GET /metrics endpoint (Prometheus format) in src/infrastructure/http/routes/metrics.routes.ts

**Security (Constitution VII)**:
- [X] T017 [P] Setup helmet middleware in src/infrastructure/http/app.ts or middlewares
- [X] T018 [P] Implement rate limiting middleware (express-rate-limit) in src/infrastructure/http/middlewares/rate-limit.ts
- [X] T019 [P] Add request body size limit (e.g. express.json({ limit })) in src/infrastructure/http/app.ts
- [X] T020 [P] Configure CORS in src/infrastructure/http/app.ts (no wildcard in production)

**Configuration & Process**:
- [X] T021 Setup environment-aware config with validation (e.g. zod/env-var) in src/infrastructure/config/index.ts (MONGODB_URI, PORT, VENDOR_API_URL, etc.)
- [X] T022 Implement graceful shutdown (SIGTERM, SIGINT) closing server and MongoDB in src/index.ts

**Port Definitions (Hexagonal)**:
- [X] T023 [P] Define StockVendorPort interface in src/ports/services/stock-vendor.port.ts (listStocks, getCurrentPrice)
- [X] T024 [P] Define PortfolioRepository port in src/ports/repositories/portfolio-repository.port.ts (getByUserId, upsertPosition)
- [X] T025 [P] Define TransactionRepository port in src/ports/repositories/transaction-repository.port.ts (save, findSince)
- [X] T026 [P] Define EmailSenderPort interface in src/ports/services/email-sender.port.ts (send)

**Infrastructure - MongoDB**:
- [X] T027 Setup MongoDB connection with Mongoose in src/infrastructure/persistence/mongo-connection.ts (connect/disconnect, used by adapters)

**Checkpoint**: Foundation ready; user story implementation can begin.

---

## Phase 3: User Story 1 - List Available Stocks (Priority: P1) — MVP

**Goal**: Expose GET /stocks with pagination (nextToken) from vendor; return 502 when vendor unavailable.

**Independent Test**: GET /stocks returns { stocks, nextToken? }; GET /stocks?nextToken=X returns next page; when vendor down, response is 502 with error body.

### Tests for User Story 1 (TDD - write first, then implement)

**Unit**:
- [X] T030 [P] [US1] Unit test ListStocks use case with mocked StockVendorPort in tests/unit/application/list-stocks.spec.ts
- [X] T031 [P] [US1] Unit test Stock value/entity validation in tests/unit/domain/stock.spec.ts

**Integration**:
- [X] T032 [P] [US1] Integration test vendor HTTP adapter with nock in tests/integration/stock-vendor-adapter.spec.ts

**Contract**:
- [X] T033 [US1] Contract test GET /stocks (200 shape, 502 on vendor error) in tests/contract/stocks.spec.ts

**E2E** (optional, critical path):
- [X] T034 [US1] E2E test list stocks flow in tests/e2e/list-stocks.spec.ts

### Implementation for User Story 1

**Domain**:
- [X] T035 [P] [US1] Create Stock entity/value in src/domain/entities/stock.ts (symbol, price)

**Application**:
- [X] T036 [US1] Implement ListStocks use case in src/application/use-cases/list-stocks.ts (depends on StockVendorPort)
- [X] T037 [US1] Wire ListStocks in app container/factory in src/infrastructure/config/container.ts or equivalent

**Infrastructure**:
- [X] T038 [US1] Implement StockVendorPort HTTP adapter in src/infrastructure/external/stock-vendor.adapter.ts (call vendor API, map to Stock[], handle timeout/5xx)
- [X] T039 [US1] Create stocks controller in src/infrastructure/http/controllers/stocks.controller.ts (call ListStocks, return JSON + nextToken)
- [X] T040 [US1] Define GET /stocks route and validation (query: nextToken, limit) in src/infrastructure/http/routes/stocks.routes.ts
- [X] T041 [US1] Mount Swagger UI at /api-docs serving OpenAPI spec in src/infrastructure/http/app.ts

**Verification**:
- [X] T042 [US1] Run tests for US1 and verify coverage for list-stocks path
- [X] T043 [US1] Run ESLint with no errors on new files

**Checkpoint**: List stocks works independently; evaluator can call GET /stocks and use /api-docs.

---

## Phase 4: User Story 2 - Get User Portfolio (Priority: P2)

**Goal**: Expose GET /users/:userId/portfolio returning { userId, positions[] }; empty positions when no holdings; 400/404 for invalid userId.

**Independent Test**: GET /users/{userId}/portfolio returns 200 with positions array; empty array when no holdings; 400 or 404 for bad userId.

### Tests for User Story 2

**Unit**:
- [X] T044 [P] [US2] Unit test GetPortfolio use case with mocked PortfolioRepository in tests/unit/application/get-portfolio.spec.ts
- [X] T045 [P] [US2] Unit test Portfolio/Position entities in tests/unit/domain/portfolio.spec.ts

**Integration**:
- [X] T046 [P] [US2] Integration test PortfolioRepository Mongoose adapter with test DB in tests/integration/portfolio-repository.spec.ts

**Contract**:
- [X] T047 [US2] Contract test GET /users/:userId/portfolio (200, 400, 404) in tests/contract/portfolio.spec.ts

### Implementation for User Story 2

**Domain**:
- [X] T048 [P] [US2] Create Portfolio and Position value types in src/domain/entities/portfolio.ts

**Application**:
- [X] T049 [US2] Implement GetPortfolio use case in src/application/use-cases/get-portfolio.ts (depends on PortfolioRepository)
- [X] T050 [US2] Wire GetPortfolio and PortfolioRepository in container

**Infrastructure**:
- [X] T051 [US2] Create Mongoose schema and model for Portfolio in src/infrastructure/persistence/models/portfolio.model.ts (userId, positions[], updatedAt)
- [X] T052 [US2] Implement PortfolioRepository adapter in src/infrastructure/persistence/portfolio.repository.ts (getByUserId, upsertPosition with atomic update)
- [X] T053 [US2] Create portfolio controller in src/infrastructure/http/controllers/portfolio.controller.ts
- [X] T054 [US2] Define GET /users/:userId/portfolio route and userId validation in src/infrastructure/http/routes/portfolio.routes.ts

**Verification**:
- [X] T055 [US2] Run US2 tests and lint

**Checkpoint**: Get portfolio works; list stocks + get portfolio can be demoed together.

---

## Phase 5: User Story 3 - Execute Stock Purchase (Priority: P3)

**Goal**: POST /users/:userId/purchases with body { symbol, quantity, price }. Validate price within 2% of vendor price; on success record transaction and update portfolio atomically; on failure record transaction and return clear error.

**Independent Test**: Purchase within tolerance → 201 and portfolio updated; purchase outside tolerance → 400 with message; vendor error → 502 and no portfolio update; invalid input → 400 validation errors.

### Tests for User Story 3

**Unit**:
- [ ] T056 [P] [US3] Unit test price tolerance validation (2%) in tests/unit/domain/price-tolerance.spec.ts
- [ ] T057 [P] [US3] Unit test ExecutePurchase use case with mocks in tests/unit/application/execute-purchase.spec.ts
- [ ] T058 [P] [US3] Unit test Transaction entity in tests/unit/domain/transaction.spec.ts

**Integration**:
- [ ] T059 [P] [US3] Integration test TransactionRepository adapter in tests/integration/transaction-repository.spec.ts
- [ ] T060 [US3] Integration test ExecutePurchase with real PortfolioRepo + TransactionRepo (test DB) in tests/integration/execute-purchase.spec.ts

**Contract**:
- [ ] T061 [US3] Contract test POST /users/:userId/purchases (201, 400, 404, 502) in tests/contract/purchases.spec.ts

### Implementation for User Story 3

**Domain**:
- [ ] T062 [P] [US3] Create Transaction entity in src/domain/entities/transaction.ts (userId, symbol, quantity, price, outcome, reason?, createdAt)
- [ ] T063 [US3] Implement price tolerance domain service (e.g. isWithinTolerance(requested, current, percent)) in src/domain/services/price-tolerance.ts

**Application**:
- [ ] T064 [US3] Implement ExecutePurchase use case in src/application/use-cases/execute-purchase.ts (get current price from vendor, validate tolerance, save transaction, upsert portfolio on success only)
- [ ] T065 [US3] Wire ExecutePurchase and TransactionRepository in container

**Infrastructure**:
- [ ] T066 [US3] Create Mongoose schema and model for Transaction in src/infrastructure/persistence/models/transaction.model.ts
- [ ] T067 [US3] Implement TransactionRepository adapter in src/infrastructure/persistence/transaction.repository.ts (save, findSince)
- [ ] T068 [US3] Add getCurrentPrice to StockVendorPort and vendor adapter if not already present in src/ports/services/stock-vendor.port.ts and src/infrastructure/external/stock-vendor.adapter.ts
- [ ] T069 [US3] Create purchases controller in src/infrastructure/http/controllers/purchases.controller.ts
- [ ] T070 [US3] Define POST /users/:userId/purchases route and request body validation (symbol, quantity, price) in src/infrastructure/http/routes/purchases.routes.ts
- [ ] T071 [US3] Ensure portfolio upsertPosition uses atomic update for concurrency in src/infrastructure/persistence/portfolio.repository.ts

**Verification**:
- [ ] T072 [US3] Run US3 tests and lint; verify concurrent purchase test if added

**Checkpoint**: Execute purchase works; full trading flow (list → portfolio → purchase) is demoable.

---

## Phase 6: User Story 4 - Daily Email Report of Transactions (Priority: P4)

**Goal**: Scheduled job (e.g. once per day) that queries transactions since last successful report, builds summary (success + failure), sends email to fixed recipients from config; on missed run, skip until next schedule.

**Independent Test**: Trigger report job; verify email sent with success/failure list; when no transactions, email indicates no transactions; when email fails, failure is logged.

### Tests for User Story 4

**Unit**:
- [ ] T073 [P] [US4] Unit test DailyReport use case with mocked TransactionRepository and EmailSenderPort in tests/unit/application/daily-report.spec.ts

**Integration**:
- [ ] T074 [US4] Integration test report job with test DB and mock email in tests/integration/daily-report.spec.ts

### Implementation for User Story 4

**Application**:
- [ ] T075 [US4] Implement DailyReport use case in src/application/use-cases/daily-report.ts (findSince(lastSuccessAt), build body, call EmailSenderPort, persist lastSuccessAt on success)
- [ ] T076 [US4] Define port or config for last successful report timestamp (e.g. ReportRunRepository or config file) in src/ports/repositories/report-run.port.ts or extend config

**Infrastructure**:
- [ ] T077 [US4] Implement EmailSenderPort adapter (e.g. nodemailer) in src/infrastructure/email/email-sender.adapter.ts
- [ ] T078 [US4] Implement report run metadata persistence (e.g. report_runs collection or file) in src/infrastructure/persistence/report-run.repository.ts
- [ ] T079 [US4] Schedule daily job (node-cron or setInterval/setTimeout loop) in src/infrastructure/config/scheduler.ts calling DailyReport
- [ ] T080 [US4] Add REPORT_RECIPIENTS and SMTP env vars to config in src/infrastructure/config/index.ts
- [ ] T081 [US4] Wire DailyReport and EmailSenderPort in container

**Verification**:
- [ ] T082 [US4] Run US4 tests and lint

**Checkpoint**: Daily report runs on schedule and sends email; full feature set complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance and production readiness.

**Constitution & Quality**:
- [ ] T083 Verify hexagonal architecture (no business logic in controllers) across src/
- [ ] T084 Verify test coverage ≥ 80% overall (npm run coverage)
- [ ] T085 Verify functions ≤ 20 lines and files ≤ 200 lines (or document exceptions)
- [ ] T086 [P] Run npm audit and fix high/critical vulnerabilities
- [ ] T087 [P] Verify rate limiting and input validation on all API endpoints
- [ ] T088 [P] Verify /health and /metrics and graceful shutdown (SIGTERM)
- [ ] T089 [P] Verify structured logging includes correlation ID where applicable
- [ ] T090 [P] Update README with project structure, env vars, and how to run (align with specs/001-fuse-stock-trading-api/quickstart.md)
- [ ] T091 [P] Validate quickstart steps: clone, install, env, npm start, curl /health and /stocks
- [ ] T092 Run full test suite and ESLint with --max-warnings 0
- [ ] T093 Verify npm ci works from clean clone

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks** all user stories.
- **Phase 3 (US1)**: Depends on Phase 2. No dependency on US2–US4.
- **Phase 4 (US2)**: Depends on Phase 2. Uses ports and MongoDB from Phase 2.
- **Phase 5 (US3)**: Depends on Phase 2 and Phase 4 (needs PortfolioRepository). Can start after US2.
- **Phase 6 (US4)**: Depends on Phase 2 and Phase 5 (needs TransactionRepository and transactions). Can start after US3.
- **Phase 7 (Polish)**: Depends on all user story phases completed.

### User Story Completion Order

- **US1 (P1)** → **US2 (P2)** → **US3 (P3)** → **US4 (P4)** for sequential delivery.
- US1 and US2 can be parallelized after Phase 2 (different ports/adapters). US3 needs US2 (portfolio). US4 needs US3 (transactions).

### Within Each User Story

- Tests (TDD) written and failing first.
- Domain → Application → Infrastructure.
- Verification (tests + lint) at end of story.

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006 can run in parallel.
- Phase 2: T013–T020, T023–T026 can run in parallel.
- Within US1: T030–T031, T032, T035 can run in parallel; same for US2/US3/US4 unit/integration tasks marked [P].
- After Phase 2, US1 and US2 can be developed in parallel by different developers.

---

## Parallel Example: User Story 1

```bash
# After Phase 2, US1 tests in parallel:
T030 Unit test ListStocks use case
T031 Unit test Stock entity
T032 Integration test vendor adapter

# US1 implementation in order:
T035 Stock entity → T036 ListStocks use case → T038 Vendor adapter → T039 Controller → T040 Routes → T041 Swagger
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1 – List Stocks).
4. **Stop and validate**: GET /stocks and /api-docs work; run quickstart.
5. Demo/deploy MVP.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → list stocks → MVP.
3. + US2 → get portfolio → trading discovery.
4. + US3 → execute purchase → full trading.
5. + US4 → daily report → operations.
6. + Polish → production-ready.

### Task Count Summary

| Phase            | Task count | Story |
|------------------|------------|--------|
| Phase 1 Setup    | 7          | —      |
| Phase 2 Foundational | 18     | —      |
| Phase 3 US1      | 14         | US1    |
| Phase 4 US2      | 12         | US2    |
| Phase 5 US3      | 17         | US3    |
| Phase 6 US4      | 10         | US4    |
| Phase 7 Polish    | 11         | —      |
| **Total**        | **89**     |        |

- **Independent test criteria**: Each phase lists "Independent Test" and "Checkpoint" for that story.
- **MVP scope**: Phase 1 + Phase 2 + Phase 3 (List Stocks).
- **Format**: All tasks use `- [ ] [TaskID] [P?] [Story?] Description with file path`.
