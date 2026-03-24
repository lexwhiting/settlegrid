# settlegrid-windy

Windy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-windy)

Point weather forecast with multiple global weather models

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_point_forecast(lat, lon, key)` | Get point forecast from GFS/ECMWF models | 2¢ |

## Parameters

### get_point_forecast
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `model` (string, optional) — Model: gfs, ecmwf, iconEu (default: "gfs")
- `key` (string, required) — Windy API key

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Windy API.

## Upstream API

- **Provider**: Windy
- **Base URL**: https://api.windy.com/api/point-forecast/v2
- **Auth**: None required
- **Docs**: https://api.windy.com/point-forecast/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-windy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-windy
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
