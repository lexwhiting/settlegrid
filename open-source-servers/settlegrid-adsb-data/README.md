# settlegrid-adsb-data

Aircraft ADS-B Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-adsb-data)

Access real-time aircraft tracking data via the OpenSky Network. No API key needed for basic access.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_states(lat?, lon?, radius?)` | Get aircraft state vectors | 2¢ |
| `get_flights(icao24, begin?, end?)` | Get flight history for aircraft | 2¢ |
| `get_track(icao24)` | Get aircraft track waypoints | 2¢ |

## Parameters

### get_states
- `lat` (number) — Center latitude for bounding box
- `lon` (number) — Center longitude for bounding box
- `radius` (number) — Radius in degrees (default: 1)

### get_flights
- `icao24` (string, required) — ICAO24 transponder address (hex)
- `begin` (number) — Start time as Unix timestamp
- `end` (number) — End time as Unix timestamp

### get_track
- `icao24` (string, required) — ICAO24 transponder address (hex)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenSky Network API — it is completely free.

## Upstream API

- **Provider**: OpenSky Network
- **Base URL**: https://opensky-network.org/api
- **Auth**: None required
- **Docs**: https://openskynetwork.github.io/opensky-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-adsb-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-adsb-data
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
