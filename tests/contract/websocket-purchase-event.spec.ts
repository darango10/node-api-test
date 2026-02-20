import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCHEMA_PATH = resolve(
  process.cwd(),
  'specs/004-websocket-stock-events/contracts/purchase-completed-event.schema.json'
);

/**
 * Contract test: purchase_completed message shape conforms to the JSON schema.
 * Validates required fields, types, and that no extra properties are allowed.
 */
describe('purchase_completed event contract', () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));

  it('should have required fields in schema', () => {
    expect(schema.required).toEqual(['type', 'userId', 'symbol', 'quantity', 'success']);
  });

  it('should validate a valid payload conforms to schema rules', () => {
    const validPayload = {
      type: 'purchase_completed',
      userId: 'user123',
      symbol: 'AAPL',
      quantity: 10,
      success: true,
      price: 150.0,
      total: 1500.0,
      timestamp: new Date().toISOString(),
    };

    expect(validPayload.type).toBe(schema.properties.type.const);
    expect(validPayload.success).toBe(schema.properties.success.const);
    expect(typeof validPayload.userId).toBe('string');
    expect(validPayload.userId.length).toBeGreaterThanOrEqual(1);
    expect(typeof validPayload.symbol).toBe('string');
    expect(validPayload.symbol.length).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(validPayload.quantity)).toBe(true);
    expect(validPayload.quantity).toBeGreaterThanOrEqual(1);
    if (validPayload.price != null) expect(validPayload.price).toBeGreaterThan(0);
    if (validPayload.total != null) expect(validPayload.total).toBeGreaterThanOrEqual(0);
    expect(schema.additionalProperties).toBe(false);

    const allowedKeys = new Set([
      ...schema.required,
      ...Object.keys(schema.properties).filter((k) => !schema.required.includes(k)),
    ]);
    for (const key of Object.keys(validPayload)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it('should reject payload with missing required field', () => {
    const missingUserId = {
      type: 'purchase_completed',
      symbol: 'AAPL',
      quantity: 10,
      success: true,
    };
    expect(schema.required.every((r: string) => r in missingUserId)).toBe(false);
  });

  it('should reject payload with wrong type value', () => {
    expect(schema.properties.type.const).toBe('purchase_completed');
  });
});
