# settlegrid-wave-data

Ocean Wave Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wave-data)

Access ocean buoy and wave data via NOAA NDBC. Get real-time observations, list stations, and retrieve latest readings.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_observations(station)` | Get buoy observations | 1¢ |
| `list_stations()` | List active NDBC stations | 1¢ |
| `get_latest(station)` | Get latest observation for a station | 1¢ |

## Parameters

### get_observations
- `station` (string, required) — NDBC station ID (e.g. 44013, 46025)

### list_stations

### get_latest
- `station` (string, required) — NDBC station ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NOAA NDBC API — it is completely free.

## Upstream API

- **Provider**: NOAA NDBC
- **Base URL**: https://www.ndbc.noaa.gov/data/realtime2
- **Auth**: None required
- **Docs**: https://www.ndbc.noaa.gov/docs/ndbc_web_data_guide.pdf

## Deploy

### Docker

```bash
docker build -t settlegrid-wave-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-wave-data
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
