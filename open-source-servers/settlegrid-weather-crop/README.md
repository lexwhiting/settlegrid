# settlegrid-weather-crop

Weather Impact on Crops MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weather-crop)

Analyze weather conditions and their impact on crop growth using NWS data. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_conditions(state, crop?)` | Get weather conditions for state/crop | 2¢ |
| `get_drought_impact(state)` | Get drought impact assessment | 2¢ |
| `get_forecast_impact(lat, lon)` | Get forecast impact on agriculture | 2¢ |

## Parameters

### get_conditions
- `state` (string, required) — US state abbreviation (e.g. IA, IL, KS)
- `crop` (string) — Crop type to assess impact for (e.g. Corn, Wheat)

### get_drought_impact
- `state` (string, required) — US state abbreviation

### get_forecast_impact
- `lat` (number, required) — Latitude (decimal degrees)
- `lon` (number, required) — Longitude (decimal degrees)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NWS Weather API API — it is completely free.

## Upstream API

- **Provider**: NWS Weather API
- **Base URL**: https://api.weather.gov
- **Auth**: None required
- **Docs**: https://www.weather.gov/documentation/services-web-api

## Deploy

### Docker

```bash
docker build -t settlegrid-weather-crop .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weather-crop
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
