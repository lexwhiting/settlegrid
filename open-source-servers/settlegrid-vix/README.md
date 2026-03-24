# settlegrid-vix

VIX Volatility Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-vix)

CBOE Volatility Index (VIX) current and historical data. Track market fear gauge and term structure.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current()` | Get current VIX level | 1¢ |
| `get_historical(days?)` | Get historical VIX data | 1¢ |
| `get_term_structure()` | Get VIX term structure | 1¢ |

## Parameters

### get_current

### get_historical
- `days` (number) — Number of trading days (default: 30)

### get_term_structure

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CBOE API — it is completely free.

## Upstream API

- **Provider**: CBOE
- **Base URL**: https://cdn.cboe.com/api/global/us_indices/daily_prices
- **Auth**: None required
- **Docs**: https://www.cboe.com/tradable_products/vix/

## Deploy

### Docker

```bash
docker build -t settlegrid-vix .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-vix
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
