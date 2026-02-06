---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!-- 
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  
  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/
  
  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment
  
  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure following constitution

- [ ] T001 Create hexagonal architecture structure (domain, application, infrastructure, ports)
- [ ] T002 Initialize Node.js project with TypeScript and essential dependencies
- [ ] T003 [P] Configure ESLint with security plugins (eslint-plugin-security, eslint-plugin-node)
- [ ] T004 [P] Configure Prettier for code formatting
- [ ] T005 [P] Setup testing framework (Jest/Vitest) with coverage reporting
- [ ] T006 [P] Configure Git hooks (husky) for pre-commit linting and tests
- [ ] T007 Setup dependency injection container (tsyringe/awilix) for clean DI

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure following constitution principles

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Error Handling (Constitution Principle V)**:
- [ ] T010 Create custom error classes extending built-in Error (AppError, DomainError, ValidationError)
- [ ] T011 Implement centralized error handler middleware
- [ ] T012 Register global handlers for unhandledRejection and uncaughtException

**Logging & Observability (Constitution Principle VI)**:
- [ ] T013 [P] Setup structured logging with pino/winston (log to stdout)
- [ ] T014 [P] Implement AsyncLocalStorage for request correlation IDs
- [ ] T015 [P] Create /health endpoint (liveness + readiness checks)
- [ ] T016 [P] Create /metrics endpoint (Prometheus format)

**Security (Constitution Principle VII)**:
- [ ] T017 [P] Setup helmet middleware for secure HTTP headers
- [ ] T018 [P] Implement rate limiting middleware (express-rate-limit)
- [ ] T019 [P] Setup input validation middleware (joi/zod)
- [ ] T020 [P] Configure CORS properly (no wildcard in production)

**Configuration & Environment**:
- [ ] T021 Setup environment-aware config with validation (convict/env-var/zod)
- [ ] T022 Implement graceful shutdown handlers (SIGTERM, SIGINT)

**Port Definitions (Hexagonal Architecture)**:
- [ ] T023 [P] Define repository port interfaces in src/ports/repositories/
- [ ] T024 [P] Define external service port interfaces in src/ports/services/

**Infrastructure Setup** (if database/external services needed):
- [ ] T025 Setup database connection with connection pooling
- [ ] T026 Implement repository adapters in src/infrastructure/persistence/
- [ ] T027 Setup migrations framework (TypeORM/Prisma migrations)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (MANDATORY per Constitution) ⚠️

> **CRITICAL (Constitution Principle IV - TDD)**: Write these tests FIRST, ensure they FAIL before implementation
> Follow testing pyramid: 70% unit, 20% integration, 5% contract, 5% e2e

**Unit Tests (Domain & Application Layer)**:
- [ ] T030 [P] [US1] Unit test for [Entity] business logic in tests/unit/domain/test-[entity].spec.ts
- [ ] T031 [P] [US1] Unit test for [DomainService] in tests/unit/domain/test-[service].spec.ts  
- [ ] T032 [P] [US1] Unit test for [UseCase] application service in tests/unit/application/test-[use-case].spec.ts

**Integration Tests (Infrastructure Layer)**:
- [ ] T033 [P] [US1] Integration test for [Repository] with real DB in tests/integration/test-[repository].spec.ts
- [ ] T034 [P] [US1] Integration test for [ExternalService] adapter in tests/integration/test-[service].spec.ts

**Contract Tests (API)**:
- [ ] T035 [US1] Contract test for [POST/GET /endpoint] in tests/contract/test-[endpoint].spec.ts

**E2E Tests (Critical User Journey Only)**:
- [ ] T036 [US1] E2E test for [critical user journey] in tests/e2e/test-[journey].spec.ts

### Implementation for User Story 1 (After Tests Are Written & Failing)

> **Hexagonal Architecture Enforcement**: Follow layer order - Domain → Application → Infrastructure

**Domain Layer (Pure Business Logic - NO external dependencies)**:
- [ ] T040 [P] [US1] Create [Entity1] in src/domain/entities/[entity1].ts
- [ ] T041 [P] [US1] Create [Entity2] in src/domain/entities/[entity2].ts
- [ ] T042 [US1] Implement [DomainService] in src/domain/services/[service].ts
- [ ] T043 [US1] Create domain-specific errors in src/domain/errors/[error].ts

