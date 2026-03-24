# settlegrid-insider-trading

SEC Insider Trading MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-insider-trading)

SEC insider trading filings from EDGAR. Track Form 4 filings, insider buys and sells.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_filings(symbol, limit?)` | Get insider filings for a company | 1¢ |
| `get_recent(limit?)` | Get most recent insider filings | 1¢ |
| `search_insiders(name)` | Search insider filings by name | 1¢ |

## Parameters

### get_filings
- `symbol` (string, required) — Stock ticker symbol
- `limit` (number) — Number of filings (default: 10)

### get_recent
- `limit` (number) — Number of results (default: 20)

### search_insiders
- `name` (string, required) — Insider name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC EDGAR API — it is completely free.

## Upstream API

- **Provider**: SEC EDGAR
- **Base URL**: https://efts.sec.gov/LATEST
- **Auth**: None required
- **Docs**: https://www.sec.gov/search#/dateRange=custom

## Deploy

### Docker

```bash
docker build -t settlegrid-insider-trading .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-insider-trading
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
