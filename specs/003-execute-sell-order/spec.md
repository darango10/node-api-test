# Feature Specification: Execute Sell Order

**Feature Branch**: `003-execute-sell-order`  
**Created**: 2025-02-18  
**Status**: Draft  
**Input**: User description: "Execute Sell Order in Stock Trading API. Objective: A user wants to sell a specific amount of shares of a stock they currently own at the current market price."

## Clarifications

### Session 2025-02-18

- Q: Does the system call an external vendor to execute the sell, or only update our portfolio using the current price? → A: We only update: validate position, get current price from vendor, update our portfolio and record the transaction; no vendor "sell" API. Vendor provides price (and market availability) only.
- Q: Are fractional shares supported for sell (quantity can be decimal) or only whole shares? → A: Whole shares only; quantity must be a positive integer; fractional quantities rejected at validation.
- Q: Should the insufficient-shares error response always include the current held quantity for that symbol? → A: Must include; error response for insufficient shares MUST include the current held quantity for that symbol.
- Q: Should the API support an optional idempotency key to prevent duplicate execution on retries? → A: Not in scope; no idempotency key for this feature; clients retry at their own risk; can be added later if needed.
- Q: Should we make "a few seconds" response time explicit (e.g. numeric bound) for testability? → A: Keep as-is; leave "within a few seconds" in success criteria; planning can define a numeric target if needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute Market Sell Order (Priority: P1)

**As a** user who holds shares of a stock,  
**I want to** sell a specific quantity of those shares at the current market price,  
**So that** I can realize gains, reduce exposure, or rebalance my portfolio.

A trader or client application submits a sell order specifying the user, the stock symbol, and the quantity to sell. The system validates that the user owns at least that quantity, that the market is available for trading, and that the execution price is still within an acceptable range of the current market price. If all conditions are met, the sell is executed, the user’s portfolio is updated (quantity reduced or position removed), and a clear success response is returned. Otherwise, the order is rejected with a specific, actionable reason.

**Why this priority**: Selling is a core trading action alongside buying; users must be able to close or reduce positions reliably.

**Independent Test**: Submit a sell order for a symbol and quantity the user holds, with market available and price within tolerance; verify success and that portfolio quantity decreases (or position is removed if selling all). Delivers value by enabling users to exit or reduce positions at market.

**Acceptance Scenarios**:

1. **Given** the user holds at least the requested quantity of the stock, the market is open, and the execution price is within the allowed tolerance of the current market price, **When** the user submits a sell order (symbol, quantity), **Then** the system executes the sell, updates the portfolio (reduces or removes the position), and returns a success response with relevant execution details.
2. **Given** the user holds more than the requested quantity (partial sale), **When** the user submits a sell order for that quantity, **Then** the system executes the sell and reduces the position by the sold quantity; the user retains the remaining shares.
3. **Given** the user holds exactly the requested quantity (full sale), **When** the user submits a sell order for that quantity, **Then** the system executes the sell and removes the position for that stock from the portfolio.
4. **Given** the user does not hold the stock (zero position), **When** the user submits a sell order for that symbol, **Then** the system rejects the order and returns a clear error indicating the user does not own the stock (e.g. insufficient shares or position not found).
5. **Given** the user holds fewer shares than the requested quantity, **When** the user submits a sell order, **Then** the system rejects the order and returns a clear error indicating insufficient shares, and the response MUST include the current held quantity for that symbol.
6. **Given** the market is closed or unavailable for trading, **When** the user submits a sell order, **Then** the system rejects the order and returns a clear error indicating the market is not available for selling.
7. **Given** the current market price has moved beyond the allowed tolerance since the order was submitted (e.g. due to latency or volatility), **When** the system validates the execution price, **Then** the order is rejected with a clear message that the price is no longer within the acceptable range (e.g. price moved or stale quote).

---

### Use Case Scenarios (Gherkin Style)

**Scenario 1: Successful Market Sell Order**

- **Given** the user has a portfolio position of 100 shares of stock "SYMBOL"
- **And** the market is open and the current market price for "SYMBOL" is 50.00
- **When** the user submits a sell order with symbol "SYMBOL", quantity 50, and the execution is at the current market price within the allowed tolerance
- **Then** the system executes the sell successfully
- **And** the user's portfolio shows 50 shares of "SYMBOL" remaining
- **And** the response indicates success and includes relevant execution information (e.g. symbol, quantity, price or execution identifier)

**Scenario 2: Failure — Insufficient Shares**

- **Given** the user has a portfolio position of 30 shares of stock "SYMBOL"
- **When** the user submits a sell order with symbol "SYMBOL", quantity 50
- **Then** the system rejects the order
- **And** the response indicates insufficient shares and includes the current held quantity (e.g. 30)
- **And** the user's portfolio remains unchanged (still 30 shares of "SYMBOL")

**Scenario 3: Failure — System Latency / Price Change**

