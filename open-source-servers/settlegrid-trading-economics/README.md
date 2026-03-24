# settlegrid-trading-economics

Trading Economics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-trading-economics)

Economic indicators, forecasts, and market data from Trading Economics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicators(country)` | Economic indicators by country | 1¢ |
| `get_markets(category)` | Market data (stocks, bonds, commodities) | 1¢ |
| `get_forecasts(indicator)` | Economic forecasts by indicator | 1¢ |

## Parameters

### get_indicators
- `country` (string, required) — Country name (e.g. "united states")

### get_markets
- `category` (string, required) — Market category (index, commodity, currency, bond)

### get_forecasts
- `indicator` (string, required) — Indicator name (e.g. "gdp", "inflation rate")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Trading Economics API — it is completely free.

## Upstream API

- **Provider**: Trading Economics
- **Base URL**: https://api.tradingeconomics.com
- **Auth**: None required
- **Docs**: https://docs.tradingeconomics.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-trading-economics .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-trading-economics
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
