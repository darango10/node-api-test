# Quickstart: Stock Trading API

**Branch**: `001-fuse-stock-trading-api`  
**Audience**: Evaluators and developers running the service locally (FR-009).

## Prerequisites

- **Node.js** LTS (e.g. 20.x)
- **MongoDB** running locally (default `mongodb://localhost:27017`) or connection string in env
- **npm** (or yarn/pnpm)

## 1. Install and configure

```bash
git clone <repo-url>
cd node-api
git checkout 001-fuse-stock-trading-api
npm ci
```

Create a `.env` (or set environment variables):

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/stock-trading
PORT=3000

# Vendor API (mock or real URL)
VENDOR_API_URL=http://localhost:4000   # or actual vendor base URL

# Daily report (optional for first run)
REPORT_RECIPIENTS=ops@example.com
SMTP_HOST=localhost
SMTP_PORT=1025
# ... other SMTP vars as needed
```

## 2. Start the service

```bash
npm start
```

Or with dev reload:

```bash
npm run dev
```

Service listens on `PORT` (default 3000). Ensure MongoDB is up before starting.

## 3. Verify and explore

- **Health**: `curl http://localhost:3000/health`
- **API docs (Swagger UI)**: Open [http://localhost:3000/api-docs](http://localhost:3000/api-docs) in a browser
- **List stocks**: `curl http://localhost:3000/stocks`
- **Get portfolio**: `curl http://localhost:3000/users/my-user-id/portfolio`
- **Execute purchase**:  
  `curl -X POST http://localhost:3000/users/my-user-id/purchases -H "Content-Type: application/json" -d '{"symbol":"AAPL","quantity":10,"price":150.00}'`

OpenAPI spec is in `specs/001-fuse-stock-trading-api/contracts/openapi.yaml`; Swagger UI is mounted from that spec.

## 4. Run tests

```bash
npm test
npm run coverage   # expect ≥ 80%
```

## 5. Daily report

The daily report runs on a schedule (e.g. once per day). Recipients and SMTP are set via env. If the service is down at report time, the run is skipped until the next scheduled time (no catch-up).

---

## Summary of main flows

| Flow            | Method | Path                              | Notes                    |
|-----------------|--------|-----------------------------------|--------------------------|
| List stocks     | GET    | `/stocks?nextToken=&limit=20`     | Pagination via nextToken |
| Get portfolio   | GET    | `/users/:userId/portfolio`        | Empty array if no holdings |
| Execute purchase| POST   | `/users/:userId/purchases`        | Body: symbol, quantity, price |
| Health          | GET    | `/health`                         | Liveness/readiness       |
| Metrics         | GET    | `/metrics`                       | Prometheus format        |
| API docs        | GET    | `/api-docs`                      | Swagger UI               |