**Application Layer (Use Cases - Orchestrates Domain Logic)**:
- [ ] T044 [US1] Define [Repository] port interface in src/ports/repositories/[repository].port.ts
- [ ] T045 [US1] Implement [UseCase] in src/application/use-cases/[use-case].ts

**Infrastructure Layer (Adapters for External Concerns)**:
- [ ] T046 [US1] Implement [Repository] adapter in src/infrastructure/persistence/[repository].ts
- [ ] T047 [US1] Create [Controller] in src/infrastructure/http/controllers/[controller].ts
- [ ] T048 [US1] Define routes in src/infrastructure/http/routes/[feature].routes.ts
- [ ] T049 [US1] Add input validation middleware for endpoints (use joi/zod schemas)
- [ ] T050 [US1] Add error handling for user story 1 operations (operational errors)
- [ ] T051 [US1] Add structured logging with correlation IDs for user story 1

**Verification**:
- [ ] T052 [US1] Run all tests - verify ≥80% coverage for user story 1 code
- [ ] T053 [US1] Run ESLint - verify no security/style violations
- [ ] T054 [US1] Verify SOLID principles compliance in code review

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

- [ ] T018 [P] [US2] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T019 [P] [US2] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create [Entity] model in src/models/[entity].py
- [ ] T021 [US2] Implement [Service] in src/services/[service].py
- [ ] T022 [US2] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T023 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

- [ ] T024 [P] [US3] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T025 [P] [US3] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 3

- [ ] T026 [P] [US3] Create [Entity] model in src/models/[entity].py
- [ ] T027 [US3] Implement [Service] in src/services/[service].py
- [ ] T028 [US3] Implement [endpoint/feature] in src/[location]/[file].py

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance verification and final improvements

**Constitution Compliance Audit**:
- [ ] TXXX Verify hexagonal architecture adherence (no business logic in controllers)
- [ ] TXXX Verify SOLID principles across all code
- [ ] TXXX Verify test coverage ≥ 80% overall
- [ ] TXXX Verify all functions ≤ 20 lines (or justified exceptions documented)
- [ ] TXXX Verify all files ≤ 200 lines (or justified exceptions documented)
- [ ] TXXX Verify naming conventions followed throughout

**Security Final Checks**:
- [ ] TXXX [P] Run npm audit and resolve all high/critical vulnerabilities
- [ ] TXXX [P] Run snyk test for additional vulnerability scanning
- [ ] TXXX [P] Verify no secrets in code (use git-secrets or similar)
- [ ] TXXX [P] Verify rate limiting on all endpoints
- [ ] TXXX [P] Verify input validation on all endpoints

**Production Readiness**:
- [ ] TXXX [P] Verify /health endpoint returns proper status
- [ ] TXXX [P] Verify /metrics endpoint exposes key metrics
- [ ] TXXX [P] Verify graceful shutdown works (test SIGTERM handling)
- [ ] TXXX [P] Verify structured logging includes correlation IDs
- [ ] TXXX [P] Verify error responses don't leak sensitive info

**Performance & Optimization**:
- [ ] TXXX Profile critical paths (identify bottlenecks)
- [ ] TXXX Optimize database queries (add indexes if needed)
- [ ] TXXX Verify event loop not blocked (no synchronous CPU-heavy operations)

**Documentation**:
- [ ] TXXX [P] Update README with project structure and architecture overview
- [ ] TXXX [P] Document API endpoints (OpenAPI/Swagger)
- [ ] TXXX [P] Create quickstart.md for local development setup
- [ ] TXXX [P] Document environment variables and configuration

**Docker (if applicable)**:
- [ ] TXXX Create multi-stage Dockerfile following best practices
- [ ] TXXX Add .dockerignore to prevent secrets leakage
- [ ] TXXX Use non-root USER in Dockerfile
- [ ] TXXX Scan Docker image for vulnerabilities (docker scan or trivy)
- [ ] TXXX Lint Dockerfile with hadolint

**Final Verification**:
- [ ] TXXX Run full test suite (unit, integration, contract, e2e)
- [ ] TXXX Run ESLint with --max-warnings 0
- [ ] TXXX Verify npm ci works (clean install from lockfile)
- [ ] TXXX Run quickstart.md validation (ensure setup instructions work)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
