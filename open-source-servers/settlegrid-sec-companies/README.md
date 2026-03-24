# settlegrid-sec-companies

SEC Company Filings MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sec-companies)

Search SEC EDGAR for company filings, CIK lookups, and filing data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_companies(query)` | Search SEC EDGAR for companies | 1¢ |
| `get_filings(cik, form_type)` | Get recent filings for a company by CIK | 1¢ |

## Parameters

### search_companies
- `query` (string, required) — Company name or ticker symbol

### get_filings
- `cik` (string, required) — SEC CIK number (e.g. "0000320193" for Apple)
- `form_type` (string, optional) — Filing type filter (e.g. "10-K", "10-Q", "8-K")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: SEC EDGAR
- **Base URL**: https://efts.sec.gov/LATEST
- **Auth**: None required
- **Rate Limits**: 10 requests/second
- **Docs**: https://www.sec.gov/search

## Deploy

### Docker

```bash
docker build -t settlegrid-sec-companies .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sec-companies
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
