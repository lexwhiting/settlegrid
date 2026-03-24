# settlegrid-nigeria-weather

Nigeria Weather MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nigeria-weather)

Nigeria weather forecasts via Open-Meteo. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_nigeria_weather(lat, lon, days?)` | Weather for Nigeria coordinates | 1¢ |
| `get_nigeria_weather_city(city)` | Weather for major Nigeria cities | 1¢ |

## Parameters

### get_nigeria_weather
- `lat` (number, required) — Latitude (4-14)
- `lon` (number, required) — Longitude (3-15)
- `days` (number) — Forecast days (1-16, default 7)

### get_nigeria_weather_city
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
docker build -t settlegrid-nigeria-weather .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nigeria-weather
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
