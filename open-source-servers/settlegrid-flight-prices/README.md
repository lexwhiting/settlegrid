# settlegrid-flight-prices

Flight Prices MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-flight-prices)

Flight pricing, routes, and real-time status data.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_flights(dep_iata, arr_iata)` | Search flights between airports | 2¢ |
| `get_flight_status(flight_iata)` | Get flight status | 1¢ |
| `get_routes(airline_iata)` | Get airline routes | 1¢ |

## Parameters

### search_flights
- `dep_iata` (string, required) — Departure airport IATA code
- `arr_iata` (string, required) — Arrival airport IATA code
### get_flight_status
- `flight_iata` (string, required) — Flight IATA code (e.g. AA100)
### get_routes
- `airline_iata` (string, required) — Airline IATA code (e.g. AA, BA)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AVIATIONSTACK_API_KEY` | Yes | Free key from aviationstack.com |

## Upstream API

- **Provider**: AviationStack
- **Base URL**: https://api.aviationstack.com/v1
- **Auth**: Free API key
- **Docs**: https://aviationstack.com/documentation

## Deploy

### Docker
```bash
docker build -t settlegrid-flight-prices .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-flight-prices
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
