# settlegrid-weather-balloon

Radiosonde/Weather Balloon Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weather-balloon)

Access radiosonde sounding data via NWS API. Get atmospheric soundings, list stations, and retrieve latest observations.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_soundings(station, date?)` | Get radiosonde soundings for a station | 2¢ |
| `list_stations()` | List radiosonde stations | 1¢ |
| `get_latest(station)` | Get latest observation for a station | 1¢ |

## Parameters

### get_soundings
- `station` (string, required) — Station ID (e.g. OKX, MPX, BUF)
- `date` (string) — Date (YYYY-MM-DD). Defaults to latest.

### list_stations

### get_latest
- `station` (string, required) — Station ID (e.g. OKX)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NWS API (Radiosonde) API — it is completely free.

## Upstream API

- **Provider**: NWS API (Radiosonde)
- **Base URL**: https://api.weather.gov
- **Auth**: None required
- **Docs**: https://www.weather.gov/documentation/services-web-api

## Deploy

### Docker

```bash
docker build -t settlegrid-weather-balloon .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weather-balloon
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
