# settlegrid-sec-filings

SEC Company Filings MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sec-filings)

SEC EDGAR company filings and financial disclosures.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_sec_filings(query, form_type?)` | Search SEC filings | 1¢ |

## Parameters

### search_sec_filings
- `query` (string, required) — Company name or ticker
- `form_type` (string) — Form type (10-K, 10-Q, 8-K, etc.)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC EDGAR API — it is completely free.

## Upstream API

- **Provider**: SEC EDGAR
- **Base URL**: https://efts.sec.gov/LATEST/search-index?q=
- **Auth**: None required
- **Docs**: https://efts.sec.gov/LATEST/search-index?q=&dateRange=custom

## Deploy

### Docker

```bash
docker build -t settlegrid-sec-filings .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sec-filings
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
