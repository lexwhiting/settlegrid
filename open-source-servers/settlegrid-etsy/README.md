# settlegrid-etsy

Etsy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search Etsy for handmade, vintage, and custom items.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_listings(query)` | Search active listings | 2¢ |
| `get_listing(listing_id)` | Get listing details | 1¢ |
| `get_shop(shop_id)` | Get shop details | 1¢ |
| `get_trending_keywords()` | Get trending search keywords | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `ETSY_API_KEY` | Yes | Etsy API key from [etsy.com/developers](https://www.etsy.com/developers/) |

## Upstream API

- **Provider**: Etsy
- **Base URL**: https://openapi.etsy.com/v3
- **Auth**: API key (header)
- **Docs**: https://developers.etsy.com/documentation/

## Deploy

### Docker
```bash
docker build -t settlegrid-etsy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ETSY_API_KEY=xxx -p 3000:3000 settlegrid-etsy
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
