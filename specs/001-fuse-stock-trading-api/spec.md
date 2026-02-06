# Feature Specification: Stock Trading Backend Service

**Feature Branch**: `001-fuse-stock-trading-api`  
**Created**: 2025-02-06  
**Status**: Draft  
**Input**: User description: "Necesito crear una api rest, usando express, mongodb, ## Fuse take home — backend service for stock trading operations: list stocks, get user portfolios, execute purchases, daily email reports."

## Clarifications

### Session 2025-02-06

- Q: How should the API identify the user for get-portfolio and execute-purchase (path, body, header, or token)? → A: Path parameter only (e.g. `/users/:userId/portfolio`); client sends user id in the URL.
- Q: When the service is down at report time, should the system catch up, report current only, or skip? → A: Skip: if the scheduled time is missed, do nothing until the next scheduled time.
- Q: Who receives the daily report — fixed list or per-user? → A: Single fixed list: one or more recipient addresses from config/env (e.g. ops team); one report for all transactions.
- Q: How long to keep transaction records for reporting? → A: Report window only: include transactions since last successful report (or since process start); older records may be discarded or archived.
- Q: Is any authentication required for the API (list stocks, portfolio, purchase)? → A: No authentication: any client that can reach the service may call the endpoints (auth out of scope for this feature).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List Available Stocks (Priority: P1)

A trader or client application needs to see which stocks are available from the vendor so they can decide what to buy. The system exposes a capability to list all available stocks, supporting pagination so large catalogs can be browsed in pages.

**Why this priority**: Listing stocks is the first step in any trading flow; without it, users cannot discover what they can trade.

**Independent Test**: Call the list-stocks capability with optional pagination token; verify a list of stocks and an optional next-page token are returned. Delivers value by enabling discovery of tradable instruments.

**Acceptance Scenarios**:

1. **Given** the service is running and the vendor is reachable, **When** a client requests the list of stocks (no token), **Then** the system returns a page of stock items and may include a nextToken for the next page.
2. **Given** a previous response included a nextToken, **When** a client requests the list of stocks with that nextToken, **Then** the system returns the next page of stock items and may include a new nextToken.
3. **Given** the vendor is temporarily unavailable, **When** a client requests the list of stocks, **Then** the system responds with an error indicating the catalog could not be loaded (no silent failure).

---

### User Story 2 - Get User Portfolio (Priority: P2)

A user (or client acting on their behalf) needs to see their current portfolio: which stocks they hold and in what quantities. The system exposes a capability to return the portfolio for a given user.

**Why this priority**: Portfolio view is essential for the user to know their positions before placing new orders.

**Independent Test**: Request portfolio for an identified user; verify the response contains the user’s holdings (stock identifiers and quantities). Delivers value by showing current positions.

**Acceptance Scenarios**:

1. **Given** a user exists and has at least one holding, **When** a client requests that user’s portfolio, **Then** the system returns a list of positions (stock and quantity) for that user.
2. **Given** a user exists and has no holdings, **When** a client requests that user’s portfolio, **Then** the system returns an empty list of positions.
3. **Given** the user identifier is unknown or invalid, **When** a client requests that user’s portfolio, **Then** the system responds with an appropriate error (e.g. not found or invalid request).

---

### User Story 3 - Execute Stock Purchase (Priority: P3)

A user wants to buy a quantity of a stock at a given price. The system executes the purchase against the vendor: it validates that the requested price is within an allowed tolerance of the current vendor price (e.g. within 2%). If valid, the transaction is recorded and the user’s portfolio is updated; otherwise the transaction fails and the user receives a clear reason.

**Why this priority**: Executing purchases is the core trading action; it must be correct and predictable.

**Independent Test**: Submit a purchase (stock, price, quantity) with a price within tolerance and verify success and portfolio update; submit with price outside tolerance and verify failure with clear reason. Delivers value by enabling real trades with clear pass/fail rules.

**Acceptance Scenarios**:

1. **Given** the current vendor price for a stock is P and the user submits a purchase at a price within the allowed tolerance of P, **When** the system processes the purchase, **Then** the transaction is recorded as successful and the user’s portfolio reflects the new holding (or increased quantity).
2. **Given** the user submits a purchase at a price more than the allowed tolerance (e.g. &gt;2%) away from the current vendor price, **When** the system validates the request, **Then** the transaction is rejected and the user receives a clear message that the price is outside the allowed range.
3. **Given** the vendor is unavailable or returns an error, **When** the system attempts to execute the purchase, **Then** the transaction is not completed and the user receives an error indicating the operation could not be performed.
4. **Given** the user submits invalid input (e.g. negative quantity, missing symbol), **When** the system validates the request, **Then** the request is rejected with validation errors and no transaction is created.

---

### User Story 4 - Daily Email Report of Transactions (Priority: P4)

Stakeholders (e.g. operations or support) need a daily summary of trading activity: which transactions succeeded and which failed. The system generates a report once per day and sends it by email to configured recipients so they can monitor health and follow up on failures.

**Why this priority**: Reporting supports operations and compliance; it does not block core trading.

**Independent Test**: Trigger or wait for the daily report job; verify an email is sent containing successful and failed transactions for the reporting period. Delivers value by providing an auditable, human-readable summary.

**Acceptance Scenarios**:

