# settlegrid-flood-data

Flood Monitoring MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-flood-data)

Global flood monitoring data via Open-Meteo Flood API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flood_forecast(lat, lon)` | Get river flood forecast | 1¢ |

## Parameters

### get_flood_forecast
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Flood API — it is completely free.

## Upstream API

- **Provider**: Open-Meteo Flood
- **Base URL**: https://flood-api.open-meteo.com/v1/flood
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/flood-api

## Deploy

### Docker

```bash
docker build -t settlegrid-flood-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-flood-data
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
