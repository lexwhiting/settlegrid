# settlegrid-price-api

Price API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Compare prices across online stores.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_prices(query)` | Search product prices | 2¢ |
| `get_job(job_id)` | Get price job results | 1¢ |
| `get_product_price(url)` | Get price for product URL | 2¢ |
| `compare_prices(query)` | Compare prices across stores | 3¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `PRICEAPI_KEY` | Yes | PriceAPI key from [priceapi.com](https://www.priceapi.com/) |

## Upstream API

- **Provider**: PriceAPI
- **Base URL**: https://api.priceapi.com/v2
- **Auth**: API key (header)
- **Docs**: https://www.priceapi.com/docs

## Deploy

### Docker
```bash
docker build -t settlegrid-price-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PRICEAPI_KEY=xxx -p 3000:3000 settlegrid-price-api
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
