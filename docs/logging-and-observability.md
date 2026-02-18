# Logging and Observability

This document describes the **logging strategy**, **production log pipeline**, and **observability** approach for the Stock Trading API. It combines an **architecture** view (what we log, where it lives, data flow) with a **DevOps** view (platforms, collection, retention, and how to achieve excellent observability in production).

---

## 1. Objectives

- **Traceability**: Follow a single request across services and log lines (correlation ID).
- **Debuggability**: Enough context (level, message, structured fields) to diagnose errors and behavior.
- **Production readiness**: Logs in JSON to stdout; no file I/O in the app; platform collects and stores.
- **Security**: No secrets or unnecessary PII in logs; redaction where needed.
- **Observability**: Logs as one pillar of the triad: **Logs + Metrics + Traces**.

---

## 2. Architecture: Where Logging Lives

Logging is an **infrastructure concern**. The app does not decide where logs are stored or how they are shipped; it only writes to **stdout** in a well-defined format.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Stock Trading API (Node.js)                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────┐   │
│  │ Controllers │   │ Use Cases   │   │ Adapters (Vendor, DB, etc.)  │   │
│  └──────┬──────┘   └──────┬──────┘   └──────────────┬───────────────┘   │
│         │                 │                         │                    │
│         └─────────────────┼─────────────────────────┘                    │
│                           ▼                                                │
│                  ┌─────────────────┐                                       │
│                  │ logger (Pino)   │  ← single entry point                 │
│                  │ infra/config   │                                       │
│                  └────────┬────────┘                                       │
│                           │                                                │
└───────────────────────────┼────────────────────────────────────────────────┘
                            │ stdout (JSON in prod, pretty in dev)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Runtime (Docker / K8s / ECS / VM)                                       │
│  - stdout/stderr captured by runtime or log driver                       │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Log pipeline (platform-dependent)                                      │
│  - Agent / sidecar / CloudWatch / Fluent Bit / Datadog Agent / etc.     │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Log platform (storage, search, alerts)                                  │
│  - CloudWatch Logs / Datadog / Grafana Loki / Elasticsearch / Splunk     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Design decisions:**

| Decision | Rationale |
|----------|-----------|
| Logs to **stdout** only | Containers and orchestrators expect stdout; no log files to rotate or mount. |
| **Structured JSON** in production | Easy to parse, index, and query; works with any log platform. |
| **Pino** as logger | Fast, async, low overhead; first-class JSON and child loggers. |
| **Single logger instance** in infrastructure | Consistent format and level; no scattered `console.log`. |

---

## 3. Current Application State

### 3.1 Logger configuration

