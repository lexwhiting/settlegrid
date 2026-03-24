# settlegrid-bird-data

eBird Observation Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bird-data)

Access eBird bird observation data. Get recent sightings, birding hotspots, and species lists by region.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_recent(lat, lon, limit?)` | Get recent bird observations near location | 1¢ |
| `get_hotspots(regionCode)` | Get birding hotspots in a region | 1¢ |
| `get_species_list(regionCode)` | Get species list for a region | 2¢ |

## Parameters

### get_recent
- `lat` (number, required) — Latitude (e.g. 42.36)
- `lon` (number, required) — Longitude (e.g. -71.06)
- `limit` (number) — Max results (default 20, max 100)

### get_hotspots
- `regionCode` (string, required) — eBird region code (e.g. US-MA, US-CA)

### get_species_list
- `regionCode` (string, required) — eBird region code (e.g. US-NY)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EBIRD_API_KEY` | Yes | eBird API 2.0 API key from [https://ebird.org/api/keygen](https://ebird.org/api/keygen) |

## Upstream API

- **Provider**: eBird API 2.0
- **Base URL**: https://api.ebird.org/v2
- **Auth**: API key required
- **Docs**: https://documenter.getpostman.com/view/664302/S1ENwy59

## Deploy

### Docker

```bash
docker build -t settlegrid-bird-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bird-data
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
