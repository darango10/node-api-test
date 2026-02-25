# Data Model: Order Invoice Endpoint

**Branch**: `005-order-invoice-endpoint` | **Phase**: 1

Entities and value objects for the invoicing feature. No persistence is required for the core flow; these models represent **inbound payloads**, **outbound payloads**, and **validation rules**.

---

## 1. Order Status Update (Inbound)

Represents the webhook payload sent by external systems (ERP, WMS, Logistics).

| Field         | Type     | Required | Validation / Notes |
|---------------|----------|----------|--------------------|
| orderId       | string   | Yes      | Non-empty; used for logging and VTEX path |
| orderStatus   | string   | Yes      | Must be one of the configured target statuses (e.g. PREPARING_SHIPPING, DELIVERED) to trigger invoice |
| items         | array    | Yes      | Length > 0; each element is a Line Item (inbound) |

**Validation rules (from spec)**:
- `orderId` must be present and non-empty.
- `items` must be present and have at least one element.
- If `orderStatus` is not one of the configured target statuses (e.g. PREPARING_SHIPPING or DELIVERED), the system does not call VTEX (acknowledge with 200 and log).

---

## 2. Line Item (Inbound)

Single line item in the order status update.

| Field        | Type           | Required | Validation / Notes |
|--------------|----------------|----------|--------------------|
| id           | string         | Yes      | Pass-through to VTEX |
| price        | number         | Yes      | Decimal (e.g. 150.00) or already in cents; see transformation |
| quantity     | integer        | Yes      | Pass-through; positive |
| description  | string         | Yes      | Truncated to 255 chars in outbound |

---

## 3. Invoice Request (Outbound)

Transformed payload sent to the VTEX OMS invoice API. Built from Order Status Update by domain transformation logic.

| Field          | Type     | Required | Source / Notes |
|----------------|----------|----------|----------------|
| type           | string   | Yes      | Fixed "Output" (or configurable) |
| issuanceDate   | string   | Yes      | ISO 8601 UTC (e.g. 2026-02-25T17:09:16Z) |
| invoiceNumber  | string   | Yes      | Generated e.g. INV-{orderId} or from payload if provided |
| invoiceValue   | integer  | Yes      | Sum of (item price in cents × quantity) for all items |
| items          | array    | Yes      | Line Item (outbound)[] |

---

## 4. Line Item (Outbound)

VTEX-form item format.

| Field        | Type    | Required | Transformation |
|--------------|---------|----------|----------------|
| id           | string  | Yes      | Pass-through from inbound |
| price        | integer | Yes      | In cents (multiply by 100 if inbound is decimal) |
| quantity     | integer | Yes      | Pass-through |
| description  | string  | Yes      | Truncate to 255 characters |

---

## 5. State / Flow (No Persistent State)

- **No domain state machine** is required: each request is stateless (validate → transform → call VTEX or acknowledge).
- **DLQ**: Failed payloads (after max retries) are represented as the same inbound structure (Order Status Update) plus optional metadata (orderId, attempt count, last error) when written to the DLQ adapter; exact shape is adapter-specific (e.g. file content = JSON string of payload + metadata).

---

## 6. Validation Rules Summary

| Rule | Location | Action on failure |
|------|----------|-------------------|
| orderId present, non-empty | Inbound validation | 400 Bad Request |
| items present, length > 0 | Inbound validation | 400 Bad Request |
| orderStatus in configured target statuses | Application / domain | 200 OK, no VTEX call, log |
| Item id, price, quantity, description present and valid types | Inbound validation | 400 Bad Request |
| Description length ≤ 255 (outbound) | Transformation | Truncate (no failure) |
| Price conversion to integer cents | Transformation | Assume numeric; floor/math per business rule |

---

## 7. Key Entities (Spec Mapping)

| Spec entity              | Data model artifact |
|--------------------------|----------------------|
| Order Status Update (inbound) | Order Status Update + Line Item (inbound) |
| Invoice Request (outbound)   | Invoice Request + Line Item (outbound) |
| Line Item                   | Line Item (inbound) and Line Item (outbound) with mapping rules |
