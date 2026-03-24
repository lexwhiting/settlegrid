# settlegrid-open-meteo

Open-Meteo MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-meteo)

Free weather API with hourly and daily forecasts, no API key required

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_forecast(latitude, longitude)` | Get weather forecast by coordinates | 1¢ |
| `get_historical(latitude, longitude, start_date, end_date)` | Get historical weather data | 2¢ |

## Parameters

### get_forecast
- `latitude` (number, required) — Latitude
- `longitude` (number, required) — Longitude
- `daily` (string, optional) — Daily vars: temperature_2m_max,precipitation_sum

### get_historical
- `latitude` (number, required) — Latitude
- `longitude` (number, required) — Longitude
- `start_date` (string, required) — Start date YYYY-MM-DD
- `end_date` (string, required) — End date YYYY-MM-DD

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo API.

## Upstream API

- **Provider**: Open-Meteo
- **Base URL**: https://api.open-meteo.com/v1
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-open-meteo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-meteo
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
