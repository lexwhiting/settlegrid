# settlegrid-shopify

Shopify MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Access Shopify Storefront API for products, collections, and shop data.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_products(query)` | Search store products | 2¢ |
| `get_product(handle)` | Get product by handle | 1¢ |
| `get_collections()` | List product collections | 1¢ |
| `get_shop_info()` | Get shop information | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `SHOPIFY_STORE_DOMAIN` | Yes | Shopify store domain |
| `SHOPIFY_STOREFRONT_TOKEN` | Yes | Storefront API access token |

## Upstream API

- **Provider**: Shopify
- **Base URL**: https://{store}.myshopify.com/api/2024-01/graphql.json
- **Auth**: Storefront token (header)
- **Docs**: https://shopify.dev/docs/storefront-api

## Deploy

### Docker
```bash
docker build -t settlegrid-shopify .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e SHOPIFY_STOREFRONT_TOKEN=xxx -p 3000:3000 settlegrid-shopify
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
