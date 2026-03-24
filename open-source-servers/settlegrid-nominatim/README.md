# settlegrid-nominatim

OpenStreetMap Nominatim MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nominatim)

Geocoding and reverse geocoding using OpenStreetMap data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(q)` | Geocode an address or place name | 1¢ |
| `reverse(lat, lon)` | Reverse geocode coordinates to address | 1¢ |

## Parameters

### search
- `q` (string, required) — Address or place name
- `limit` (number, optional) — Max results (default: 5)

### reverse
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenStreetMap Nominatim API.

## Upstream API

- **Provider**: OpenStreetMap Nominatim
- **Base URL**: https://nominatim.openstreetmap.org
- **Auth**: None required
- **Docs**: https://nominatim.org/release-docs/latest/api/Overview/

## Deploy

### Docker

```bash
docker build -t settlegrid-nominatim .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nominatim
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
