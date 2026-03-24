# settlegrid-weather-gov

NOAA/NWS Weather MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weather-gov)

Get real-time weather forecasts, alerts, and station data for any US location. Wraps the free NOAA/National Weather Service API with zero upstream costs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_forecast(lat, lon)` | 7-day forecast for coordinates | 1¢ |
| `get_alerts(state)` | Active weather alerts by state code | 1¢ |
| `get_stations(lat, lon)` | Nearby observation stations | 1¢ |

## Parameters

### get_forecast
- `lat` (number, required) — Latitude (-90 to 90)
- `lon` (number, required) — Longitude (-180 to 180)

### get_alerts
- `state` (string, required) — 2-letter US state code (e.g. "CA", "TX")

### get_stations
- `lat` (number, required) — Latitude (-90 to 90)
- `lon` (number, required) — Longitude (-180 to 180)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NOAA/NWS API — it is completely free.

## Upstream API

- **Provider**: NOAA / National Weather Service
- **Base URL**: https://api.weather.gov
- **Auth**: None required
- **Rate Limits**: Reasonable use expected; include User-Agent header
- **Docs**: https://www.weather.gov/documentation/services-web-api

## Deploy

### Docker

```bash
docker build -t settlegrid-weather-gov .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weather-gov
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
