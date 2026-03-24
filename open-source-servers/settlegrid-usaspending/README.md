# settlegrid-usaspending

USASpending MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usaspending)

US federal government spending, awards, contracts, and agency budgets

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_spending(keyword)` | Search federal spending records | 2¢ |
| `get_agency(toptier_code)` | Get agency budget overview | 1¢ |

## Parameters

### search_spending
- `keyword` (string, required) — Search keyword
- `limit` (number, optional) — Results limit (default: 20)

### get_agency
- `toptier_code` (string, required) — Agency code (e.g. 012 for USDA)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USASpending API.

## Upstream API

- **Provider**: USASpending
- **Base URL**: https://api.usaspending.gov/api/v2
- **Auth**: None required
- **Docs**: https://api.usaspending.gov/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-usaspending .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usaspending
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
