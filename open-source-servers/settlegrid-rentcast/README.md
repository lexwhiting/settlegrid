# settlegrid-rentcast

Rentcast MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rentcast)

Rental estimates, property records, and market data via Rentcast.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + RENTCAST_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_rent_estimate(address)` | Get rental estimate for a property by address | 2¢ |
| `get_market_stats(zipCode)` | Get rental market statistics by zip code | 2¢ |

## Parameters

### get_rent_estimate
- `address` (string, required)

### get_market_stats
- `zipCode` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RENTCAST_API_KEY` | Yes | API key from rentcast.io |


## Upstream API

- **Provider**: Rentcast
- **Base URL**: https://api.rentcast.io/v1
- **Auth**: Free API key required
- **Rate Limits**: 100 req/mo (free)
- **Docs**: https://developers.rentcast.io/reference

## Deploy

### Docker

```bash
docker build -t settlegrid-rentcast .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e RENTCAST_API_KEY=xxx -p 3000:3000 settlegrid-rentcast
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