1. **Given** the report is scheduled to run (e.g. once per day), **When** the report runs, **Then** the system generates a summary that includes successful and failed transactions for the reporting period and sends it by email to configured recipients.
2. **Given** there were no transactions in the reporting period, **When** the report runs, **Then** the system still sends an email indicating no transactions (or equivalent) so recipients know the job ran.
3. **Given** email delivery fails (e.g. invalid address or provider error), **When** the report runs, **Then** the failure is logged and, where possible, surfaced so it can be retried or fixed.

---

### Edge Cases

- **Vendor price changes**: Stock prices change periodically (e.g. every 5 minutes). The system must use the current price at validation time; if the vendor is slow or inconsistent, timeouts and retries should be handled so users get a clear success or failure.
- **Vendor unreliability**: The vendor is not 100% reliable. The system must handle vendor errors (timeouts, 5xx, empty responses) without corrupting data; failed purchases must not update the portfolio and should be included in the daily report as failures.
- **Pagination**: When listing stocks, a large catalog may require multiple pages. Clients must be able to follow nextToken until no more pages; missing or invalid tokens should result in a clear error, not a generic failure.
- **Concurrent purchases**: If two requests for the same user and stock are processed concurrently, the system must ensure portfolio quantities are consistent (no lost or double-counted shares).
- **Report timing**: If the service is down when the report is due, the system does nothing until the next scheduled time; missed periods are not reported (no catch-up).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a capability to list available stocks from the vendor, supporting pagination via a token so clients can retrieve all pages.
- **FR-002**: System MUST expose a capability to return a user’s portfolio (list of stocks and quantities held) for an identified user. User identity MUST be supplied by the client as a path parameter (e.g. `userId` in the URL).
- **FR-003**: System MUST expose a capability to execute a stock purchase for a given user, stock symbol, price, and quantity. User identity MUST be supplied by the client as a path parameter (e.g. `userId` in the URL).
- **FR-004**: System MUST validate purchase price against the current vendor price; if the requested price deviates more than the allowed tolerance (e.g. 2%) from the current price, the transaction MUST fail with a clear reason.
- **FR-005**: System MUST record the outcome of each purchase attempt (success or failure) so it can be included in the daily report. Records are needed only for the current report window (since last successful report or since process start); older records may be discarded or archived.
- **FR-006**: System MUST generate a daily report that includes successful and failed transactions for the reporting period (transactions since the last successful report, or since process start if none yet).
- **FR-007**: System MUST send the daily report by email to a single fixed list of recipients (one or more addresses supplied via configuration or environment); the report contains all transactions (all users) for the period.
- **FR-008**: System MUST handle vendor unavailability or errors without applying partial updates; failed purchases MUST NOT update the user’s portfolio.
- **FR-009**: System MUST be runnable locally and startable via simple, documented steps so evaluators can run it without prior setup beyond those steps.

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

- **Stock**: A tradable instrument provided by the vendor; has at least a symbol and a current price. Prices change periodically (e.g. every 5 minutes).
- **Portfolio**: The set of positions held by a user; each position refers to a stock and a quantity. Updated only when a purchase succeeds.
- **Transaction (purchase attempt)**: A single attempt to buy a quantity of a stock at a given price; has an outcome (success or failure) and is recorded for the daily report. Retention is for the current report window only; data since last successful report (or since process start) is included in the next report, and older records may be discarded or archived.
- **User**: An identified party who has a portfolio and can perform purchases. The client supplies the user identifier as a path parameter on portfolio and purchase requests. User lifecycle (create/update/delete) is out of scope.
- **Daily report**: A summary of successful and failed transactions (all users) for a reporting period, sent by email to a fixed list of recipients defined in configuration or environment.

## Assumptions

- Users are identified by a stable identifier (e.g. ID or email); the service does not define user management (create/update/delete users).
- The allowed price tolerance for purchases is 2% from the current vendor price (aligned with challenge description).
- The vendor API is the single source of truth for current stock prices and for executing buy operations; the service orchestrates and persists outcomes locally (e.g. portfolio, transaction log for reporting).
- Email recipients are a single fixed list (one or more addresses) set via configuration or environment; delivery (e.g. SMTP) is also configured externally; no in-app UI for managing recipients is required.
- “Daily” report means once per calendar day (or once per configured period); exact schedule (e.g. time of day) is an implementation choice. If a run is missed (e.g. service down), the system skips that run and does not catch up on next startup. The reporting period is “since last successful report” (or since process start); transaction records outside that window may be discarded or archived.
- Listing transactions as a standalone endpoint is out of scope; transaction data is used for the daily report only.
- API authentication and authorization are out of scope for this feature: any client that can reach the service may call the list-stocks, portfolio, and purchase endpoints. Rate limiting and input validation still apply per constitution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can list all available stocks by following pagination until no nextToken is returned, without errors under normal vendor availability.
- **SC-002**: A client can request a user’s portfolio and receive the correct list of positions (stocks and quantities) for that user.
- **SC-003**: A purchase at a price within the allowed tolerance completes successfully and the user’s portfolio is updated within a few seconds; a purchase outside the tolerance fails with a clear, non-technical message.
- **SC-004**: When the vendor is unavailable or returns an error, no purchase is applied and the user receives a clear error; failed attempts are included in the daily report.
- **SC-005**: The daily report is sent by email at least once per day and includes both successful and failed transactions for the reporting period.
- **SC-006**: A new evaluator can start the service using only the documented steps and run the main flows (list stocks, get portfolio, execute purchase, and understand daily report) without prior knowledge of the codebase.
