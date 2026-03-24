# settlegrid-treasury-rates

US Treasury Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-treasury-rates)

US Treasury yields and interest rate data from the Fiscal Data API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_treasury_rates()` | Current treasury yield rates | 1¢ |
| `get_debt_to_penny()` | National debt total | 1¢ |
| `get_avg_interest_rates()` | Average interest rates on debt | 1¢ |

## Parameters

### get_treasury_rates

### get_debt_to_penny

### get_avg_interest_rates

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Treasury Fiscal Data API — it is completely free.

## Upstream API

- **Provider**: US Treasury Fiscal Data
- **Base URL**: https://api.fiscaldata.treasury.gov/services/api/fiscal_service
- **Auth**: None required
- **Docs**: https://fiscaldata.treasury.gov/api-documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-treasury-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-treasury-rates
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
