# settlegrid-flightaware

FlightAware AeroAPI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-flightaware)

Flight tracking, status, and airport data from FlightAware AeroAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FLIGHTAWARE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flight(flight_id)` | Get flight information by flight ID | 2¢ |
| `get_airport_flights(airport_code)` | Get flights at an airport | 2¢ |

## Parameters

### get_flight
- `flight_id` (string, required)

### get_airport_flights
- `airport_code` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FLIGHTAWARE_API_KEY` | Yes | AeroAPI key from flightaware.com/aeroapi |


## Upstream API

- **Provider**: FlightAware
- **Base URL**: https://aeroapi.flightaware.com/aeroapi
- **Auth**: Free API key required
- **Rate Limits**: Tier-based
- **Docs**: https://flightaware.com/aeroapi/portal/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-flightaware .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FLIGHTAWARE_API_KEY=xxx -p 3000:3000 settlegrid-flightaware
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
