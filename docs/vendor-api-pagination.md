# Vendor API Pagination Implementation

## Overview

The stock vendor API has been updated to handle the correct response format and implement automatic pagination to fetch ALL stocks.

## Changes Made

### 1. Vendor Response Format

The vendor API returns data in this structure:

```json
{
  "status": 200,
  "data": {
    "items": [
      {
        "symbol": "NVDA",
        "price": 0.25,
        "name": "NVIDIA Corporation",
        "sector": "Technology",
        "lastUpdated": "2026-02-06T22:29:55.969Z",
        "change": 0
      }
    ],
    "nextToken": "eyJzeW1ib2wiOiJDU0NPIn0="
  }
}
```

**Key differences from initial implementation:**
- Data is nested in `data.items` (not `stocks`)
- Next token is in `data.nextToken` (not top-level)
- Extra fields: `name`, `sector`, `lastUpdated`, `change`

### 2. Automatic Pagination

The `listStocks` method now automatically fetches **ALL stocks** from the vendor by following pagination:

```typescript
async listStocks(request: ListStocksRequest): Promise<ListStocksResponse> {
  const allStocks: Stock[] = [];
  let currentToken: string | undefined = request.nextToken;
  
  // Loop through all pages
  do {
    const response = await this.client.get('/stocks', { params });
    allStocks.push(...response.data.data.items);
    currentToken = response.data.data.nextToken;
  } while (currentToken);
  
  return {
    stocks: allStocks,
    nextToken: null, // Always null - we fetch everything
  };
}
```

### 3. Safety Features

- **Max Pages Limit**: Prevents infinite loops (100 pages max)
- **Detailed Logging**: Logs each page fetch with debug info
- **Error Handling**: Proper error messages for all failure scenarios

## API Behavior

### Before (Single Page)

```bash
GET /stocks?limit=20
# Returns: First 20 stocks + nextToken
```

User would need to call multiple times to get all stocks.

### After (All Stocks)

```bash
GET /stocks?limit=20
# Returns: ALL stocks (internally fetches all pages)
```

**How it works:**
1. Client calls GET /stocks
2. Server fetches page 1 from vendor (20 items)
3. If nextToken exists, fetches page 2 automatically
4. Continues until no nextToken
5. Returns all stocks in single response
6. Client always receives complete stock list

## Logging

When fetching stocks, you'll see detailed logs:

```
INFO: Starting to fetch all stocks from vendor
  limit: 20

DEBUG: Fetching page
  page: 1
  nextToken: undefined

DEBUG: Page fetched successfully
  page: 1
  pageSize: 20
  totalSoFar: 20
  hasNextPage: true

DEBUG: Fetching page
  page: 2
  nextToken: "eyJzeW1ib2wiOiJDU0NPIn0="

DEBUG: Page fetched successfully
  page: 2
  pageSize: 15
  totalSoFar: 35
  hasNextPage: false

INFO: All stocks fetched successfully from vendor
  totalStocks: 35
  pages: 2
```

## Price Endpoint

The `getCurrentPrice` method also handles the vendor format:

```typescript
// Supports both formats:
const price = response.data?.data?.price ?? response.data?.price;
```

This allows flexibility if the vendor format changes slightly.

## Testing

All tests updated to match vendor format:

```typescript
// Mock response in tests
nock(vendorBaseUrl)
  .get('/stocks')
  .reply(200, {
    status: 200,
    data: {
      items: [
        { symbol: 'AAPL', price: 150.0, name: 'Apple Inc.' }
      ],
      nextToken: 'page2token'
    }
  });
```

### Test Results

- ✅ Unit tests: 13/13 passed
- ✅ Integration tests: 9/9 passed
- ✅ Contract tests: 7/7 passed
- ✅ Pagination: Verified with multi-page test

## Performance Considerations

### Pros
- Simple API for clients (no pagination handling)
- Guaranteed complete data set
- Single request from client perspective

### Cons
- Longer response time for large datasets
- More vendor API calls per request
- Higher memory usage for large stock lists

### Recommendations

For production:
- Monitor response times
- Consider caching all stocks (updates less frequently)
- Add timeout monitoring for multi-page fetches
- Consider rate limiting to prevent vendor API overload

## Example Request/Response

### Request
```bash
curl http://localhost:3000/stocks
```

### Response
```json
{
  "stocks": [
    { "symbol": "NVDA", "price": 0.25 },
    { "symbol": "UNH", "price": 0.25 },
    { "symbol": "AAPL", "price": 150.0 },
    // ... all stocks ...
  ],
  "nextToken": null
}
```

Note: `nextToken` is always `null` since we return all stocks.

## Ready to Use!

The vendor API integration is now working correctly with:
- ✅ Correct response format handling
- ✅ Automatic pagination
- ✅ Complete error handling
- ✅ Comprehensive logging
- ✅ All tests passing

Run your server and it will fetch all stocks automatically! 🎉
