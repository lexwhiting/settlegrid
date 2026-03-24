# settlegrid-transit-land

Transitland MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-transit-land)

Public transit data — routes, stops, and operators worldwide.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_operators(name)` | Search transit operators by name | 1¢ |
| `search_stops(name)` | Search transit stops by name | 1¢ |
| `search_routes(name)` | Search transit routes by name or operator | 1¢ |

## Parameters

### search_operators
- `name` (string, required)

### search_stops
- `name` (string, required)

### search_routes
- `name` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Transitland
- **Base URL**: https://transit.land/api/v2
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.transit.land/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-transit-land .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-transit-land
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
