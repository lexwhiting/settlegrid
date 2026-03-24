# settlegrid-open-meteo-air

Open-Meteo Air Quality MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-meteo-air)

Free air quality forecast API with PM2.5, PM10, ozone, and pollen data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_air_quality(latitude, longitude)` | Get air quality forecast by coordinates | 1¢ |

## Parameters

### get_air_quality
- `latitude` (number, required) — Latitude
- `longitude` (number, required) — Longitude
- `hourly` (string, optional) — Hourly vars: pm10,pm2_5,european_aqi

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Air Quality API.

## Upstream API

- **Provider**: Open-Meteo Air Quality
- **Base URL**: https://air-quality-api.open-meteo.com/v1
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/air-quality-api

## Deploy

### Docker

```bash
docker build -t settlegrid-open-meteo-air .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-meteo-air
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
