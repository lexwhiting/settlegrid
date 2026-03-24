# settlegrid-ipo-calendar

IPO Calendar MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ipo-calendar)

Upcoming and recent IPO listings via Finnhub. Track new stock offerings and pricing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_upcoming(from?, to?)` | Get upcoming IPOs | 2¢ |
| `get_recent(limit?)` | Get recent IPOs | 2¢ |
| `search_ipos(query?)` | Search IPO filings | 2¢ |

## Parameters

### get_upcoming
- `from` (string) — Start date YYYY-MM-DD
- `to` (string) — End date YYYY-MM-DD

### get_recent
- `limit` (number) — Number of results (default: 10)

### search_ipos
- `query` (string) — Search term for company name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FINNHUB_API_KEY` | Yes | Finnhub API key from [https://finnhub.io/register](https://finnhub.io/register) |

## Upstream API

- **Provider**: Finnhub
- **Base URL**: https://finnhub.io/api/v1
- **Auth**: API key required
- **Docs**: https://finnhub.io/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-ipo-calendar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ipo-calendar
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
