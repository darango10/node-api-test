# Tasks: Execute Sell Order

**Input**: Design documents from `/specs/003-execute-sell-order/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution (TDD, testing pyramid). Tests written first, then implementation.

**Organization**: Single user story (P1 — Execute Market Sell Order). Foundation tasks block US1; no Phase 1 project setup (existing codebase).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: User Story 1 — Execute Market Sell Order (P1)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Minimal — Existing Project)

**Purpose**: Confirm feature context; no new project initialization.

- [x] T001 Verify feature branch and design docs (plan.md, spec.md, data-model.md, contracts/) at specs/003-execute-sell-order/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Port and domain error changes required before use case and repository implementation.

**⚠️ CRITICAL**: User Story 1 implementation cannot start until this phase is complete.

- [x] T002 Add reducePosition(userId: string, symbol: string, quantity: number): Promise<void> to PortfolioRepositoryPort in src/ports/repositories/portfolio-repository.port.ts (semantics: atomic reduce; throws on insufficient shares with currentHeldQuantity)
- [x] T003 Add InsufficientSharesError class (extends AppError, statusCode 400, property currentHeldQuantity: number) in src/domain/errors/index.ts (or src/domain/errors/insufficient-shares.error.ts and export from index)

---

## Phase 3: User Story 1 — Execute Market Sell Order (Priority: P1) — MVP

**Goal**: User can submit a sell order (symbol, quantity); system validates ownership and quantity, gets current price from vendor, updates portfolio locally, records transaction; errors for insufficient shares include currentHeldQuantity.

**Independent Test**: POST /users/:userId/sales with body { symbol, quantity }; user holds ≥ quantity → 201 and portfolio reduced; user holds < quantity → 400 with currentHeldQuantity; vendor down → 502.

### Tests for User Story 1 (TDD — Write First, Then Implementation)

**Unit tests**:
- [ ] T004 [P] [US1] Unit test ExecuteSell use case (success, insufficient shares, market unavailable, validation errors) in tests/unit/application/execute-sell.spec.ts
- [ ] T005 [P] [US1] Unit test InsufficientSharesError and currentHeldQuantity in tests/unit/domain/errors.spec.ts (or extend existing domain error tests)

**Integration tests**:
- [ ] T006 [P] [US1] Integration test PortfolioRepositoryImpl.reducePosition (atomic decrement, insufficient shares throws with currentHeldQuantity) in tests/integration/portfolio-repository.spec.ts

**Contract tests**:
- [ ] T007 [US1] Contract test POST /users/:userId/sales (201 success, 400 validation/insufficient shares with currentHeldQuantity, 502 market unavailable) in tests/contract/sales.spec.ts

### Implementation for User Story 1 (After Tests Written and Failing)

**Domain**:
- [ ] T008 [US1] Add optional type?: 'purchase' | 'sell' to Transaction entity and constructor in src/domain/entities/transaction.ts (backward compatible; existing code unchanged)

**Infrastructure — persistence**:
- [ ] T009 [US1] Implement reducePosition in PortfolioRepositoryImpl with MongoDB atomic update (condition position.quantity >= quantity; throw InsufficientSharesError with currentHeldQuantity on no position or insufficient) in src/infrastructure/persistence/portfolio.repository.ts

**Application**:
- [ ] T010 [US1] Implement ExecuteSell use case (validate request → get portfolio → check quantity → getCurrentPrice → reducePosition → save transaction; handle InsufficientSharesError, vendor errors, price tolerance) in src/application/use-cases/execute-sell.ts

**Infrastructure — HTTP**:
- [ ] T011 [US1] Create SalesController (POST handler, Zod validation for body, map InsufficientSharesError to 400 with currentHeldQuantity, vendor errors to 502) in src/infrastructure/http/controllers/sales.controller.ts
- [ ] T012 [US1] Create sales routes (POST /users/:userId/sales) and mount in app in src/infrastructure/http/routes/sales.routes.ts and src/infrastructure/http/app.ts
- [ ] T013 [US1] Merge sell path and schemas from specs/003-execute-sell-order/contracts/openapi-sell.yaml into src/infrastructure/http/openapi.yaml (add Sales tag if missing)

**DI and wiring**:
- [ ] T014 [US1] Register ExecuteSell and SalesController in container and mount sales routes in src/infrastructure/config/container.ts and src/infrastructure/http/app.ts

**Verification**:
- [ ] T015 [US1] Run full test suite and verify ≥80% coverage for sell-related code (execute-sell, sales.controller, portfolio reducePosition)
- [ ] T016 [US1] Run ESLint (npm run lint) and fix any violations in new or modified files

**Checkpoint**: User Story 1 complete — sell order executable and independently testable.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance and documentation.

- [ ] T017 [P] Verify POST /users/:userId/sales has rate limiting (existing global or route-specific) and Zod validation in src/infrastructure/http/
- [ ] T018 [P] Verify error responses for sell do not leak internal details and include currentHeldQuantity for insufficient shares per spec
- [ ] T019 [P] Update quickstart or README if needed for running and testing sell endpoint (specs/003-execute-sell-order/quickstart.md or project README)
- [ ] T020 Run full test suite (npm test), ESLint (npm run lint), and verify quickstart steps for sell

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks** Phase 3.
- **Phase 3 (US1)**: Depends on Phase 2. Tests (T004–T007) written first; then implementation (T008–T014); then verification (T015–T016).
- **Phase 4 (Polish)**: Depends on Phase 3 completion.

### User story dependencies

- **User Story 1 (P1)**: Only story; no other story dependencies.

### Within User Story 1

- T004–T007 (tests) → T008–T014 (implementation) → T015–T016 (verification).
- T008 (Transaction type) and T009 (reducePosition impl) can be done in either order after tests; T010 depends on T002, T003, T009; T011–T014 depend on T010.

### Parallel opportunities

- T004, T005, T006 can run in parallel (different test files).
- T008 (Transaction) and T009 (reducePosition impl) are independent after foundation.
- T017, T018, T019 in Phase 4 can run in parallel.

---

## Parallel Example: User Story 1 Tests

```bash
# Run unit and integration tests for sell in parallel (after T002–T003):
# Task T004: tests/unit/application/execute-sell.spec.ts
# Task T005: tests/unit/domain/errors.spec.ts
# Task T006: tests/integration/portfolio-repository.spec.ts
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 1 (T001).
2. Complete Phase 2 (T002–T003).
3. Write tests T004–T007; ensure they fail.
4. Implement T008–T014; make tests pass.
5. Run T015–T016; fix coverage/lint.
6. Optional: Phase 4 (T017–T020).

### Task count summary

| Phase            | Task IDs   | Count |
|-----------------|------------|-------|
| Phase 1 Setup   | T001       | 1     |
| Phase 2 Foundational | T002–T003 | 2     |
| Phase 3 US1     | T004–T016  | 13    |
| Phase 4 Polish  | T017–T020  | 4     |
| **Total**       |            | **20**|

### Independent test criteria (US1)

- **Success**: User with position ≥ quantity can sell; portfolio decreases; 201 with transaction.
- **Insufficient shares**: User with position < quantity or no position gets 400 with `currentHeldQuantity` in body.
- **Market unavailable**: Vendor getCurrentPrice failure → 502.
- **Validation**: Missing/invalid symbol or quantity → 400 before business logic.

### Format validation

- All tasks use `- [ ] [TaskID] [P?] [Story?] Description with file path`.
- [P] used only where tasks are parallelizable.
- [US1] used for all Phase 3 tasks.
- Setup and Foundational have no story label; Polish has no story label.
