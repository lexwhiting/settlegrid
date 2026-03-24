# settlegrid-ecb-exchange

ECB Exchange Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ecb-exchange)

Official European Central Bank reference exchange rates updated daily

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest()` | Get latest ECB exchange rates | 1¢ |
| `get_historical(date)` | Get historical exchange rates for a date | 1¢ |
| `get_time_series(start, end)` | Get exchange rate time series | 2¢ |

## Parameters

### get_latest
- `from` (string, optional) — Base currency (default EUR)
- `to` (string, optional) — Target currencies comma-separated

### get_historical
- `date` (string, required) — Date in YYYY-MM-DD format
- `from` (string, optional) — Base currency

### get_time_series
- `start` (string, required) — Start date YYYY-MM-DD
- `end` (string, required) — End date YYYY-MM-DD
- `from` (string, optional) — Base currency
- `to` (string, optional) — Target currencies

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ECB Exchange Rates API.

## Upstream API

- **Provider**: ECB Exchange Rates
- **Base URL**: https://api.frankfurter.app
- **Auth**: None required
- **Docs**: https://www.frankfurter.app/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-ecb-exchange .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ecb-exchange
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
