# VTEX Invoice API (Outbound Contract)

**Branch**: 005-order-invoice-endpoint

The middleware calls the VTEX OMS Invoice API as a downstream dependency. This document describes the **outbound** contract and mapping from our transformed payload.

## Endpoint

- **Method**: POST  
- **URL**: `https://{accountName}.{environment}.com.br/api/oms/pvt/orders/{orderId}/invoice`  
  - `accountName` and `environment` are configured (e.g. env vars).  
  - `orderId` comes from the inbound webhook payload.

## Headers (Required)

| Header              | Source                    |
|---------------------|---------------------------|
| X-VTEX-API-AppKey   | Secrets (env or vault)     |
| X-VTEX-API-AppToken | Secrets (env or vault)     |
| Accept              | application/json          |
| Content-Type        | application/json          |

## Request Body (Transformed)

Our **Invoice Request** (see data-model.md) is sent as JSON. VTEX expects:

| Field          | Type    | Notes |
|----------------|---------|--------|
| type           | string  | "Output" |
| issuanceDate   | string  | ISO 8601 UTC |
| invoiceNumber  | string  | e.g. INV-{orderId} |
| invoiceValue   | integer | Sum of item totals in **cents** |
| items          | array   | See below |

**Item shape**:

| Field       | Type    | Notes |
|-------------|---------|--------|
| id          | string  | From inbound item id |
| price       | integer | **Cents** (e.g. 150.00 → 15000) |
| quantity    | integer | Pass-through |
| description | string  | Max 255 characters (truncate if needed) |

## Example (from PRD)

```json
{
  "type": "Output",
  "issuanceDate": "2026-02-25T17:09:16Z",
  "invoiceNumber": "INV-1613140529899-01",
  "invoiceValue": 30000,
  "items": [
    {
      "id": "1023",
      "price": 15000,
      "quantity": 2,
      "description": "Wireless Noise-Canceling Headphones"
    }
  ]
}
```

## Response Handling

- **2xx**: Success; log and return success to webhook caller.
- **4xx**: Do **not** retry; log as integration error; return 502 or 503 to caller (or map per product decision).
- **429 / 5xx**: Retry with exponential backoff (2s base, 2x, max 5 attempts); after max, send payload to DLQ.

This contract is **implemented by** the VTEX adapter (infrastructure) and **consumed by** the ProcessOrderStatusUpdate use case via the VtexInvoicePort.
