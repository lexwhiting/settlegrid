# settlegrid-brandfetch

Brandfetch MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-brandfetch)

Get brand assets including logos, colors, and fonts for any company via Brandfetch.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BRANDFETCH_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_brand(domain)` | Get brand data (logos, colors, fonts) by domain | 2¢ |
| `search_brands(query)` | Search for brands by name | 2¢ |

## Parameters

### get_brand
- `domain` (string, required) — Company domain (e.g. "stripe.com")

### search_brands
- `query` (string, required) — Brand name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BRANDFETCH_API_KEY` | Yes | Brandfetch API key |


## Upstream API

- **Provider**: Brandfetch
- **Base URL**: https://api.brandfetch.io/v2
- **Auth**: Bearer token required
- **Rate Limits**: Free tier: 10 requests/month
- **Docs**: https://docs.brandfetch.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-brandfetch .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BRANDFETCH_API_KEY=xxx -p 3000:3000 settlegrid-brandfetch
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
