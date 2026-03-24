# settlegrid-earnings-calendar

Earnings Calendar MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-earnings-calendar)

Earnings dates, reports, and surprise data via Finnhub. Track quarterly earnings announcements.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_upcoming(from?, to?)` | Get upcoming earnings dates | 2¢ |
| `get_earnings(symbol)` | Get earnings history for symbol | 2¢ |
| `get_surprises(symbol)` | Get earnings surprises | 2¢ |

## Parameters

### get_upcoming
- `from` (string) — Start date YYYY-MM-DD
- `to` (string) — End date YYYY-MM-DD

### get_earnings
- `symbol` (string, required) — Stock ticker symbol

### get_surprises
- `symbol` (string, required) — Stock ticker symbol

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
docker build -t settlegrid-earnings-calendar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-earnings-calendar
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
