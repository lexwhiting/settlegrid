# settlegrid-forex-rates

Forex Exchange Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-forex-rates)

Real-time and historical foreign exchange rates via the free Frankfurter API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_rates(base?, symbols?)` | Get latest exchange rates | 1¢ |
| `convert(from, to, amount)` | Convert currency amount | 1¢ |
| `get_historical(date, base?)` | Get historical rates for a date | 1¢ |

## Parameters

### get_rates
- `base` (string) — Base currency code (default: USD)
- `symbols` (string) — Comma-separated target currencies

### convert
- `from` (string, required) — Source currency code
- `to` (string, required) — Target currency code
- `amount` (number, required) — Amount to convert

### get_historical
- `date` (string, required) — Date in YYYY-MM-DD format
- `base` (string) — Base currency code (default: USD)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Frankfurter API — it is completely free.

## Upstream API

- **Provider**: Frankfurter
- **Base URL**: https://api.frankfurter.app
- **Auth**: None required
- **Docs**: https://www.frankfurter.app/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-forex-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-forex-rates
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
