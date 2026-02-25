# Feature Specification: Order Invoice Endpoint (VTEX Integration)

**Feature Branch**: `005-order-invoice-endpoint`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "Add an endpoint to invoice orders on this API. Take a look on this PRD (VTEX Order Invoice Integration)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Order Status and Trigger Invoice (Priority: P1)

As an external Logistics or ERP system, I send a standardized order status update payload to a single, reliable endpoint so that the e-commerce platform knows when an order is ready for invoicing and can trigger the invoice process automatically.

**Why this priority**: Core value of the feature; without it, no invoicing is triggered.

**Independent Test**: Can be fully tested by sending a valid payload with status "PREPARING_SHIPPING" or "DELIVERED" and verifying the downstream invoice is requested and that the endpoint returns success.

**Acceptance Scenarios**:

1. **Given** a valid payload with `orderStatus` equal to one of the configured target statuses (e.g. "PREPARING_SHIPPING" or "DELIVERED"), **When** the payload is sent to the endpoint, **Then** the system validates it, transforms it to the downstream invoice format, and triggers the invoice request.
2. **Given** a valid payload with a non-empty `items` array and a valid `orderId`, **When** the payload is sent, **Then** the system includes all items in the transformed request with correct field mapping (e.g. prices in cents, descriptions truncated if needed).
3. **Given** the caller has provided valid ingress authentication, **When** the payload is sent, **Then** the request is accepted and processed; downstream calls use credentials from a secure store, not from the request.

---

### User Story 2 - Automatic Order Lifecycle and Financial Capture (Priority: P2)

As an E-commerce Operations Manager, I want orders to transition to "Invoiced" in the order management system once fulfillment begins, so that revenue is captured correctly and customers receive accurate notifications without manual steps.

**Why this priority**: Business outcome (financial capture and notifications) depends on P1; this story describes the result of successful integration.

**Independent Test**: Can be tested by end-to-end flow: send status update → verify order is invoiced in the OMS and that financial/notification systems reflect the new state.

**Acceptance Scenarios**:

1. **Given** an order in a status that indicates "ready for invoicing", **When** the system successfully processes the status update, **Then** the order is invoiced in the OMS and the operator sees the order in "Invoiced" status.
2. **Given** the downstream system accepts the invoice request, **When** the request completes, **Then** the system responds to the caller with success so that the external system can consider the event delivered.

---

### User Story 3 - Visibility and Recovery When Downstream Fails (Priority: P3)

As a DevOps or Support Engineer, I need clear logging and automatic retries when the downstream system is rate-limiting or unavailable, so that no order invoice is dropped without visibility and so recoverable failures are retried without manual intervention.

**Why this priority**: Ensures reliability and operability after the happy path works.

**Independent Test**: Can be tested by simulating downstream 429 or 5xx responses and verifying retry behavior, and by verifying that after max retries the payload is routed to a dead-letter path and that 4xx responses are not retried.

**Acceptance Scenarios**:

1. **Given** the downstream system returns "Too Many Requests" or a server error, **When** the system retries with increasing delays, **Then** it eventually succeeds or, after the maximum number of retries, routes the payload to a dead-letter path for manual intervention.
2. **Given** the downstream system returns a client error (e.g. Bad Request or Not Found), **When** the system receives the response, **Then** it does not retry and logs the event for investigation.
3. **Given** any request (success or failure), **When** processing occurs, **Then** the system logs request identity, order identifier, outcome, and timing; credentials and tokens are never written to logs.

---

### Edge Cases

- **Status does not match**: When `orderStatus` is not one of the configured target statuses (e.g. neither "PREPARING_SHIPPING" nor "DELIVERED"), the system acknowledges receipt with HTTP 200, logs the event, and does not call the downstream invoice API.
- **Invalid or incomplete payload**: When `orderId` is missing or invalid, or `items` is missing or empty, the system rejects the request with a clear client error and does not call downstream.
- **Downstream slow or unavailable**: When the downstream system is consistently slow, the system may respond to the caller with "Accepted" (202) and process the invoice request asynchronously so the caller is not blocked.
- **Description too long**: When an item description exceeds the maximum length allowed by the downstream system, the system truncates it to the allowed length before sending.
- **Price format**: When the incoming payload has prices in decimal form, the system converts them to the integer representation (e.g. cents) required by the downstream API.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose an inbound endpoint that accepts order status update payloads (e.g. POST) and triggers the order invoice flow when the payload is valid and the status is one of the configured target statuses.
- **FR-002**: System MUST validate the incoming payload: require a valid `orderId`, a non-empty `items` array, and only trigger the invoice when `orderStatus` is one of the configured target statuses (e.g. "PREPARING_SHIPPING" or "DELIVERED"); otherwise acknowledge receipt and do not call downstream.
- **FR-003**: System MUST transform the incoming payload into the schema required by the downstream invoice API, including: type (e.g. "Output"), a unique invoice number (generated or from payload), invoice value (sum of items), issuance date (e.g. current UTC), and mapped item fields (id, price in required unit, quantity, description with length limit).
- **FR-004**: System MUST map item fields according to defined rules: pass-through id and quantity; convert price to required unit (e.g. decimal to cents) when needed; truncate description to the maximum allowed length.
- **FR-005**: System MUST secure the inbound endpoint so that only callers presenting valid API key or Bearer token can submit requests.
- **FR-006**: System MUST use credentials for the downstream system (e.g. App Key and App Token) from a secure store (e.g. vault); these MUST NOT be taken from the request or logged.
- **FR-007**: System MUST retry downstream calls on "Too Many Requests" (429) and server errors (5xx) using exponential backoff (e.g. base delay 2s, multiplier 2x, configurable max retries such as 5).
- **FR-008**: System MUST NOT retry on client errors (4xx) from the downstream system; it MUST log these as integration errors.
- **FR-009**: System MUST route payloads to a dead-letter path when the downstream call still fails after the maximum number of retries, for manual intervention.
- **FR-010**: System MUST log request identity, order identifier, status/match result, outgoing payload (without secrets), downstream response status, and response time; all tokens and secrets MUST be masked in logs.

