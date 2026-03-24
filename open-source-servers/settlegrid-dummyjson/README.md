# settlegrid-dummyjson

DummyJSON MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dummyjson)

Fake REST API with products, users, carts, and authentication for testing

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_products()` | Get list of products | 1¢ |
| `search_products(q)` | Search products by query | 1¢ |
| `get_quotes()` | Get random quotes | 1¢ |

## Parameters

### get_products
- `limit` (number, optional) — Results limit (default: 20)
- `skip` (number, optional) — Results to skip (default: 0)

### search_products
- `q` (string, required) — Search query

### get_quotes
- `limit` (number, optional) — Number of quotes (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DummyJSON API.

## Upstream API

- **Provider**: DummyJSON
- **Base URL**: https://dummyjson.com
- **Auth**: None required
- **Docs**: https://dummyjson.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-dummyjson .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dummyjson
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
