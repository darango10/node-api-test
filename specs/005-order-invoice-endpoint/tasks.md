# Tasks: Order Invoice Endpoint (VTEX Integration)

**Input**: Design documents from `/specs/005-order-invoice-endpoint/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Constitution (NFR-009) requires TDD; tests are included and must be written first per story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. The existing codebase already has shared infrastructure (Express, Pino, health, metrics, container); this feature adds the invoicing vertical slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Feature slice**: `src/features/invoicing/` (domain, application, infrastructure, ports)
- **Tests**: `tests/unit/features/invoicing/`, `tests/integration/`, `tests/contract/`, `tests/e2e/`
- **Shared**: `src/features/shared/` (existing app, container, config)

---

## Phase 1: Setup (Invoicing Feature Slice)

**Purpose**: Create invoicing vertical slice structure and config; project (Node, Express, Vitest) already exists.

- [x] T001 Create invoicing feature slice structure (domain/entities, domain/services, domain/errors, application/use-cases, infrastructure/controllers, infrastructure/routes, infrastructure/adapters, ports/services) in src/features/invoicing/
- [x] T002 Add invoicing environment variables to config schema (ORDER_STATUS_WEBHOOK_TOKEN, VTEX_APP_KEY, VTEX_APP_TOKEN, VTEX_ACCOUNT_NAME, VTEX_ENVIRONMENT, INVOICE_TARGET_ORDER_STATUS, optional INVOICE_DLQ_PATH, INVOICE_ASYNC_THRESHOLD_MS) in src/features/shared/infrastructure/config/ or new src/features/invoicing/infrastructure/config/

---

## Phase 2: Foundational (Invoicing Ports & Blocking Prerequisites)

**Purpose**: Define ports for external dependencies; required before any user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Define VtexInvoicePort interface (submitInvoice(orderId, body)) in src/features/invoicing/ports/services/vtex-invoice.port.ts
- [x] T004 [P] Define SecretsPort interface (getVtexCredentials()) in src/features/invoicing/ports/services/secrets.port.ts
- [x] T005 [P] Define DLQPort interface (sendFailedPayload(payload, metadata)) in src/features/invoicing/ports/services/dlq.port.ts

**Checkpoint**: Ports defined; US1, US2, US3 can proceed

---

## Phase 3: User Story 1 - Receive Order Status and Trigger Invoice (Priority: P1) 🎯 MVP

**Goal**: External systems can POST order status to the webhook; when status is PREPARING_SHIPPING or DELIVERED, the system validates, transforms, and calls VTEX invoice API; endpoint is secured with Bearer/API key.

**Independent Test**: Send valid payload with status PREPARING_SHIPPING or DELIVERED and verify downstream invoice is requested and endpoint returns success.

### Tests for User Story 1 (TDD – write first, then implement)

- [ ] T006 [P] [US1] Unit test for order status validation (orderId present, items non-empty, orderStatus in target list) in tests/unit/features/invoicing/validate-order-status.spec.ts
- [ ] T007 [P] [US1] Unit test for transform to VTEX payload (price to cents, description 255 chars, invoice number, issuance date, invoice value) in tests/unit/features/invoicing/transform-to-invoice.spec.ts
- [ ] T008 [P] [US1] Unit test for ProcessOrderStatusUpdate use case with mocked ports in tests/unit/features/invoicing/process-order-status-update.spec.ts
- [ ] T009 [US1] Contract test for POST /api/v1/webhooks/orders/status (200, 400, 401, request body schema) in tests/contract/invoicing-webhook.spec.ts

### Implementation for User Story 1 (after tests written and failing)

**Domain Layer**:
- [ ] T010 [P] [US1] Create OrderStatusUpdate and LineItem (inbound) value types in src/features/invoicing/domain/entities/order-status-update.ts
- [ ] T011 [P] [US1] Create InvoiceRequest and LineItem (outbound) value types in src/features/invoicing/domain/entities/invoice-request.ts
- [ ] T012 [US1] Implement validateOrderStatus (orderId, items length, orderStatus in target list) in src/features/invoicing/domain/services/validate-order-status.ts
- [ ] T013 [US1] Implement transformToInvoiceRequest (price to cents, description truncate 255, invoice number INV-{orderId}, issuance date UTC, invoice value sum) in src/features/invoicing/domain/services/transform-to-invoice.ts

**Application Layer**:
- [ ] T014 [US1] Implement ProcessOrderStatusUpdate use case in src/features/invoicing/application/use-cases/process-order-status-update.ts

**Infrastructure Layer**:
- [ ] T015 [US1] Implement SecretsPort adapter (read VTEX_APP_KEY, VTEX_APP_TOKEN from env) in src/features/invoicing/infrastructure/adapters/env-secrets.adapter.ts
- [ ] T016 [US1] Implement VtexInvoicePort adapter (Axios POST to VTEX OMS invoice URL, no retry in US1) in src/features/invoicing/infrastructure/adapters/vtex-invoice.adapter.ts
- [ ] T017 [US1] Implement webhook auth middleware (Bearer or API key from ORDER_STATUS_WEBHOOK_TOKEN) in src/features/invoicing/infrastructure/middlewares/webhook-auth.middleware.ts
- [ ] T018 [US1] Create order status webhook controller (parse body, call use case, return 200/400/401) in src/features/invoicing/infrastructure/controllers/order-status-webhook.controller.ts
- [ ] T019 [US1] Define POST /api/v1/webhooks/orders/status route and Zod request schema in src/features/invoicing/infrastructure/routes/invoicing.routes.ts
- [ ] T020 [US1] Register invoicing routes and ProcessOrderStatusUpdate use case in src/features/shared/infrastructure/http/app.ts and src/features/shared/infrastructure/config/container.ts

**Verification**:
- [ ] T021 [US1] Run tests for invoicing slice; verify coverage ≥80% and ESLint passes for src/features/invoicing/

**Checkpoint**: User Story 1 complete; webhook accepts payload, validates, transforms, calls VTEX; can be tested independently

---

## Phase 4: User Story 2 - Automatic Order Lifecycle and Financial Capture (Priority: P2)

**Goal**: When VTEX accepts the invoice, the caller receives a clear success response so the external system can consider the event delivered; E2E verification of the full flow.

**Independent Test**: End-to-end: send status update → mock VTEX 200 → verify 200 response and response body per contract.

- [ ] T022 [P] [US2] E2E test for webhook → mock VTEX 200 → 200 response with body shape in tests/e2e/invoicing-webhook-success.spec.ts
- [ ] T023 [US2] Verify 200 response body and status when VTEX accepts (align controller and contract in src/features/invoicing/infrastructure/controllers/order-status-webhook.controller.ts and specs/005-order-invoice-endpoint/contracts/webhook-order-status.yaml)

**Checkpoint**: User Stories 1 and 2 verified; success path complete

---

## Phase 5: User Story 3 - Visibility and Recovery When Downstream Fails (Priority: P3)

**Goal**: Retry on 429/5xx with exponential backoff; after max retries route to DLQ; no retry on 4xx; structured logging with request id, orderId, outcome, timing; secrets masked in logs.

**Independent Test**: Simulate 429/5xx and verify retry and DLQ; simulate 4xx and verify no retry; verify logs do not contain tokens.

### Tests for User Story 3

- [ ] T024 [P] [US3] Integration test for VTEX adapter retry on 429 and 5xx (nock) in tests/integration/invoicing-vtex-retry.spec.ts
- [ ] T025 [P] [US3] Integration test for DLQ when max retries exceeded in tests/integration/invoicing-dlq.spec.ts

### Implementation for User Story 3

- [ ] T026 [US3] Add exponential backoff retry (base 2s, multiplier 2x, max 5 attempts) to VTEX adapter in src/features/invoicing/infrastructure/adapters/vtex-invoice.adapter.ts
- [ ] T027 [US3] Do not retry on 4xx; log as integration error in src/features/invoicing/infrastructure/adapters/vtex-invoice.adapter.ts
- [ ] T028 [US3] On max retries exceeded call DLQPort with payload and metadata in src/features/invoicing/infrastructure/adapters/vtex-invoice.adapter.ts (or use case)
- [ ] T029 [US3] Implement DLQPort file-based adapter (append to INVOICE_DLQ_PATH) in src/features/invoicing/infrastructure/adapters/file-dlq.adapter.ts
- [ ] T030 [US3] Add structured logging (request id, orderId, status match, outcome, VTEX response status, response time) and mask secrets in src/features/invoicing/infrastructure/ and use case
- [ ] T031 [US3] Wire DLQ adapter in container and ensure VTEX adapter receives DLQPort in src/features/shared/infrastructure/config/container.ts
- [ ] T032 [US3] Run full test suite for invoicing; verify coverage ≥80% and ESLint passes

**Checkpoint**: All three user stories complete; retry, DLQ, and logging in place

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance and production readiness for the invoicing feature.

- [ ] T033 Verify hexagonal architecture for invoicing (no business logic in controller) in src/features/invoicing/
- [ ] T034 [P] Run npm audit and resolve high/critical vulnerabilities
- [ ] T035 [P] Verify rate limiting applied to POST /api/v1/webhooks/orders/status in src/features/shared/infrastructure/http/app.ts
- [ ] T036 [P] Verify no secrets or tokens in logs (grep or manual check)
- [ ] T037 Run full test suite (unit, integration, contract, e2e); verify coverage ≥80%
- [ ] T038 [P] Update OpenAPI or API docs with POST /api/v1/webhooks/orders/status if using shared openapi.yaml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; create invoicing slice and config.
- **Phase 2 (Foundational)**: Depends on Phase 1; defines ports. **Blocks** all user stories.
- **Phase 3 (US1)**: Depends on Phase 2. Delivers MVP (webhook + validate + transform + VTEX call + auth).
- **Phase 4 (US2)**: Depends on Phase 3. Verification and E2E for success path.
- **Phase 5 (US3)**: Depends on Phase 3 (retry/DLQ extend VTEX adapter and use case). Can overlap with US2.
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only. No dependency on US2/US3.
- **US2 (P2)**: Depends on US1 (same endpoint; verification and E2E).
- **US3 (P3)**: Depends on US1 (adds retry, DLQ, logging to same flow).

### Within Each User Story

- Tests (T006–T009 for US1, T024–T025 for US3) must be written and **failing** before implementation.
- Domain (entities, validation, transform) before application (use case).
- Application (use case) before infrastructure (adapters, controller, routes).
- Wire routes and container after controller and adapters.

### Parallel Opportunities

- T003, T004, T005 can run in parallel.
- T006, T007, T008 can run in parallel; T009 after.
- T010, T011 can run in parallel; T012, T013 after; T014 after domain.
- T015, T016 can run in parallel; T017, T018, T019 in sequence; T020 after.
- T022 (E2E) can run in parallel with T024, T025 (integration).
- T026–T031 (US3 impl) largely sequential in same adapter/files; T029 (DLQ adapter) can be parallel to T026–T028.

---

## Parallel Example: User Story 1

```bash
# After Phase 2, run unit tests in parallel:
# T006 validate-order-status.spec.ts
# T007 transform-to-invoice.spec.ts
# T008 process-order-status-update.spec.ts

