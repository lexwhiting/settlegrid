# settlegrid-breezometer

BreezoMeter Air Quality MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-breezometer)

Real-time air quality index, pollutants, and pollen data by location.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BREEZOMETER_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_air_quality(lat, lng)` | Get current air quality index and pollutants for a location | 2¢ |
| `get_pollen(lat, lng)` | Get pollen count and forecast for a location | 2¢ |

## Parameters

### get_air_quality
- `lat` (number, required)
- `lng` (number, required)

### get_pollen
- `lat` (number, required)
- `lng` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BREEZOMETER_API_KEY` | Yes | Free key from breezometer.com/products/air-quality-api |


## Upstream API

- **Provider**: BreezoMeter
- **Base URL**: https://api.breezometer.com
- **Auth**: Free API key required
- **Rate Limits**: 1000 calls/day (free)
- **Docs**: https://docs.breezometer.com/api-documentation/air-quality-api/v2/

## Deploy

### Docker

```bash
docker build -t settlegrid-breezometer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BREEZOMETER_API_KEY=xxx -p 3000:3000 settlegrid-breezometer
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
