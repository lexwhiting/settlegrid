# settlegrid-traffic

TomTom Traffic MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-traffic)

Real-time traffic flow and incidents from TomTom.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TOMTOM_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flow(latitude, longitude)` | Get traffic flow data for a road segment | 2¢ |
| `get_incidents(minLat, minLon, maxLat, maxLon)` | Get traffic incidents in a bounding box | 2¢ |

## Parameters

### get_flow
- `latitude` (number, required)
- `longitude` (number, required)

### get_incidents
- `minLat` (number, required)
- `minLon` (number, required)
- `maxLat` (number, required)
- `maxLon` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TOMTOM_API_KEY` | Yes | Free key from developer.tomtom.com |


## Upstream API

- **Provider**: TomTom
- **Base URL**: https://api.tomtom.com/traffic
- **Auth**: Free API key required
- **Rate Limits**: 2500 req/day (free)
- **Docs**: https://developer.tomtom.com/traffic-api/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-traffic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TOMTOM_API_KEY=xxx -p 3000:3000 settlegrid-traffic
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
