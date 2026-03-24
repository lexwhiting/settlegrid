# settlegrid-banking-rates

Banking & Treasury Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-banking-rates)

Treasury bill rates, Fed Funds rate, and historical interest rate data via US Treasury FiscalData.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_treasury_rates(date?)` | Get Treasury bill rates | 1¢ |
| `get_fed_rate()` | Get current Federal Funds rate | 1¢ |
| `get_historical(type, months?)` | Get historical rates | 1¢ |

## Parameters

### get_treasury_rates
- `date` (string) — Specific date YYYY-MM-DD (default: latest)

### get_fed_rate

### get_historical
- `type` (string, required) — Rate type: treasury, fed_funds, prime
- `months` (number) — Months of history (default: 12)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Treasury FiscalData API — it is completely free.

## Upstream API

- **Provider**: US Treasury FiscalData
- **Base URL**: https://api.fiscaldata.treasury.gov/services/api/fiscal_service
- **Auth**: None required
- **Docs**: https://fiscaldata.treasury.gov/api-documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-banking-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-banking-rates
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
