# settlegrid-openrouteservice

OpenRouteService MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openrouteservice)

Directions, isochrones, and geocoding using OpenStreetMap data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ORS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_directions(profile, start, end)` | Get driving/walking/cycling directions | 2¢ |
| `geocode(text)` | Geocode an address | 1¢ |

## Parameters

### get_directions
- `profile` (string, required) — Profile: driving-car, foot-walking, cycling-regular
- `start` (string, required) — Start coordinates as lon,lat
- `end` (string, required) — End coordinates as lon,lat

### geocode
- `text` (string, required) — Address to geocode

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ORS_API_KEY` | Yes | OpenRouteService API key from [https://openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup) |

## Upstream API

- **Provider**: OpenRouteService
- **Base URL**: https://api.openrouteservice.org
- **Auth**: API key (header)
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
