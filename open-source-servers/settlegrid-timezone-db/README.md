# settlegrid-timezone-db

TimezoneDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-timezone-db)

Get timezone data by coordinates or zone name from TimezoneDB with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TIMEZONEDB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_timezone_by_position(lat, lon)` | Get timezone for coordinates | 1¢ |
| `get_timezone_by_zone(zone)` | Get timezone details by zone name | 1¢ |

## Parameters

### get_timezone_by_position
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

### get_timezone_by_zone
- `zone` (string, required) — Timezone name (e.g. "America/New_York")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TIMEZONEDB_API_KEY` | Yes | TimezoneDB API key |


## Upstream API

- **Provider**: TimezoneDB
- **Base URL**: https://api.timezonedb.com/v2.1
- **Auth**: Free API key required
- **Rate Limits**: 1 req/s
- **Docs**: https://timezonedb.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-timezone-db .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TIMEZONEDB_API_KEY=xxx -p 3000:3000 settlegrid-timezone-db
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
