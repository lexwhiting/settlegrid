# settlegrid-airport-data

Airport Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-airport-data)

Airport information, IATA/ICAO codes, and locations from AirportDB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_airport(icao)` | Get airport by ICAO code | 1¢ |
| `search_airports(query)` | Search airports by name or city | 1¢ |

## Parameters

### get_airport
- `icao` (string, required) — ICAO airport code (e.g. KJFK)

### search_airports
- `query` (string, required) — Airport name, city, or code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream AirportDB API — it is completely free.

## Upstream API

- **Provider**: AirportDB
- **Base URL**: https://airportdb.io/api/v1
- **Auth**: None required
- **Docs**: https://airportdb.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-airport-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-airport-data
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
