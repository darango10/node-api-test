# Research: Stock Trading Backend Service

**Branch**: `001-fuse-stock-trading-api`  
**Phase**: 0 (Outline & Research)

## 1. Database: MongoDB

**Decision**: Use MongoDB as the primary persistence store for portfolios and transaction records.

**Rationale**:
- User requirement: MongoDB as BD.
- Document model fits portfolio (user → list of positions) and transaction log (flexible schema for success/failure metadata).
- No strong relational constraints between users and portfolios (user id is path-supplied; user entity out of scope); aggregates map cleanly to documents.
- Mongoose provides ODM, schema validation, and prevents injection (constitution NFR: ORM/ODM for security).

**Alternatives considered**:
- **PostgreSQL / SQL**: Strong consistency and ACID; would require explicit schema for portfolios/transactions. Rejected per user choice for MongoDB.
- **In-memory / SQLite**: Simpler for eval but not aligned with “MongoDB as BD” and less representative of production.

**Best practices applied**:
- Use Mongoose schemas and avoid raw query concatenation (injection prevention).
- Indexes on `userId` for portfolio and transaction queries; optional TTL or archival for old transaction data (report window only).
- Connection lifecycle: connect at startup, graceful disconnect on SIGTERM/SIGINT.

---

## 2. HTTP Framework: Express

**Decision**: Use Express as the HTTP framework for the REST API.

**Rationale**:
- User requirement: Express as framework.
- Widely used, middleware ecosystem (rate limit, helmet, body-parser, error handler).
- Fits hexagonal layout: Express lives in `infrastructure/http`; routes only delegate to application use cases.

**Alternatives considered**:
- **Fastify**: Higher throughput, schema-based validation; rejected per user choice for Express.
- **Hono / Koa**: Lighter weight; rejected in favor of Express per user preference.

**Best practices applied**:
- Keep routes thin: parse path/query/body, call application service, return status + JSON.
- Centralized error middleware; structured logging with request context.
- Mount OpenAPI/Swagger UI on a dedicated path (e.g. `/api-docs`).

---

## 3. API Documentation: OpenAPI + Swagger

**Decision**: Document all REST endpoints with OpenAPI 3.x and serve interactive docs with Swagger UI.

**Rationale**:
- User requirement: documentación de endpoints con OpenAPI y Swagger.
- OpenAPI is the standard for REST API contracts; supports request/response schemas, status codes, and errors.
- Swagger UI provides human-readable, try-it-out documentation for evaluators (aligns with FR-009 / quickstart).
- Contract tests can validate server behavior against the same OpenAPI spec.

**Alternatives considered**:
- **Postman/Insomnia collections**: Not machine-readable as single source of truth; rejected in favor of OpenAPI.
- **JSDoc only**: No standard machine-readable contract; rejected.

**Best practices applied**:
- Single OpenAPI spec file (e.g. `contracts/openapi.yaml`) as source of truth.
- All endpoints (list stocks, get portfolio, execute purchase, health, metrics) and error responses documented.
- Use `swagger-ui-express` to serve UI; optionally `swagger-jsdoc` if spec is generated from code (this plan prefers spec-first in `contracts/`).

---

## 4. Concurrency and Consistency (Portfolio Updates)

**Decision**: Use atomic updates (e.g. Mongoose `findOneAndUpdate` with conditions or transactions) when updating portfolio on purchase to avoid lost or double-counted shares under concurrent requests (spec edge case).

**Rationale**:
- Spec: “If two requests for the same user and stock are processed concurrently, the system must ensure portfolio quantities are consistent.”

**Alternatives considered**:
- Read-modify-write without atomicity: risk of race conditions; rejected.
- Distributed locks: overkill for single-service; rejected.

**Best practices applied**:
- Prefer MongoDB single-document atomic updates or short transactions for “add position / update quantity” so concurrent purchases for same user+stock are serialized correctly.

---

## 5. Daily Report and Email

**Decision**: Implement a scheduled job (e.g. `node-cron` or similar) that runs once per day; generates report from transactions since last successful report (or process start); sends email to fixed list from config; on missed run (service down), skip until next schedule (no catch-up).

**Rationale**:
- Spec: single fixed list of recipients (config/env); report window = since last successful report; if run is missed, do nothing until next scheduled time.

**Alternatives considered**:
- Catch-up runs: rejected per spec (skip if missed).
- Per-user reports: rejected (single report for all transactions to fixed list).

**Best practices applied**:
- Store “last successful report timestamp” (or last run id) in config/DB to define report window.
- Use env vars for SMTP and recipient list; no secrets in code.
- On email failure: log and surface for retry/fix; do not mark report as successful.

---

## 6. Vendor Integration

**Decision**: Vendor API is the single source of truth for current prices and (if applicable) execution. Implement a port (e.g. `StockVendorPort`) in domain/application and an HTTP client adapter in infrastructure; handle timeouts and 5xx without applying partial updates; include failed attempts in daily report.

**Rationale**:
- Spec: vendor unreliability must not corrupt data; failed purchases must not update portfolio and must appear in report.

**Best practices applied**:
- Timeouts and retries (with clear backoff) so users get clear success or failure.
- No partial writes: only update portfolio and persist “success” transaction when vendor confirms; otherwise persist “failure” and return clear error to client.

---

## Summary Table

| Topic            | Decision                    | Key rationale / constraint      |
|------------------|-----------------------------|---------------------------------|
| Database         | MongoDB (Mongoose)          | User choice; ODM for security   |
| HTTP framework   | Express                     | User choice; middleware ecosystem |
| API docs         | OpenAPI 3.x + Swagger UI    | User choice; contract + eval UX  |
| Concurrency      | Atomic portfolio updates    | Spec: consistent quantities      |
| Daily report     | Cron, fixed list, no catch-up | Spec: skip if missed          |
| Vendor           | Port + adapter, no partial writes | Spec: reliability, report failures |