### Non-Functional Requirements (from Constitution)

**Architecture**:
- **NFR-001**: Implementation MUST follow hexagonal architecture (domain, application, infrastructure layers)
- **NFR-002**: Business logic MUST reside in domain layer with ZERO external dependencies
- **NFR-003**: All external dependencies MUST be accessed through ports (interfaces)

**Code Quality**:
- **NFR-004**: All code MUST adhere to SOLID principles
- **NFR-005**: Functions MUST NOT exceed 20 lines (unless justified)
- **NFR-006**: Files MUST NOT exceed 200 lines (unless justified)
- **NFR-007**: Code MUST pass ESLint with security plugins

**Testing**:
- **NFR-008**: Test coverage MUST be ≥ 80%
- **NFR-009**: Tests MUST be written before implementation (TDD)
- **NFR-010**: Tests MUST follow testing pyramid (70% unit, 20% integration, 5% contract, 5% e2e)

**Security**:
- **NFR-011**: All inputs MUST be validated with schemas (joi/zod/ajv)
- **NFR-012**: All endpoints MUST have rate limiting
- **NFR-013**: Passwords MUST be hashed with bcrypt/scrypt
- **NFR-014**: No secrets in code (use environment variables)

**Production Readiness**:
- **NFR-015**: System MUST expose `/health` and `/metrics` endpoints
- **NFR-016**: System MUST log to stdout with structured JSON format
- **NFR-017**: System MUST handle graceful shutdown (SIGTERM, SIGINT)
- **NFR-018**: System MUST distinguish operational vs. programmer errors

### Key Entities

- **Order Status Update (inbound)**: Payload sent by external systems; contains order identifier, order status, and list of line items (id, price, quantity, description). Represents the signal that an order is ready for invoicing.
- **Invoice Request (outbound)**: Transformed payload sent to the order management system; contains type, invoice number, issuance date, total invoice value, and line items in the format required by the downstream API.
- **Line Item**: Single line in an order; has identifier, price (in source or target unit), quantity, and description. Exists in both inbound and outbound representations with possible transformation (e.g. price unit, description length).

## Assumptions

- The target statuses for triggering invoice are configurable; the system MUST support at least "PREPARING_SHIPPING" and "DELIVERED" (orders may be invoiced in either state).
- The downstream invoice API base URL (e.g. account and environment) is configured or derivable; credentials are provided via a secure store.
- Invoice numbers can be generated by the middleware (e.g. from orderId) or taken from the inbound payload if provided by the ERP.
- "Accepted" (202) for asynchronous processing is used when downstream latency would otherwise exceed acceptable response time; exact threshold can be configured.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: External systems can submit order status updates and receive a success or accepted response when the payload is valid and the status is one of the target statuses (e.g. PREPARING_SHIPPING or DELIVERED); no manual step is required to trigger the invoice for those orders.
- **SC-002**: When the downstream system is available, orders in "ready for invoicing" status are invoiced so that operators see the order in "Invoiced" state and financial capture and notifications occur as expected.
- **SC-003**: Payloads whose status is not one of the target statuses (e.g. neither PREPARING_SHIPPING nor DELIVERED) are acknowledged (e.g. HTTP 200) without calling the downstream API, and the event is logged for traceability.
- **SC-004**: Under expected peak load, validation and transformation of each incoming payload complete within 200ms so that callers are not blocked by internal processing delay.
- **SC-005**: When the downstream system returns rate limit or server errors, the system retries with exponential backoff and either succeeds or routes the payload to a dead-letter path after max retries; no invoice event is dropped without visibility.
- **SC-006**: Credentials for the downstream system are never logged or hardcoded; security review confirms credentials are injected at runtime from a secure store.
- **SC-007**: Retry and dead-letter behavior are verified by tests that simulate 429 and 5xx responses from the downstream system.
