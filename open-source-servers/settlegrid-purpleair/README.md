# settlegrid-purpleair

PurpleAir Sensors MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-purpleair)

Access PurpleAir air quality sensor network data with real-time PM2.5, temperature, and humidity. Free API key required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_sensor(sensor_index)` | Get a single sensor by index | 1¢ |
| `get_sensors(lat, lon, radius?)` | Get sensors near a location | 2¢ |
| `get_history(sensor_index, days?)` | Get sensor history data | 2¢ |

## Parameters

### get_sensor
- `sensor_index` (number, required) — PurpleAir sensor index number

### get_sensors
- `lat` (number, required) — Latitude of center point
- `lon` (number, required) — Longitude of center point
- `radius` (number) — Search radius in km (default: 5, max: 50)

### get_history
- `sensor_index` (number, required) — PurpleAir sensor index number
- `days` (number) — Number of days of history (default: 1, max: 14)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PURPLEAIR_API_KEY` | Yes | PurpleAir API key from [https://develop.purpleair.com](https://develop.purpleair.com) |

## Upstream API

- **Provider**: PurpleAir
- **Base URL**: https://api.purpleair.com/v1
- **Auth**: API key required
- **Docs**: https://api.purpleair.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-purpleair .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-purpleair
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
