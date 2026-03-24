# settlegrid-product-hunt

Product Hunt MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-product-hunt)

Trending tech products and startup launches from Product Hunt

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PRODUCTHUNT_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_posts()` | Get today's featured products | 2¢ |

## Parameters

### get_posts
- `order` (string, optional) — Order: RANKING, VOTES (default: "RANKING")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PRODUCTHUNT_TOKEN` | Yes | Product Hunt API key from [https://api.producthunt.com/v2/docs](https://api.producthunt.com/v2/docs) |

## Upstream API

- **Provider**: Product Hunt
- **Base URL**: https://api.producthunt.com/v2/api
- **Auth**: API key (bearer)
- **Docs**: https://api.producthunt.com/v2/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-product-hunt .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PRODUCTHUNT_TOKEN=xxx -p 3000:3000 settlegrid-product-hunt
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
