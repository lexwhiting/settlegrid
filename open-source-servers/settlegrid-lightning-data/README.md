# settlegrid-lightning-data

Lightning & Severe Weather MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lightning-data)

Access severe weather alerts and lightning-related data via NWS API. Get active alerts, search by state, and check density.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_strikes(lat, lon, radius?)` | Get active severe thunderstorm alerts near location | 2¢ |
| `get_alerts(state)` | Get active weather alerts by state | 1¢ |
| `get_density(region)` | Get alert count by region | 1¢ |

## Parameters

### get_strikes
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `radius` (number) — Search radius in km (default 50)

### get_alerts
- `state` (string, required) — Two-letter state code (e.g. TX, FL)

### get_density
- `region` (string, required) — Region or state code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NWS Alerts API API — it is completely free.

## Upstream API

- **Provider**: NWS Alerts API
- **Base URL**: https://api.weather.gov
- **Auth**: None required
- **Docs**: https://www.weather.gov/documentation/services-web-api

## Deploy

### Docker

```bash
docker build -t settlegrid-lightning-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lightning-data
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
