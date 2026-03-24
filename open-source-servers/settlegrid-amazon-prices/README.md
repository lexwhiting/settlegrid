# settlegrid-amazon-prices

Amazon Prices MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Track Amazon product prices and search products via the Rainforest API.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_products(query)` | Search Amazon products | 2¢ |
| `get_product(asin)` | Get product details by ASIN | 1¢ |
| `get_price_history(asin)` | Get price history for ASIN | 2¢ |
| `get_bestsellers(category)` | Get bestseller rankings | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `RAINFOREST_API_KEY` | Yes | Rainforest API key |

## Upstream API

- **Provider**: Rainforest API
- **Base URL**: https://api.rainforestapi.com
- **Auth**: API key (query param)
- **Docs**: https://www.rainforestapi.com/docs

## Deploy

### Docker
```bash
docker build -t settlegrid-amazon-prices .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e RAINFOREST_API_KEY=xxx -p 3000:3000 settlegrid-amazon-prices
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
