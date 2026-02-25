# Research: Order Invoice Endpoint (VTEX Integration)

**Branch**: `005-order-invoice-endpoint` | **Phase**: 0

Decisions and rationale for implementation choices. All Technical Context unknowns are resolved here.

---

## 1. Dead Letter Queue (DLQ) Implementation

**Decision**: Implement a **DLQ port** with an initial **file-based adapter** (append failed payloads to a configured path, e.g. `DLQ_PATH` or under a `./data/dlq` directory). Optionally support a second adapter (e.g. SQS, database table) via the same port for production.

**Rationale**: Spec requires "route payloads to a dead-letter path for manual intervention" without prescribing technology. A file-based adapter keeps the core flow simple, avoids new infrastructure for MVP, and allows operators to inspect/retry by reading files. No new runtime dependencies (e.g. message broker) required for the first release.

**Alternatives considered**:

- **In-memory queue**: Rejected because payloads are lost on restart; violates "no invoice dropped without visibility."
- **External queue (SQS, RabbitMQ)**: Acceptable for production scale; can be added as another adapter implementing the same DLQ port once operations require it.
- **Database table**: Acceptable; provides queryability and audit trail. Can be added as an alternative adapter if ops prefer DB over files.

---

## 2. Async 202 Response Threshold

**Decision**: Make the **async threshold configurable** via environment (e.g. `INVOICE_ASYNC_THRESHOLD_MS`). If the downstream VTEX call would exceed this threshold (e.g. 500ms or 1000ms), the handler returns **202 Accepted** immediately and processes the VTEX invoice request asynchronously (e.g. fire-and-forget with logging and DLQ on failure). If not set, default to **synchronous only** (no 202) for simplicity in MVP.

**Rationale**: PRD states "if VTEX API latency consistently exceeds acceptable thresholds, return 202 and process asynchronously." Configurable threshold allows tuning without code changes. Defaulting to sync keeps initial implementation and tests simpler; async path can be added in a follow-up task.

**Alternatives considered**:

- **Always synchronous**: Simpler but may block callers under VTEX slowness; acceptable for MVP if load is low.
- **Always 202 with async processing**: More resilient but complicates testing and semantics (caller never gets 200 from VTEX); deferred until needed.

---

## 3. Secrets and VTEX Credentials

**Decision**: **SecretsPort** (or equivalent) returns VTEX App Key and App Token. **First implementation**: read from **environment variables** (e.g. `VTEX_APP_KEY`, `VTEX_APP_TOKEN`) validated at startup. No vault integration in initial scope; vault can be introduced as a second adapter implementing the same port.

**Rationale**: Constitution and spec require "credentials from a secure store" and "never in code or logs." Env vars are a valid secure store when provided by the orchestrator (e.g. Kubernetes secrets, CI secrets). Vault/AWS Secrets Manager can be added later without changing domain or use case.

**Alternatives considered**:

- **Vault from day one**: More secure in some environments but adds dependency and setup; not required for spec compliance if env is considered a secure store.
- **Config file**: Rejected; easy to commit by mistake; constitution forbids secrets in code/config in repo.

---

## 4. Ingress Authentication (Webhook)

**Decision**: **API Key or Bearer token** in `Authorization` header. Validate via middleware: accept `Bearer <token>` or `ApiKey <key>` (or a single shared secret in header, e.g. `X-Webhook-Token`). Token/key compared against value from environment (e.g. `WEBHOOK_SECRET` or `ORDER_STATUS_WEBHOOK_TOKEN`). Reject with **401 Unauthorized** if missing or invalid.

**Rationale**: PRD and spec require "only callers presenting valid API key or Bearer token can submit requests." Single shared secret is sufficient for webhook-to-middleware trust; no OAuth or JWT required unless product explicitly requests it.

**Alternatives considered**:

- **HMAC signature (e.g. X-Hub-Signature)**: Better for public webhooks; can be added later if payload signing is required.
- **mTLS**: Strong but heavier; not specified in PRD.

---

## 5. Retry and Backoff

**Decision**: **Exponential backoff** in the VTEX adapter (or a small retry wrapper): base delay **2s**, multiplier **2x**, **max 5 attempts** (delays 2s, 4s, 8s, 16s, 32s). Retry only on **429** and **5xx**; do **not** retry on **4xx**. After 5 failures, call **DLQ port** with the (original or last) payload and stop. Use a small utility or existing library (e.g. `axios-retry` or inline loop with `setTimeout`/promise) to keep adapter testable.

**Rationale**: Matches PRD and spec exactly. Logic lives in infrastructure (adapter or retry decorator) so domain and use case stay free of HTTP semantics.

**Alternatives considered**:

- **Jitter**: Optional; add jitter to delay to avoid thundering herd if multiple workers; can be added later.
- **Circuit breaker**: Not in spec; can be considered if VTEX is frequently down.

---

## 6. VTEX Field Mapping and Validation

**Decision**: Implement transformation in **domain** (or application) as pure functions: (1) **Price**: if input is decimal (e.g. 150.00), multiply by 100 to get cents (15000); if already integer, pass through. (2) **Description**: truncate to **255 characters** (VTEX limit). (3) **Invoice number**: generate as `INV-{orderId}` if not provided in payload. (4) **Issuance date**: current UTC in ISO 8601 (e.g. `new Date().toISOString()`). (5) **Invoice value**: sum of `item.price * item.quantity` (in cents) over all items.

**Rationale**: PRD table and spec define these rules. Keeping them in domain (or a dedicated transformation service in domain) ensures they are testable without HTTP and reusable.

**Alternatives considered**:

- **Transformation in adapter**: Rejected; transformation is business logic and should not live in infrastructure.
- **Configurable field map**: Overkill for current single downstream (VTEX); can be introduced if multiple OMS targets appear.

---

## 7. Target Status Configuration

**Decision**: **Configurable list of target statuses** via environment (e.g. `INVOICE_TARGET_ORDER_STATUS`, comma-separated: `PREPARING_SHIPPING,DELIVERED`). The order can be invoiced in **either** state. Only when `orderStatus` is in this set (after trimming/case normalization if needed) trigger the invoice flow; otherwise return **200** and log.

**Rationale**: Business rule: orders may be invoiced when status is PREPARING_SHIPPING or DELIVERED. A list (e.g. comma-separated) keeps configuration flexible without code changes.

---

## Summary Table


| Topic         | Decision                               | Rationale / Note                   |
| ------------- | -------------------------------------- | ---------------------------------- |
| DLQ           | Port + file-based adapter first        | No broker dependency; manual retry |
| Async 202     | Configurable threshold; default sync   | Optional async in follow-up        |
| Secrets       | Env vars (VTEX_APP_KEY, etc.)          | Vault as second adapter later      |
| Ingress auth  | Bearer/API key from env                | Single shared secret               |
| Retry         | 2s base, 2x, 5 max; 429/5xx only       | As per PRD                         |
| VTEX mapping  | Domain transform; 255 char desc; cents | Pure, testable                     |
| Target status | Env INVOICE_TARGET_ORDER_STATUS (list) | Default PREPARING_SHIPPING,DELIVERED |