- **Given** the user has a portfolio position of 100 shares of stock "SYMBOL"
- **And** the market is open
- **When** the user submits a sell order at a price that was valid at request time, but by execution time the market price has moved beyond the allowed tolerance (e.g. more than 2% away)
- **Then** the system rejects the order
- **And** the response indicates that the price is no longer within the acceptable range (e.g. price moved or quote stale)
- **And** the user's portfolio remains unchanged

---

### Edge Cases

- **User does not own the stock**: Request to sell a symbol with zero position must be rejected with a clear “insufficient shares” or “position not found” type error; no partial execution.
- **Sell zero, negative, or fractional quantity**: Invalid quantity (zero, negative, or non-integer) must be rejected with validation errors before any business logic runs; whole shares only.
- **Missing or invalid symbol/user**: Request with missing or invalid mandatory fields (e.g. symbol, quantity, user identifier) must be rejected with validation errors.
- **Market closed or unavailable**: If the system cannot obtain a current price or the market is closed, the sell must be rejected with a clear “market unavailable” or “market closed” type message.
- **Concurrent sell orders**: If two sell requests for the same user and symbol are processed concurrently, the system must ensure portfolio quantities remain consistent (no overselling, no double deduction).
- **Price tolerance**: The same conceptual tolerance used for buys (e.g. execution price within X% of current market price) applies to sells; exact threshold is configuration or business rule. Orders outside the threshold must fail with a clear reason.

## Business Rules

### Asset ownership

- The user MUST hold a position in the requested stock (symbol) to submit a valid sell order.
- If the user has **no position** in the symbol, the system MUST reject the order with a clear error (e.g. insufficient shares or position not found). No partial execution is allowed.
- If the user holds **fewer shares** than the requested sell quantity, the system MUST reject the order with a clear “insufficient shares” error. The response MUST include the current held quantity for that symbol so the client can display it (e.g. "You have X shares; you requested Y").

### Sufficient balance (shares) — partial vs full sales

- **Partial sale**: The user may sell any quantity **less than or equal to** the quantity held. After a successful partial sale, the portfolio MUST show the reduced quantity (held − sold). The position remains for that symbol as long as quantity &gt; 0.
- **Full sale**: The user may sell a quantity **equal to** the quantity held. After a successful full sale, the position for that symbol MUST be removed from the portfolio (quantity becomes zero or position is deleted, per data model).
- The system MUST NOT allow selling more shares than the user holds; overselling is forbidden.

### Market availability

- Sell orders MUST only be executed when the market (or price source) is **available** and a current market price can be obtained.
- If the **market is closed** or the system cannot obtain a valid current price, the system MUST reject the sell order with a clear error (e.g. market closed or market unavailable). No execution may occur.
- If the **execution price** (e.g. current market price at execution time) falls **outside the allowed tolerance** (e.g. moved due to latency or volatility), the system MUST reject the order with a clear message (e.g. price no longer within range or quote stale).

## Data Requirements

The following fields are **mandatory** for a sell order request:

| Field       | Description                                                                 | Mandatory |
|------------|-----------------------------------------------------------------------------|-----------|
| **User identifier** | Identifies the user on whose behalf the sell is executed (e.g. path parameter). | Yes       |
| **Symbol** | The stock symbol (ticker) to sell.                                          | Yes       |
| **Quantity** | The number of shares to sell. Must be a positive integer (whole shares only; fractional quantities are not supported). | Yes       |

Optional or derived:

- **Execution price / order type**: For a “market” sell, the system typically uses the current market price at execution time; no user-supplied price may be required. If the system supports “limit” or other order types, those would have additional fields (out of scope unless specified).
- **Idempotency key**: Out of scope for this feature. The API does not accept an idempotency key; clients retry at their own risk. This may be added in a later feature if needed.

Validation rules:

- Quantity MUST be a positive integer (whole shares only); fractional or non-integer quantities MUST be rejected at validation.
- Quantity MUST be greater than zero.
- Symbol MUST be non-empty and refer to a known tradable stock.
- User identifier MUST be present and valid (as defined by the existing API).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a capability to execute a sell order for a given user, stock symbol, and quantity at the current market price (market sell). User identity MUST be supplied in the same way as for portfolio and purchase (e.g. path parameter).
- **FR-002**: System MUST validate that the user holds a position in the requested symbol and that the held quantity is greater than or equal to the requested sell quantity. If not, the system MUST reject the order with a clear “insufficient shares” (or equivalent) error, MUST include the current held quantity for that symbol in the response, and MUST NOT update the portfolio.
- **FR-003**: System MUST validate that the market is available and that a current market price can be obtained. If the market is closed or unavailable, the system MUST reject the order with a clear error and MUST NOT execute the sell.
- **FR-004**: System MUST validate that the execution price (e.g. current market price at execution time) is within the allowed tolerance of the price used for execution. If the price has moved beyond the tolerance (e.g. due to latency or volatility), the system MUST reject the order with a clear message and MUST NOT update the portfolio.
- **FR-005**: System MUST update the user’s portfolio on successful sell: reduce the position quantity by the sold amount, or remove the position if the full holding is sold. Updates MUST be consistent (no overselling; concurrent requests must leave portfolio in a valid state).
- **FR-006**: System MUST record the outcome of each sell attempt (success or failure) so it can be included in reporting (e.g. daily report), consistent with existing purchase transaction recording.
- **FR-007**: System MUST validate request input: symbol and quantity (and user identifier) are mandatory; quantity must be a positive integer (whole shares only; fractional or non-integer rejected). Invalid or missing mandatory fields MUST result in validation errors and no execution.
- **FR-008**: System MUST return clear, actionable error responses for insufficient shares (including current held quantity in the response), market unavailable, and price-out-of-tolerance; errors MUST NOT expose internal implementation details.

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