# Domain entities in parallel:
# T010 order-status-update.ts
# T011 invoice-request.ts

# Adapters in parallel (after use case):
# T015 env-secrets.adapter.ts
# T016 vtex-invoice.adapter.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1): tests first (T006–T009), then domain → application → infrastructure (T010–T020), then T021.
3. **STOP and VALIDATE**: Test webhook with valid payload (PREPARING_SHIPPING or DELIVERED) and mock VTEX; verify 200 and VTEX called.
4. Deploy or demo MVP.

### Incremental Delivery

1. Phase 1 + 2 → Foundation for invoicing.
2. Phase 3 (US1) → MVP: webhook + validate + transform + VTEX + auth.
3. Phase 4 (US2) → E2E and contract verification for success path.
4. Phase 5 (US3) → Retry, DLQ, logging.
5. Phase 6 → Polish and compliance.

### Task Count Summary

| Phase   | Story | Task count |
|---------|-------|------------|
| Phase 1 | Setup | 2 (T001–T002) |
| Phase 2 | Foundational | 3 (T003–T005) |
| Phase 3 | US1 | 16 (T006–T021) |
| Phase 4 | US2 | 2 (T022–T023) |
| Phase 5 | US3 | 9 (T024–T032) |
| Phase 6 | Polish | 6 (T033–T038) |
| **Total** | | **38** |

- **MVP scope**: Phases 1–3 (21 tasks through T021).
- **Independent test criteria**: US1 = valid payload + target status → 200 and VTEX called; US2 = E2E 200 and body shape; US3 = retry/DLQ and logging verified by tests.

---

## Notes

- [P] = different files or independent subtasks; safe to run in parallel.
- [USn] = task belongs to that user story for traceability.
- Each task includes a file path or clear scope so an LLM can execute it without extra context.
- Commit after each task or logical group; stop at checkpoints to validate the story.
