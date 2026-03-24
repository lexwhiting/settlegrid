# settlegrid-commodity-prices

Commodity Prices MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-commodity-prices)

Metal and commodity prices via Metals.dev and GoldAPI. Get spot prices for gold, silver, platinum, and oil.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_prices(metals?)` | Get current metal prices | 1¢ |
| `get_historical(metal, date)` | Get historical metal price | 1¢ |
| `get_oil_price()` | Get crude oil price | 1¢ |

## Parameters

### get_prices
- `metals` (string) — Comma-separated metals (gold, silver, platinum)

### get_historical
- `metal` (string, required) — Metal name (gold, silver, platinum)
- `date` (string, required) — Date in YYYY-MM-DD format

### get_oil_price

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `METALS_API_KEY` | No | Metals.dev API key from [https://metals.dev](https://metals.dev) |

## Upstream API

- **Provider**: Metals.dev
- **Base URL**: https://api.metals.dev/v1
- **Auth**: API key required
- **Docs**: https://metals.dev/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-commodity-prices .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-commodity-prices
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
