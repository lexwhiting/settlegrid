# settlegrid-open-exchange-rates

Open Exchange Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-exchange-rates)

Currency exchange rates and historical data via Open Exchange Rates.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest(base)` | Latest exchange rates | 2¢ |
| `get_historical(date, base)` | Historical rates for a date | 2¢ |
| `get_currencies()` | List all supported currencies | 1¢ |

## Parameters

### get_latest
- `base` (string) — Base currency (default USD)

### get_historical
- `date` (string, required) — Date (YYYY-MM-DD)
- `base` (string) — Base currency (default USD)

### get_currencies

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OXR_APP_ID` | Yes | Open Exchange Rates API key from [https://openexchangerates.org/signup](https://openexchangerates.org/signup) |

## Upstream API

- **Provider**: Open Exchange Rates
- **Base URL**: https://openexchangerates.org/api
- **Auth**: API key required
- **Docs**: https://docs.openexchangerates.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-open-exchange-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-exchange-rates
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
