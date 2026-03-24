# settlegrid-uk-transport

UK Transport Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-transport)

Get UK train departures, station searches, and bus times via TransportAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_departures(station_code)` | Get train departures | 2¢ |
| `search_stations(query)` | Search train stations | 2¢ |
| `get_bus_times(atcocode)` | Get bus departure times | 2¢ |

## Parameters

### get_departures
- `station_code` (string, required) — Station CRS code (e.g. PAD)

### search_stations
- `query` (string, required) — Station name search

### get_bus_times
- `atcocode` (string, required) — Bus stop ATCO code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TRANSPORT_API_KEY` | Yes | TransportAPI API key from [https://developer.transportapi.com/](https://developer.transportapi.com/) |

## Upstream API

- **Provider**: TransportAPI
- **Base URL**: https://transportapi.com/v3
- **Auth**: API key required
- **Docs**: https://developer.transportapi.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-transport .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uk-transport
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
