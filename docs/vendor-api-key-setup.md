# Vendor API Key Authentication Setup

## Overview

The stock vendor API requires authentication via the `x-api-key` header. This has been configured in the application.

## Changes Made

### 1. Updated StockVendorAdapter

**File**: `src/infrastructure/external/stock-vendor.adapter.ts`

- Added `apiKey` parameter to constructor
- Automatically includes `x-api-key` header in all requests

```typescript
constructor(
  private readonly baseUrl: string,
  private readonly apiKey: string,
  private readonly timeoutMs: number = 5000
) {
  this.client = axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,  // ← Authentication header
    },
  });
}
```

### 2. Updated Container Configuration

**File**: `src/infrastructure/config/container.ts`

- Passes `VENDOR_API_KEY` from environment variables to adapter

```typescript
const stockVendorPort = new StockVendorAdapter(
  config.VENDOR_API_URL,
  config.VENDOR_API_KEY || '',  // ← API key from .env
  5000
);
```

### 3. Updated Tests

**File**: `tests/integration/stock-vendor-adapter.spec.ts`

- All integration tests now verify the `x-api-key` header is sent
- Uses `.matchHeader('x-api-key', testApiKey)` in nock mocks

## Environment Variable

Your `.env` file already contains the API key:

```bash
VENDOR_API_KEY=nSbPbFJfe95BFZufiDwF32UhqZLEVQ5K4wdtJI2e
```

## How It Works

1. **Application starts** → Loads `VENDOR_API_KEY` from `.env`
2. **Container creates adapter** → Passes API key to `StockVendorAdapter`
3. **Every request to vendor** → Automatically includes `x-api-key` header
4. **Vendor authenticates** → Validates the key and processes request

## Testing

All tests verify the header is being sent correctly:

```bash
# Run integration tests
npm test -- tests/integration/stock-vendor-adapter.spec.ts

# All 9 tests should pass ✓
```

## Verification

When you call the vendor API, you'll see in the logs:

```
INFO: Fetching stocks from vendor
  params: { "limit": 20 }
  # Header x-api-key is automatically included
```

The API key is securely stored in environment variables and never logged or exposed in responses.

## Security Notes

- ✅ API key stored in `.env` (not in code)
- ✅ `.env` file is gitignored (not committed)
- ✅ Key automatically included in all vendor requests
- ✅ No manual header management needed
- ✅ Tests verify header is present

## Ready to Use!

The vendor API authentication is now fully configured. Just run:

```bash
npm run dev
```

And all calls to the vendor API will automatically include the authentication header! 🔐
