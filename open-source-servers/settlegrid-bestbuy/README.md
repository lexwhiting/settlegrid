# settlegrid-bestbuy

Best Buy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search Best Buy products and get pricing data.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_products(query)` | Search Best Buy products | 1¢ |
| `get_product(sku)` | Get product by SKU | 1¢ |
| `get_trending()` | Get trending products | 1¢ |
| `get_categories()` | List product categories | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `BESTBUY_API_KEY` | Yes | Best Buy API key from [bestbuyapis.com](https://bestbuyapis.com/) |

## Upstream API

- **Provider**: Best Buy
- **Base URL**: https://api.bestbuy.com/v1
- **Auth**: API key (query param)
- **Docs**: https://bestbuyapis.github.io/api-reference/

## Deploy

### Docker
```bash
docker build -t settlegrid-bestbuy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BESTBUY_API_KEY=xxx -p 3000:3000 settlegrid-bestbuy
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
