# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Architecture Compliance**:
- [ ] Hexagonal Architecture: Domain, Application, and Infrastructure layers clearly separated
- [ ] No business logic in controllers/HTTP handlers (must be in domain/application layers)
- [ ] Ports (interfaces) defined for all external dependencies
- [ ] Infrastructure adapters implement ports (not vice versa)

**Code Quality Compliance**:
- [ ] SOLID principles applied (single responsibility, dependency inversion, etc.)
- [ ] Modules structured by business components (not technical layers)
- [ ] No functions > 20 lines without justification
- [ ] No files > 200 lines without justification
- [ ] Naming conventions followed (camelCase, PascalCase, UPPER_SNAKE_CASE)

**Testing Compliance**:
- [ ] TDD approach: Tests written before implementation
- [ ] Testing pyramid followed: 70% unit, 20% integration, 5% contract, 5% e2e
- [ ] Test coverage target ≥ 80%
- [ ] AAA pattern (Arrange-Act-Assert) in all tests
- [ ] Test names follow format: "should [expected behavior] when [condition]"

**Error Handling Compliance**:
- [ ] Custom error classes extend built-in Error
- [ ] Operational vs. programmer errors distinguished
- [ ] Centralized error handler implemented
- [ ] All async code uses async/await (no callbacks)
- [ ] `unhandledRejection` and `uncaughtException` handlers registered

**Security Compliance**:
- [ ] ESLint with security plugins configured
- [ ] Input validation with schemas (joi/zod/ajv)
- [ ] No secrets in code (use environment variables)
- [ ] Rate limiting on all endpoints
- [ ] Helmet middleware for secure headers
- [ ] ORM/ODM used to prevent injection attacks

**Production Readiness Compliance**:
- [ ] Structured logging to stdout (pino/winston)
- [ ] `/health` and `/metrics` endpoints exposed
- [ ] Graceful shutdown handlers (SIGTERM, SIGINT)
- [ ] Configuration validated at startup
- [ ] Dependencies locked (package-lock.json)
- [ ] `NODE_ENV=production` set in production

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
  
  IMPORTANT: Must follow Hexagonal Architecture (see constitution)
-->

```text
# [REMOVE IF UNUSED] Option 1: Single Node.js API (DEFAULT - Hexagonal Architecture)
src/
├── domain/              # Business logic, entities, domain services (NO external deps)
│   ├── entities/       # Domain models (e.g., User, Order)
│   ├── services/       # Domain services (pure business logic)
│   └── errors/         # Custom domain errors
├── application/        # Use cases, application services
│   ├── use-cases/      # Application use cases (orchestrate domain logic)
│   └── services/       # Application services
├── infrastructure/     # Adapters for external concerns
│   ├── http/          # Express routes, controllers, middlewares
│   ├── persistence/   # Database implementations (TypeORM, Prisma, etc.)
│   ├── external/      # Third-party API clients
│   └── config/        # Configuration management
└── ports/             # Interfaces/contracts (domain defines, infrastructure implements)
    ├── repositories/  # Repository interfaces
    └── services/      # External service interfaces

tests/
├── unit/              # Domain & application layer tests (70%)
├── integration/       # Infrastructure adapter tests (20%)
├── contract/          # API contract tests (5%)
└── e2e/              # End-to-end user journey tests (5%)

# [REMOVE IF UNUSED] Option 2: Monorepo with multiple Node.js services
services/
├── service-a/
│   ├── src/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── ports/
│   └── tests/
├── service-b/
│   └── [same structure as service-a]
└── shared/
    ├── types/
    └── utils/

# [REMOVE IF UNUSED] Option 3: Full-stack with Node.js backend + frontend
backend/
├── src/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── ports/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
