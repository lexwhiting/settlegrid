# settlegrid-sec-edgar

SEC EDGAR MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sec-edgar)

SEC filings, company submissions, and CIK lookups from EDGAR

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_filings(q)` | Full-text search SEC filings | 2¢ |
| `get_company_filings(cik)` | Get all filings for a company by CIK | 2¢ |

## Parameters

### search_filings
- `q` (string, required) — Search query
- `dateRange` (string, optional) — Date range filter
- `forms` (string, optional) — Form types (e.g. 10-K,10-Q)

### get_company_filings
- `cik` (string, required) — Company CIK number (e.g. 0000320193 for Apple)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC EDGAR API.

## Upstream API

- **Provider**: SEC EDGAR
- **Base URL**: https://efts.sec.gov/LATEST
- **Auth**: None required
- **Docs**: https://efts.sec.gov/LATEST/search-index?q=about

## Deploy

### Docker

```bash
docker build -t settlegrid-sec-edgar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sec-edgar
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
