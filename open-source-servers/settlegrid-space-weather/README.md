# settlegrid-space-weather

Space Weather Alerts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-space-weather)

Access space weather alerts and data via NOAA SWPC. Get alerts, solar wind data, and geomagnetic forecasts.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_alerts()` | Get active space weather alerts | 1¢ |
| `get_solar_wind()` | Get real-time solar wind data | 1¢ |
| `get_geomag_forecast()` | Get geomagnetic activity forecast | 2¢ |

## Parameters

### get_alerts

### get_solar_wind

### get_geomag_forecast

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NOAA SWPC API — it is completely free.

## Upstream API

- **Provider**: NOAA SWPC
- **Base URL**: https://services.swpc.noaa.gov
- **Auth**: None required
- **Docs**: https://www.swpc.noaa.gov/products-and-data

## Deploy

### Docker

```bash
docker build -t settlegrid-space-weather .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-space-weather
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
