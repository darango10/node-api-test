# Server Startup Output Example

When you run `npm run dev` or `npm start`, you'll see:

```
🚀 Server listening on port 3000
🌍 Environment: development
📚 API Documentation: http://localhost:3000/api-docs

📍 Available Endpoints:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GET     /health
  GET     /metrics
  GET     /stocks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Color Coding

When viewed in the terminal, HTTP methods will be color-coded:
- **GET** - Green
- **POST** - Yellow
- **PUT** - Blue
- **PATCH** - Cyan
- **DELETE** - Red

## What's Included

The endpoint list automatically displays:
- ✅ Health check endpoint (`/health`)
- ✅ Metrics endpoint (`/metrics`)
- ✅ Stock listing endpoint (`/stocks`)
- ✅ Link to API documentation (`/api-docs`)

As you add more endpoints in future phases (portfolio, purchases), they'll automatically appear in the list!
