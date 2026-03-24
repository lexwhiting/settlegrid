# settlegrid-commodity-futures

Agricultural Commodity Futures MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-commodity-futures)

Access agricultural commodity prices and historical data from public sources. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_prices(commodity)` | Get current commodity prices | 2¢ |
| `get_historical(commodity, days?)` | Get historical commodity prices | 2¢ |
| `list_commodities()` | List available agricultural commodities | 1¢ |

## Parameters

### get_prices
- `commodity` (string, required) — Commodity name (e.g. Corn, Wheat, Soybeans, Cotton)

### get_historical
- `commodity` (string, required) — Commodity name
- `days` (number) — Number of days of history (default: 30)

### list_commodities

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Treasury Fiscal Data API — it is completely free.

## Upstream API

- **Provider**: US Treasury Fiscal Data
- **Base URL**: https://api.fiscaldata.treasury.gov
- **Auth**: None required
- **Docs**: https://fiscaldata.treasury.gov/api-documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-commodity-futures .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-commodity-futures
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