- **Library**: [Pino](https://getpino.io/) (see `src/infrastructure/config/logger.ts`).
- **Level**: From `LOG_LEVEL` env (`fatal` | `error` | `warn` | `info` | `debug` | `trace`); default `info`.
- **Development**: `pino-pretty` transport for colorized, human-readable output.
- **Production**: No transport → JSON lines to stdout; `base.env` and custom ISO timestamp.

### 3.2 Request context

- **Middleware**: `requestContextMiddleware` (AsyncLocalStorage) sets:
  - `correlationId`: from `x-correlation-id` header or new UUID.
  - `userId`: from route params when present.
  - `startTime`: for duration if needed later.
- **Response**: `x-correlation-id` echoed in response for client-side tracing.
- **Gap**: `correlationId` is not automatically attached to every log line; it should be added via a request-scoped child logger (see section 9).

### 3.3 What is logged today

- **Startup/shutdown**: Server listen, MongoDB connect/disconnect, graceful shutdown.
- **HTTP**: Sell/purchase requests (userId, symbol, quantity); errors with status and context.
- **Vendor API**: List stocks, get price, execute buy; success and errors (see `docs/vendor-api-logging.md`).
- **Persistence**: Transaction save, portfolio updates; errors with context.
- **Global**: Unhandled rejection and uncaught exception (then exit).

All of the above use the shared `logger` from `infrastructure/config/logger`.

---

## 4. Logging Strategy

### 4.1 What to log

| Category | Examples | Level |
|----------|----------|--------|
| Request start/end | Method, path, userId (from route), correlationId, duration, statusCode | info |
| Business events | Purchase/sell success, quantity, symbol, price | info |
| External calls | Vendor request/response summary (no full bodies), DB operations | info / debug |
| Warnings | Price out of tolerance, rate limit near, fallback used | warn |
| Errors | Caught exceptions, vendor/DB failures, validation failures | error |
| Debug/trace | Pagination tokens, internal state (dev only) | debug / trace |

### 4.2 What NOT to log

- **Secrets**: API keys, passwords, tokens, connection strings.
- **Full request/response bodies** (unless sanitized and necessary).
- **PII beyond what’s needed**: e.g. avoid email/name in logs unless required for support; prefer userId.
- **Stack traces** only when level is error and needed for debugging (avoid in every info line).

### 4.3 Log levels by environment

| Environment | Recommended level | Reason |
|-------------|-------------------|--------|
| Local dev | `debug` or `info` | Easier troubleshooting. |
| Test | `warn` or `error` | Keep test output minimal; increase if debugging. |
| Staging | `info` | Balance between volume and debuggability. |
| Production | `info` | Default; switch to `warn` only if volume/cost is an issue. |

Override via **LOG_LEVEL** (e.g. in Docker env or K8s ConfigMap).

### 4.4 Structured format (production)

Every line is one JSON object. Example:

```json
{
  "level": 30,
  "time": "2026-02-18T12:00:00.000Z",
  "env": "production",
  "msg": "Sell request received",
  "userId": "user-123",
  "symbol": "AAPL",
  "quantity": 10
}
```

Platforms can index `level`, `time`, `userId`, `symbol`, `msg`, and custom fields for filtering and alerting.

---

## 5. Getting Logs in Production

The app **only** writes to stdout. Getting logs into a central place is the responsibility of the **runtime and platform**.

### 5.1 High-level flow

1. **Capture**: Runtime (Docker, Kubernetes, ECS, systemd) captures stdout/stderr.
2. **Collect**: An agent or log driver sends logs to the chosen backend.
3. **Store & index**: Backend stores and indexes by level, time, and custom fields.
4. **Query & alert**: You search, build dashboards, and set alerts.

### 5.2 Platform options

| Platform | How logs get there | Best for | Cost / complexity |
|----------|--------------------|----------|--------------------|
| **AWS CloudWatch Logs** | Log driver (Docker) or agent (CloudWatch agent, Fluent Bit); optional Kinesis | Already on AWS, ECS/EKS | Low (pay per ingestion + storage) |
| **Datadog** | Datadog Agent (container or host); auto-parses JSON | Full observability (logs + APM + metrics) | Paid; simple setup |
| **Grafana Loki** | Promtail, Fluent Bit, or Grafana Agent; push or scrape | Self-hosted or Grafana Cloud; log aggregation | Open source or Grafana Cloud |
| **Elasticsearch (ELK/OpenSearch)** | Filebeat / Fluentd / Fluent Bit → Logstash/OpenSearch | Full-text search, custom pipelines | Self-managed complexity or Elastic Cloud |
| **Google Cloud Logging** | Fluentd default on GKE; or Cloud Logging agent | GCP, GKE | Integrated with GCP |
| **Azure Monitor** | Azure Log Analytics agent or sidecar | Azure, AKS | Integrated with Azure |
| **Splunk** | Splunk forwarder or HTTP Event Collector | Enterprise, compliance | License cost |

### 5.3 Practical “how” by environment

#### Docker (e.g. docker-compose or single host)

- **Option A**: Let Docker capture stdout; use a **log driver** (e.g. `awslogs`, `gcplogs`, `splunk`) so the daemon sends logs directly to the platform.
- **Option B**: Run a **log agent** (Fluent Bit, Datadog Agent, etc.) as a sidecar or on the host, reading container stdout and forwarding to your backend.

Example (Docker Compose with no agent; logs only local):

```yaml
services:
  app:
    image: stock-trading-api:1.0.0
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

For production you’d switch `driver` to `awslogs` (with options) or rely on an external agent.

#### Kubernetes

- **Option A**: **Sidecar**: A container in the same pod (e.g. Fluent Bit, Promtail) reads the app container’s logs from the shared volume and ships to Loki/Datadog/CloudWatch/etc.
- **Option B**: **Node-level agent**: DaemonSet (e.g. Fluent Bit, Datadog Agent) reads all pod logs from the node and forwards them.
- **Option C**: **Cloud-specific**: e.g. CloudWatch for EKS, Azure Monitor for AKS; configure the cluster to send container logs to the managed service.

In all cases the **application stays unchanged**: it only writes JSON to stdout.

### 5.4 Retention and indexing

- **Retention**: Define in the log platform (e.g. 7–30 days hot, then archive or delete) to control cost and compliance.
- **Indexing**: Use JSON fields (`level`, `time`, `userId`, `correlationId`, `msg`) for filters and alerts; avoid indexing high-cardinality or useless fields.

---

## 6. Observability: Logs + Metrics + Traces

Logs alone are not full observability. Use them together:

| Pillar | Role | In this API |
|--------|------|-------------|
| **Logs** | Discrete events, errors, context | Pino → stdout → platform (this doc). |
| **Metrics** | Counters, histograms (latency, throughput, errors) | `/health`, `/metrics` (if added); scraped by Prometheus or equivalent. |
| **Traces** | Request flow across boundaries (HTTP → DB → vendor) | Optional: OpenTelemetry + Jaeger/Datadog; correlationId is a first step. |

**Recommendations:**

1. **Logs**: Keep structured JSON; ensure **correlationId** (and optionally **userId**) on every request log (see section 9).
2. **Metrics**: Expose a `/metrics` endpoint (e.g. Prometheus format) with request count, latency, and error rate by route; scrape from the same platform or Prometheus.
3. **Traces**: For deep observability, add OpenTelemetry and send traces to the same vendor (e.g. Datadog, Grafana Tempo); correlationId can be set as trace ID for a quick win.

Then in the **same** platform (e.g. Datadog or Grafana) you can jump from a log line to the corresponding trace and metrics.

---

## 7. Security and Compliance

- **No secrets in logs**: Already enforced by not logging `VENDOR_API_KEY`, headers, or connection strings.
- **PII**: Prefer opaque IDs (e.g. `userId`); avoid logging email, name, or IP unless required and compliant.
- **Redaction**: If you must log request bodies, redact known sensitive fields (e.g. password, token) in a middleware or logger serializer.
- **Compliance**: Retention and access to logs should follow your policy (e.g. GDPR, SOC2); define retention and access in the log platform.

---

## 8. Configuration (Env and DevOps)

| Variable | Default | Description |
|----------|--------|-------------|
| **LOG_LEVEL** | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| **NODE_ENV** | `development` | Drives pretty (dev) vs JSON (production) and `base.env` in logs |

**Production checklist:**

- Set **LOG_LEVEL=info** (or `warn` if you need to reduce volume).
- Set **NODE_ENV=production** so output is JSON.
- Ensure the runtime or log agent is configured to collect stdout.
- In the log platform: enable indexing on `level`, `time`, `msg`, and key business fields (`userId`, `correlationId`, `symbol`, etc.).
- Configure retention and alerts (e.g. alert when `level: error` rate exceeds a threshold).

---

## 9. Recommended Improvements

These changes improve traceability and align with the strategy above.

| Improvement | Description |
|-------------|-------------|
| **Request-scoped child logger** | In `requestContextMiddleware`, create a Pino child with `correlationId` (and `userId` when present) and attach it to `req` or AsyncLocalStorage so every log in that request automatically includes these fields. |
| **Access log middleware** | One log line per request: method, path, statusCode, duration, correlationId. Use the same child logger. |
| **Metrics endpoint** | Add `/metrics` (e.g. `prom-client`) with request duration and count by route and status; use for dashboards and SLOs. |
| **Structured error serialization** | Ensure `err` in `logger.error({ err }, ...)` is serialized (e.g. Pino’s `serializers.err`) so stack traces and message appear in the log platform. |

---

## 10. Summary

| Topic | Summary |
|-------|---------|
| **Where logs are produced** | Single Pino logger in `src/infrastructure/config/logger.ts`; all layers use it. |
| **Where they go** | stdout (JSON in production, pretty in development). |
| **How they reach production** | Runtime captures stdout; agent or log driver sends to your chosen platform (CloudWatch, Datadog, Loki, ELK, etc.). |
| **Observability** | Use logs + metrics (+ optional traces) in one platform; correlationId and optional OpenTelemetry tie them together. |
| **Security** | No secrets; minimal PII; redact if needed; define retention and access. |

For vendor-specific log patterns and troubleshooting, see **docs/vendor-api-logging.md**.

---

## Appendix A: File tree (logging-related)

```
src/
├── infrastructure/
│   ├── config/
│   │   └── logger.ts          # Pino instance, LOG_LEVEL, transport (pretty vs JSON)
│   └── http/
│       └── middlewares/
│           └── request-context.ts   # correlationId, userId, AsyncLocalStorage
docs/
├── logging-and-observability.md    # This document
└── vendor-api-logging.md           # Vendor API log patterns
```

## Appendix B: Platform choice (quick reference)

| If you use…           | Log destination to consider      |
|-----------------------|-----------------------------------|
| AWS (ECS, EKS, Lambda)| CloudWatch Logs (+ optional Kinesis) |
| GCP / GKE             | Cloud Logging                     |
| Azure / AKS           | Azure Monitor (Log Analytics)     |
| Any cloud, want all-in-one | Datadog (logs + APM + metrics)  |
| Self-hosted / Grafana | Grafana Loki + Promtail/Fluent Bit |
| On-prem / enterprise  | Splunk or ELK/OpenSearch         |
