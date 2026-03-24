# settlegrid-mortgage-rates

Mortgage Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mortgage-rates)

US Treasury rates and fiscal data for mortgage rate tracking.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_treasury_rates()` | Get recent Treasury yield curve rates | 1¢ |
| `get_debt_data()` | Get public debt outstanding data | 1¢ |

## Parameters



## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: US Treasury Fiscal Data
- **Base URL**: https://api.fiscaldata.treasury.gov
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://fiscaldata.treasury.gov/api-documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-mortgage-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mortgage-rates
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
