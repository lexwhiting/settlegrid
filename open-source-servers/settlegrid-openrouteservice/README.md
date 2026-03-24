# settlegrid-openrouteservice

OpenRouteService MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openrouteservice)

Get driving/walking/cycling directions from OpenRouteService with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ORS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_directions(start_lon, start_lat, end_lon, end_lat, profile)` | Get route between two points | 2¢ |
| `geocode_search(query)` | Search for places by name | 2¢ |

## Parameters

### get_directions
- `start_lon` (number, required) — Start longitude
- `start_lat` (number, required) — Start latitude
- `end_lon` (number, required) — End longitude
- `end_lat` (number, required) — End latitude
- `profile` (string, optional) — driving-car, cycling-regular, or foot-walking (default driving-car)

### geocode_search
- `query` (string, required) — Place name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ORS_API_KEY` | Yes | OpenRouteService API key |


## Upstream API

- **Provider**: OpenRouteService
- **Base URL**: https://api.openrouteservice.org/v2
- **Auth**: Free API key required
- **Rate Limits**: 40 req/min
- **Docs**: https://openrouteservice.org/dev/#/api-docs

## Deploy

### Docker

```bash
docker build -t settlegrid-openrouteservice .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ORS_API_KEY=xxx -p 3000:3000 settlegrid-openrouteservice
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
