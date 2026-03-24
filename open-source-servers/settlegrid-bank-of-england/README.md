# settlegrid-bank-of-england

Bank of England MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bank-of-england)

BoE statistics, interest rates, and economic data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_series(seriesCode, fromDate)` | Get time series data by code | 1¢ |
| `get_bank_rate()` | Current BoE bank rate history | 1¢ |
| `get_inflation()` | UK CPI inflation data | 1¢ |

## Parameters

### get_series
- `seriesCode` (string, required) — Series code (e.g. IUDBEDR for bank rate)
- `fromDate` (string) — Start date (DD/MMM/YYYY)

### get_bank_rate

### get_inflation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Bank of England API — it is completely free.

## Upstream API

- **Provider**: Bank of England
- **Base URL**: https://www.bankofengland.co.uk/boeapps/database
- **Auth**: None required
- **Docs**: https://www.bankofengland.co.uk/statistics

## Deploy

### Docker

```bash
docker build -t settlegrid-bank-of-england .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bank-of-england
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
