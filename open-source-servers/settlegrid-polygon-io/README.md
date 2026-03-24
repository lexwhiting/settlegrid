# settlegrid-polygon-io

Polygon.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-polygon-io)

Stock, options, and forex market data via the Polygon.io API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ticker_details(ticker)` | Ticker details and company info | 2¢ |
| `get_daily_bars(ticker, from, to)` | Daily OHLCV bars | 2¢ |
| `get_previous_close(ticker)` | Previous day close price | 2¢ |

## Parameters

### get_ticker_details
- `ticker` (string, required) — Stock ticker (e.g. AAPL)

### get_daily_bars
- `ticker` (string, required) — Stock ticker
- `from` (string, required) — Start date (YYYY-MM-DD)
- `to` (string, required) — End date (YYYY-MM-DD)

### get_previous_close
- `ticker` (string, required) — Stock ticker

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `POLYGON_API_KEY` | Yes | Polygon.io API key from [https://polygon.io/dashboard/signup](https://polygon.io/dashboard/signup) |

## Upstream API

- **Provider**: Polygon.io
- **Base URL**: https://api.polygon.io
- **Auth**: API key required
- **Docs**: https://polygon.io/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-polygon-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-polygon-io
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
