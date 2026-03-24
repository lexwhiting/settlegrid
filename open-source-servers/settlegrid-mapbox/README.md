# settlegrid-mapbox

Mapbox MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mapbox)

Geocoding, directions, and static maps from Mapbox

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + MAPBOX_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode(query)` | Forward geocode an address | 1¢ |
| `get_directions(coordinates)` | Get driving directions between points | 2¢ |

## Parameters

### geocode
- `query` (string, required) — Address or place name
- `limit` (number, optional) — Max results (default: 5)

### get_directions
- `coordinates` (string, required) — Semicolon-separated lon,lat pairs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MAPBOX_TOKEN` | Yes | Mapbox API key from [https://account.mapbox.com/](https://account.mapbox.com/) |

## Upstream API

- **Provider**: Mapbox
- **Base URL**: https://api.mapbox.com
- **Auth**: API key (query)
- **Docs**: https://docs.mapbox.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-mapbox .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e MAPBOX_TOKEN=xxx -p 3000:3000 settlegrid-mapbox
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
