# settlegrid-historical-events

Historical Event Timeline MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-historical-events)

Access historical events via Wikimedia On This Day API. Get events, births, and deaths by date.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_events(month, day, type?)` | Get historical events on a date | 1¢ |
| `get_births(month, day)` | Get notable births on a date | 1¢ |
| `get_deaths(month, day)` | Get notable deaths on a date | 1¢ |

## Parameters

### get_events
- `month` (number, required) — Month (1-12)
- `day` (number, required) — Day (1-31)
- `type` (string) — Event type: selected, events, holidays (default: selected)

### get_births
- `month` (number, required) — Month (1-12)
- `day` (number, required) — Day (1-31)

### get_deaths
- `month` (number, required) — Month (1-12)
- `day` (number, required) — Day (1-31)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Wikimedia On This Day API — it is completely free.

## Upstream API

- **Provider**: Wikimedia On This Day
- **Base URL**: https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday
- **Auth**: None required
- **Docs**: https://api.wikimedia.org/wiki/Feed_API

## Deploy

### Docker

```bash
docker build -t settlegrid-historical-events .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-historical-events
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
