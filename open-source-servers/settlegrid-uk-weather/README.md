# settlegrid-uk-weather

UK Met Office Weather MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-weather)

Get UK weather forecasts, observations and warnings from the Met Office DataHub.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_forecast(lat, lon)` | Get weather forecast | 2¢ |
| `get_observations(lat, lon)` | Get weather observations | 2¢ |
| `get_warnings()` | Get weather warnings | 2¢ |

## Parameters

### get_forecast
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

### get_observations
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

### get_warnings

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MET_OFFICE_API_KEY` | Yes | Met Office DataHub API key from [https://datahub.metoffice.gov.uk/](https://datahub.metoffice.gov.uk/) |

## Upstream API

- **Provider**: Met Office DataHub
- **Base URL**: https://data.hub.api.metoffice.gov.uk
- **Auth**: API key required
- **Docs**: https://datahub.metoffice.gov.uk/

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-weather .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uk-weather
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
