# settlegrid-ev-sales

EV Sales Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ev-sales)

Electric vehicle sales, stock, and market share by country.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ev_sales(country)` | Get EV sales by country | 1¢ |
| `get_ev_stock(country)` | Get EV stock by country | 1¢ |
| `get_ev_market_share(country)` | Get EV market share | 1¢ |

## Parameters

### get_ev_sales / get_ev_stock / get_ev_market_share
- `country` (string, required) — Country name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: IEA Global EV Data Explorer
- **Base URL**: https://api.iea.org/evs
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-ev-sales .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ev-sales
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
