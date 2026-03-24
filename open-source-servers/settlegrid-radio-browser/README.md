# settlegrid-radio-browser

Internet Radio Browser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-radio-browser)

Search and discover internet radio stations worldwide via the Radio Browser API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_stations(query, limit?)` | Search radio stations | 1¢ |
| `get_top(limit?, country?)` | Get top-voted stations | 1¢ |
| `list_countries()` | List countries with station counts | 1¢ |

## Parameters

### search_stations
- `query` (string, required) — Search term for station name, tag, or country
- `limit` (number) — Max results to return (default: 20, max: 100)

### get_top
- `limit` (number) — Number of top stations (default: 20)
- `country` (string) — Filter by country name

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Radio Browser API — it is completely free.

## Upstream API

- **Provider**: Radio Browser
- **Base URL**: https://de1.api.radio-browser.info
- **Auth**: None required
- **Docs**: https://de1.api.radio-browser.info/

## Deploy

### Docker

```bash
docker build -t settlegrid-radio-browser .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-radio-browser
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
