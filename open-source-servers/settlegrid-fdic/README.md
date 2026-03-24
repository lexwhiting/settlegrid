# settlegrid-fdic

FDIC Bank Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fdic)

FDIC bank financial data, institution search, and failure records

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_institutions()` | Search for FDIC-insured institutions | 1¢ |
| `get_failures()` | Get list of bank failures | 1¢ |

## Parameters

### search_institutions
- `filters` (string, optional) — Filter expression (e.g. STNAME:California)
- `limit` (number, optional) — Results limit (default: 20)

### get_failures
- `limit` (number, optional) — Results limit (default: 20)
- `sort_by` (string, optional) — Sort field (default: "FAILDATE")
- `sort_order` (string, optional) — ASC or DESC (default: "DESC")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FDIC Bank Data API.

## Upstream API

- **Provider**: FDIC Bank Data
- **Base URL**: https://banks.data.fdic.gov/api
- **Auth**: None required
- **Docs**: https://banks.data.fdic.gov/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-fdic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fdic
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
