# settlegrid-treasury-rates

US Treasury Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-treasury-rates)

US Treasury interest rates, yield curves, and daily treasury data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_rates()` | Get daily Treasury interest rates | 1¢ |
| `get_debt()` | Get US public debt data | 1¢ |

## Parameters

### get_rates
- `sort` (string, optional) — Sort field (e.g. -record_date) (default: "-record_date")
- `page_size` (number, optional) — Results per page (default: 20)

### get_debt
- `sort` (string, optional) — Sort field (default: "-record_date")
- `page_size` (number, optional) — Results per page (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Treasury Rates API.

## Upstream API

- **Provider**: US Treasury Rates
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
