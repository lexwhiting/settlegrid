# settlegrid-turkey-weather

Turkey Weather MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-turkey-weather)

Turkey weather forecasts via Open-Meteo. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_turkey_weather(lat, lon, days?)` | Weather for Turkey coordinates | 1¢ |
| `get_turkey_weather_city(city)` | Weather for major Turkey cities | 1¢ |

## Parameters

### get_turkey_weather
- `lat` (number, required) — Latitude (36-42)
- `lon` (number, required) — Longitude (26-45)
- `days` (number) — Forecast days (1-16, default 7)

### get_turkey_weather_city
- `city` (string, required) — City name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo API.

## Upstream API

- **Provider**: Open-Meteo
- **Base URL**: https://api.open-meteo.com/v1/forecast
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-turkey-weather .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-turkey-weather
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
