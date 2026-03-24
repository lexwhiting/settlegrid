# settlegrid-gtfs

TransitFeeds GTFS MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gtfs)

GTFS transit feed listings and metadata from TransitFeeds.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TRANSITFEEDS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_feeds(location)` | Get a list of GTFS feeds | 2¢ |
| `get_locations()` | Get transit feed locations | 2¢ |

## Parameters

### get_feeds
- `location` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TRANSITFEEDS_API_KEY` | Yes | Free key from transitfeeds.com |


## Upstream API

- **Provider**: TransitFeeds
- **Base URL**: https://api.transitfeeds.com/v1
- **Auth**: Free API key required
- **Rate Limits**: 1000 req/day
- **Docs**: https://transitfeeds.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-gtfs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TRANSITFEEDS_API_KEY=xxx -p 3000:3000 settlegrid-gtfs
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
