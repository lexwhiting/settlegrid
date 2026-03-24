# settlegrid-elevation-api

Elevation Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-elevation-api)

Get elevation data for any coordinates via Open-Meteo Elevation API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_elevation(lat, lon)` | Get elevation for coordinates | 1¢ |
| `get_elevation_batch(points)` | Get elevation for multiple points | 2¢ |

## Parameters

### get_elevation
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

### get_elevation_batch
- `points` (array, required) — Array of {lat, lon} objects (max 100)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Elevation API — it is completely free.

## Upstream API

- **Provider**: Open-Meteo Elevation
- **Base URL**: https://api.open-meteo.com/v1/elevation
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/elevation-api

## Deploy

### Docker

```bash
docker build -t settlegrid-elevation-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-elevation-api
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
