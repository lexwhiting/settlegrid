# settlegrid-walmart

Walmart MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search Walmart products and get pricing data via BlueCart API.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_products(query)` | Search Walmart products | 2¢ |
| `get_product(item_id)` | Get product by item ID | 1¢ |
| `get_reviews(item_id)` | Get product reviews | 1¢ |
| `get_categories()` | List product categories | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `BLUECART_API_KEY` | Yes | BlueCart API key from [bluecartapi.com](https://www.bluecartapi.com/) |

## Upstream API

- **Provider**: BlueCart
- **Base URL**: https://api.bluecartapi.com
- **Auth**: API key (query param)
- **Docs**: https://www.bluecartapi.com/docs

## Deploy

### Docker
```bash
docker build -t settlegrid-walmart .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BLUECART_API_KEY=xxx -p 3000:3000 settlegrid-walmart
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
