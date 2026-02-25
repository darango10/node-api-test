# Implementation Plan: Order Invoice Endpoint (VTEX Integration)

**Branch**: `005-order-invoice-endpoint` | **Date**: 2026-02-25 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-order-invoice-endpoint/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a webhook endpoint that receives order status updates from external systems (ERP/WMS/Logistics), validates and transforms the payload, and triggers the VTEX Order Management System invoice API. The implementation follows hexagonal architecture as a new vertical slice (`invoicing`), with retry (exponential backoff) and dead-letter handling for downstream failures, ingress authentication, and credentials from a secure store.

## Technical Context

**Language/Version**: Node.js ≥20, TypeScript 5.x  
**Primary Dependencies**: Express, Zod (validation), Axios (downstream HTTP), Pino (logging), existing shared config/container  
**Storage**: No new persistence for core flow; DLQ may use file, DB table, or external queue (see research.md).  
**Testing**: Vitest (unit, integration), Supertest (contract), nock (HTTP mocking)  
**Target Platform**: Linux server (existing API host)  
**Project Type**: Single Node.js API (vertical slice within existing `src/features`)  
**Performance Goals**: Validation + transformation &lt;200ms per request; support expected peak (e.g. Black Friday) load  
**Constraints**: Ingress secured (API key or Bearer); VTEX credentials from env or vault; no secrets in logs  
**Scale/Scope**: One new feature slice (invoicing); one inbound endpoint; one downstream (VTEX OMS) integration  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Architecture Compliance**:
- [x] Hexagonal Architecture: Domain, Application, and Infrastructure layers clearly separated (invoicing feature slice)
- [x] No business logic in controllers/HTTP handlers (must be in domain/application layers)
- [x] Ports (interfaces) defined for all external dependencies (VTEX client, secrets, DLQ)
- [x] Infrastructure adapters implement ports (not vice versa)

**Code Quality Compliance**:
- [x] SOLID principles applied (single responsibility, dependency inversion, etc.)
- [x] Modules structured by business components (new feature: invoicing)
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
- [x] Input validation with schemas (Zod for webhook payload)
- [x] No secrets in code (use environment variables or vault)
- [x] Rate limiting on all endpoints (including webhook)
- [x] Helmet middleware for secure headers
- [x] ORM/ODM used where persistence exists; no raw query injection (N/A for VTEX HTTP client)

**Production Readiness Compliance**:
- [x] Structured logging to stdout (Pino)
- [x] `/health` and `/metrics` endpoints exposed
- [x] Graceful shutdown handlers (SIGTERM, SIGINT)
- [x] Configuration validated at startup
- [x] Dependencies locked (package-lock.json)
- [x] `NODE_ENV=production` set in production

## Project Structure

### Documentation (this feature)

```text
specs/005-order-invoice-endpoint/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI, VTEX mapping)
└── tasks.md             # Phase 2 output (/speckit.tasks - not created by plan)
```

### Source Code (repository root)

Existing layout is preserved; the new **invoicing** feature is added as a vertical slice under `src/features`:

```text
src/
├── features/
│   ├── invoicing/                    # NEW: Order invoice webhook feature
│   │   ├── domain/
│   │   │   ├── entities/             # OrderStatusUpdate, InvoiceRequest, LineItem (value objects)
│   │   │   ├── services/             # Transform logic (payload → VTEX schema), validation rules
│   │   │   └── errors/               # ValidationError, DownstreamError (if not in shared)
│   │   ├── application/
│   │   │   └── use-cases/            # ProcessOrderStatusUpdate (orchestrate validate → transform → call port)
│   │   ├── infrastructure/
│   │   │   ├── controllers/         # Webhook controller (parse, auth, call use case, respond 200/202/4xx)
│   │   │   ├── routes/              # POST /api/v1/webhooks/orders/status
│   │   │   ├── adapters/             # VTEX OMS HTTP client (implements VtexInvoicePort), DLQ adapter
│   │   │   └── (optional) config/   # Invoicing-specific config (target status, VTEX base URL, retry params)
│   │   └── ports/
│   │       └── services/             # VtexInvoicePort (submit invoice), SecretsPort (get VTEX creds), DLQPort (send failed payload)
│   ├── shared/                       # Existing: config, http, persistence, domain/errors, ports
│   ├── stocks/
│   ├── portfolio/
│   ├── purchases/
│   └── sales/
└── index.ts

tests/
├── unit/              # Invoicing domain + application (transform, validation, use case)
├── integration/       # VTEX adapter with nock; DLQ adapter if applicable
├── contract/          # POST /api/v1/webhooks/orders/status request/response
└── e2e/              # Optional: full webhook → mock VTEX
```

**Structure Decision**: Single Node.js API with vertical slicing (constitution). The new **invoicing** feature is a self-contained slice with domain (validation, transformation), application (use case), infrastructure (webhook controller, VTEX adapter, optional DLQ adapter), and ports (VtexInvoicePort, SecretsPort, DLQPort). Shared layer continues to provide HTTP app, config, logging, and error handling; invoicing-specific config (target status, VTEX URL, retry policy) is read from environment or shared config module.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |
