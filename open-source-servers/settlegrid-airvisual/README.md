# settlegrid-airvisual

IQAir AirVisual MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-airvisual)

Real-time and forecast air quality data for cities worldwide

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + AIRVISUAL_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_city(city, state, country)` | Get air quality for a specific city | 1¢ |
| `get_nearest(lat, lon)` | Get air quality for nearest station by coordinates | 1¢ |

## Parameters

### get_city
- `city` (string, required) — City name
- `state` (string, required) — State name
- `country` (string, required) — Country name

### get_nearest
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AIRVISUAL_API_KEY` | Yes | IQAir AirVisual API key from [https://www.iqair.com/air-pollution-data-api](https://www.iqair.com/air-pollution-data-api) |

## Upstream API

- **Provider**: IQAir AirVisual
- **Base URL**: https://api.airvisual.com/v2
- **Auth**: API key (query)
- **Docs**: https://api-docs.iqair.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-airvisual .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e AIRVISUAL_API_KEY=xxx -p 3000:3000 settlegrid-airvisual
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
