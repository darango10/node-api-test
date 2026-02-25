# Quickstart: Order Invoice Endpoint

**Branch**: `005-order-invoice-endpoint`

Short guide for developers implementing this feature. See [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), and [data-model.md](./data-model.md) for full detail.

---

## 1. What You're Building

- **Inbound**: `POST /api/v1/webhooks/orders/status` — receives order status JSON; secured with Bearer or API key.
- **Behavior**: If `orderStatus` is one of the configured target statuses (e.g. `PREPARING_SHIPPING` or `DELIVERED`), validate → transform → call VTEX invoice API. Otherwise return 200 and log.
- **Resilience**: Retry 429/5xx with exponential backoff; after max retries, send payload to DLQ. No retry on 4xx.
- **Secrets**: VTEX App Key/Token from env (or vault adapter later). Never log secrets.

---

## 2. Where Code Lives (Vertical Slice)

- **Feature slice**: `src/features/invoicing/`
  - `domain/` — entities (value objects), validation rules, transform (payload → VTEX schema).
  - `application/use-cases/` — e.g. `ProcessOrderStatusUpdate` (orchestrate validate → transform → call port).
  - `ports/` — `VtexInvoicePort`, `SecretsPort` (VTEX creds), `DLQPort` (failed payloads).
  - `infrastructure/` — webhook controller, routes, VTEX HTTP adapter (with retry), optional file-based DLQ adapter.

- **Wiring**: Register invoicing routes and use case in shared `app.ts` and container (or equivalent). Add env vars for webhook secret, VTEX URL, VTEX credentials, target status, DLQ path.

---

## 3. Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ORDER_STATUS_WEBHOOK_TOKEN` or `WEBHOOK_SECRET` | Ingress auth (Bearer or API key value). |
| `VTEX_APP_KEY` | VTEX API App Key (outbound). |
| `VTEX_APP_TOKEN` | VTEX API App Token (outbound). |
| `VTEX_ACCOUNT_NAME`, `VTEX_ENVIRONMENT` | Build base URL for VTEX OMS (e.g. `https://{account}.{env}.com.br`). |
| `INVOICE_TARGET_ORDER_STATUS` | Comma-separated list of statuses that trigger invoice (e.g. `PREPARING_SHIPPING,DELIVERED`). Default `PREPARING_SHIPPING,DELIVERED`. |
| `DLQ_PATH` or `INVOICE_DLQ_PATH` | Optional; path for file-based DLQ (e.g. `./data/dlq`). |
| `INVOICE_ASYNC_THRESHOLD_MS` | Optional; if set, return 202 when downstream would exceed this ms. |

---

## 4. Contracts

- **Inbound**: [contracts/webhook-order-status.yaml](./contracts/webhook-order-status.yaml) — OpenAPI for `POST /api/v1/webhooks/orders/status`.
- **Outbound**: [contracts/vtex-invoice-outbound.md](./contracts/vtex-invoice-outbound.md) — VTEX invoice URL, headers, body shape, retry rules.

---

## 5. Testing

- **Unit**: Domain validation and transformation (input payload → Invoice Request); use case with mocked ports.
- **Integration**: VTEX adapter with **nock** (mock HTTP 200, 429, 5xx, 4xx); verify retry and DLQ behavior.
- **Contract**: Supertest against `POST /api/v1/webhooks/orders/status` — 200/202/400/401 and body schema.

---

## 6. Order of Implementation (Suggested)

1. **Domain**: Value objects and validation (orderId, items, orderStatus); transform to VTEX payload (price to cents, description truncation, invoice number, issuance date, invoiceValue).
2. **Ports**: Interfaces for VtexInvoicePort, SecretsPort, DLQPort.
3. **Use case**: ProcessOrderStatusUpdate — validate → transform → get creds → call VtexInvoicePort (or DLQ on failure after retries).
4. **Infrastructure**: Secrets adapter (env), VTEX HTTP adapter (Axios + retry logic), optional file DLQ adapter; webhook controller and route; wire route and use case in app and container.
5. **Tests**: TDD; unit first, then integration and contract.

After implementation, run lint, tests, and coverage (≥80%); ensure no secrets in logs and rate limiting applied to the webhook route.
