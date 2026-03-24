# settlegrid-opensky

OpenSky Network MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-opensky)

Live flight tracking and aircraft state vectors from the OpenSky Network.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_states()` | Get current state vectors for all aircraft | 1¢ |
| `get_flights_by_aircraft(icao24)` | Get flights for a specific aircraft by ICAO24 address | 1¢ |
| `get_track(icao24)` | Get waypoints for a specific flight | 1¢ |

## Parameters

### get_flights_by_aircraft
- `icao24` (string, required)

### get_track
- `icao24` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: OpenSky Network
- **Base URL**: https://opensky-network.org/api
- **Auth**: None required
- **Rate Limits**: 100 req/day unauthenticated
- **Docs**: https://openskynetwork.github.io/opensky-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-opensky .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-opensky
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
