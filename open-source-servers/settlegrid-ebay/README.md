# settlegrid-ebay

eBay MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search eBay listings, products, and auctions.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_items(query)` | Search eBay items | 2¢ |
| `get_item(item_id)` | Get item details | 1¢ |
| `get_item_by_upc(upc)` | Find item by UPC code | 1¢ |
| `get_trending(category)` | Get trending items | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `EBAY_APP_ID` | Yes | eBay App ID from [developer.ebay.com](https://developer.ebay.com/) |

## Upstream API

- **Provider**: eBay
- **Base URL**: https://svcs.ebay.com/services/search/FindingService/v1
- **Auth**: API key (header)
- **Docs**: https://developer.ebay.com/develop/apis

## Deploy

### Docker
```bash
docker build -t settlegrid-ebay .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e EBAY_APP_ID=xxx -p 3000:3000 settlegrid-ebay
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
