# settlegrid-g2-reviews

G2 Reviews MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Access G2 software reviews and ratings.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_products(query)` | Search software products | 1¢ |
| `get_product(product_id)` | Get product details | 1¢ |
| `get_reviews(product_id)` | Get product reviews | 2¢ |
| `get_categories()` | List software categories | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `G2_API_TOKEN` | Yes | G2 API token from [g2.com](https://www.g2.com/) |

## Upstream API

- **Provider**: G2
- **Base URL**: https://data.g2.com/api/v1
- **Auth**: API token (header)
- **Docs**: https://data.g2.com/api/docs

## Deploy

### Docker
```bash
docker build -t settlegrid-g2-reviews .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e G2_API_TOKEN=xxx -p 3000:3000 settlegrid-g2-reviews
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
