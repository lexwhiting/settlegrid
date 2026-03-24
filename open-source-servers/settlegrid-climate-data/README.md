# settlegrid-climate-data

Historical Climate Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-climate-data)

Historical weather and climate data from Open-Meteo archive.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_historical_weather(lat, lng, start_date, end_date)` | Get historical daily weather for a location and date range | 1¢ |
| `get_climate_normals(lat, lng)` | Get climate normals (monthly averages) for a location | 1¢ |

## Parameters

### get_historical_weather
- `lat` (number, required)
- `lng` (number, required)
- `start_date` (string, required)
- `end_date` (string, required)

### get_climate_normals
- `lat` (number, required)
- `lng` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Open-Meteo
- **Base URL**: https://archive-api.open-meteo.com
- **Auth**: None required
- **Rate Limits**: 10,000 calls/day (free, no key)
- **Docs**: https://open-meteo.com/en/docs/historical-weather-api

## Deploy

### Docker

```bash
docker build -t settlegrid-climate-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-climate-data
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
