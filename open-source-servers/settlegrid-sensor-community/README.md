# settlegrid-sensor-community

Sensor.Community Air Quality MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sensor-community)

Access citizen-operated air quality sensor data from the Sensor.Community network. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_readings(sensor_id)` | Get latest sensor readings | 1¢ |
| `get_area(lat, lon, radius?)` | Get sensors in a geographic area | 2¢ |
| `get_averages(sensor_id)` | Get 24h average readings | 1¢ |

## Parameters

### get_readings
- `sensor_id` (number, required) — Sensor ID number

### get_area
- `lat` (number, required) — Latitude of center point
- `lon` (number, required) — Longitude of center point
- `radius` (number) — Radius in km (default: 10)

### get_averages
- `sensor_id` (number, required) — Sensor ID number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Sensor.Community API — it is completely free.

## Upstream API

- **Provider**: Sensor.Community
- **Base URL**: https://data.sensor.community/airrohr/v1
- **Auth**: None required
- **Docs**: https://github.com/opendata-stuttgart/meta/wiki/APIs

## Deploy

### Docker

```bash
docker build -t settlegrid-sensor-community .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sensor-community
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
