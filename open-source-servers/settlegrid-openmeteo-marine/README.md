# settlegrid-openmeteo-marine

Open-Meteo Marine MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openmeteo-marine)

Marine weather forecast with wave heights, periods, and ocean data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_marine(latitude, longitude)` | Get marine weather forecast | 1¢ |

## Parameters

### get_marine
- `latitude` (number, required) — Latitude
- `longitude` (number, required) — Longitude
- `hourly` (string, optional) — Hourly vars: wave_height,wave_period,wave_direction

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Marine API.

## Upstream API

- **Provider**: Open-Meteo Marine
- **Base URL**: https://marine-api.open-meteo.com/v1
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/marine-weather-api

## Deploy

### Docker

```bash
docker build -t settlegrid-openmeteo-marine .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openmeteo-marine
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
