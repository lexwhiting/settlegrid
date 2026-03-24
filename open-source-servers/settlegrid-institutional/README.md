# settlegrid-institutional

13F Institutional Holdings MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-institutional)

Institutional 13F holdings data from SEC EDGAR. Track hedge fund and institutional investor positions.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_holdings(cik, limit?)` | Get 13F holdings by CIK | 1¢ |
| `search_institutions(query)` | Search institutional filers | 1¢ |
| `get_filing(accession)` | Get specific 13F filing details | 1¢ |

## Parameters

### get_holdings
- `cik` (string, required) — SEC CIK number of the institution
- `limit` (number) — Number of filings (default: 5)

### search_institutions
- `query` (string, required) — Institution name to search

### get_filing
- `accession` (string, required) — SEC accession number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC EDGAR API — it is completely free.

## Upstream API

- **Provider**: SEC EDGAR
- **Base URL**: https://efts.sec.gov/LATEST
- **Auth**: None required
- **Docs**: https://www.sec.gov/cgi-bin/browse-edgar

## Deploy

### Docker

```bash
docker build -t settlegrid-institutional .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-institutional
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
