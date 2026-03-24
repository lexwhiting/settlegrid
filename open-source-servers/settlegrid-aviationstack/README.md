# settlegrid-aviationstack

Aviationstack MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-aviationstack)

Real-time and historical flight data from the Aviationstack API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + AVIATIONSTACK_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_flights(airline_iata, dep_iata)` | Search real-time flights by airline or route | 2¢ |
| `get_airports(search)` | Search airports by name or IATA code | 2¢ |
| `get_airlines(search)` | Search airlines by name | 2¢ |

## Parameters

### search_flights
- `airline_iata` (string, optional)
- `dep_iata` (string, optional)

### get_airports
- `search` (string, required)

### get_airlines
- `search` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AVIATIONSTACK_API_KEY` | Yes | Free key from aviationstack.com |


## Upstream API

- **Provider**: Aviationstack
- **Base URL**: https://api.aviationstack.com/v1
- **Auth**: Free API key required
- **Rate Limits**: 100 req/month (free)
- **Docs**: https://aviationstack.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-aviationstack .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e AVIATIONSTACK_API_KEY=xxx -p 3000:3000 settlegrid-aviationstack
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