- **Portfolio / Position**: The user’s holding in a stock; includes symbol and quantity. Reduced or removed when a sell order succeeds. Source of truth for “sufficient shares” validation.
- **Sell order (request)**: User identifier, symbol, quantity. Represents the intent to sell at market price.
- **Sell transaction / execution**: Record of a sell attempt (success or failure), used for reporting and audit; aligned with existing transaction recording for purchases.
- **User**: Identified party who holds a portfolio and can place sell orders. Same identification mechanism as portfolio and purchase (e.g. path parameter).
- **Market / price source**: External source of current market price and market availability; used to validate “market open” and “price within tolerance” before executing a sell.

## Assumptions

- User identification matches the existing API (e.g. path parameter such as `userId`); no new auth model is introduced for this feature.
- “Current market price” is obtained from the same vendor or price source used for purchases; the allowed price tolerance for sells is defined by business configuration (e.g. same as or similar to the 2% buy tolerance).
- Market availability is determined by the same mechanism as for purchases (e.g. vendor availability or explicit market-hours check). “Market closed” means no execution is allowed; the exact definition of open/closed is an implementation or configuration choice.
- **Sell execution is local only**: The system does not call the vendor to execute the sell. The vendor is used only for current market price and market availability. On success, the system validates position, obtains current price from the vendor, updates the user's portfolio (reduces or removes the position), and records the transaction locally. No vendor sell API is invoked.
- Sell orders are **market** orders only (sell at current market price). Limit sells or other order types are out of scope unless specified later.
- Portfolio and transaction persistence align with the existing design (e.g. same persistence and reporting window as purchase transactions). Sell outcomes are included in the same daily report as purchase outcomes.
- Concurrent sell (and buy/sell) requests for the same user/symbol are serialized or coordinated so that portfolio quantities remain correct and overselling cannot occur.
- Idempotency keys are out of scope for this feature; the API does not accept an idempotency key. Clients that retry may cause duplicate executions; this can be addressed in a later feature if needed.
- Response time is expressed as "within a few seconds" in success criteria; a numeric target (e.g. p95 latency) may be defined in the technical plan if needed for testing or SLAs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who holds sufficient shares can complete a market sell order and see their portfolio updated (reduced or removed position) within a few seconds, with a clear success response.
- **SC-002**: Sell requests with insufficient shares, no position, or invalid input are rejected with clear, actionable error messages; no portfolio update occurs.
- **SC-003**: Sell requests when the market is closed or unavailable are rejected with a clear “market unavailable” type message; no execution occurs.
- **SC-004**: Sell requests that would execute at a price outside the allowed tolerance are rejected with a clear “price out of range” type message; portfolio remains unchanged.
- **SC-005**: Under normal load, sell order responses (success or failure) are returned within a few seconds so users get immediate feedback.
- **SC-006**: Sell outcomes (success and failure) are recorded and included in the same reporting mechanism (e.g. daily report) as purchase outcomes, so operations have a complete view of trading activity.

## Acceptance Criteria (for developers)

1. **Ownership validation**: The system rejects any sell order when the user has no position in the symbol or holds fewer shares than the requested quantity, with an explicit “insufficient shares” (or equivalent) error that includes the current held quantity for that symbol, and no portfolio change.
2. **Market availability**: The system rejects sell orders when the market is closed or the current price cannot be obtained, with a clear “market closed” or “market unavailable” error.
3. **Price tolerance**: The system rejects sell orders when the execution price has moved beyond the configured tolerance (e.g. 2%) from the current market price, with a clear “price out of range” or “quote stale” type message.
4. **Portfolio update**: On successful sell, the user’s portfolio is updated exactly once: position quantity is reduced by the sold amount, or the position is removed if the full holding is sold; concurrent requests do not lead to overselling or inconsistent quantities.
5. **Request validation**: Requests missing or invalid user identifier, symbol, or quantity (e.g. zero, negative, or non-integer; whole shares only) are rejected with validation errors before any business logic runs.
6. **Recording and reporting**: Each sell attempt (success or failure) is recorded and included in the same reporting flow (e.g. daily report) as purchase transactions.
7. **Clear errors**: All rejection reasons (insufficient shares, market unavailable, price out of range, validation errors) are returned as clear, non-technical messages suitable for the client to display or retry appropriately.
