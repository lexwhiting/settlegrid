# settlegrid-sec-edgar

SEC EDGAR MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sec-edgar)

SEC filings, company submissions, and full-text search via EDGAR.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_filings(query, dateRange)` | Full-text search of SEC filings | 1¢ |
| `get_submissions(cik)` | Company filing submissions by CIK | 1¢ |
| `get_company_facts(cik)` | XBRL facts for a company | 1¢ |

## Parameters

### search_filings
- `query` (string, required) — Search query
- `dateRange` (string) — Date range (e.g. "2024-01-01,2024-12-31")

### get_submissions
- `cik` (string, required) — SEC CIK number (e.g. "0000320193" for Apple)

### get_company_facts
- `cik` (string, required) — SEC CIK number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC EDGAR API — it is completely free.

## Upstream API

- **Provider**: SEC EDGAR
- **Base URL**: https://efts.sec.gov/LATEST
- **Auth**: None required
- **Docs**: https://efts.sec.gov/LATEST/search-index?q=%22API%22

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
