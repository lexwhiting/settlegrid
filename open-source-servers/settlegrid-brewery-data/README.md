# settlegrid-brewery-data

Brewery Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-brewery-data)

Brewery information and search from Open Brewery DB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_breweries(query, limit?)` | Search breweries by name | 1¢ |
| `get_brewery(id)` | Get brewery by ID | 1¢ |
| `breweries_by_city(city, limit?)` | List breweries in a city | 1¢ |

## Parameters

### search_breweries
- `query` (string, required) — Search term
- `limit` (number) — Max results (default 20)

### get_brewery
- `id` (string, required) — Brewery ID

### breweries_by_city
- `city` (string, required) — City name
- `limit` (number) — Max results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open Brewery DB API — it is completely free.

## Upstream API

- **Provider**: Open Brewery DB
- **Base URL**: https://api.openbrewerydb.org/v1
- **Auth**: None required
- **Docs**: https://www.openbrewerydb.org/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-brewery-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-brewery-data
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
