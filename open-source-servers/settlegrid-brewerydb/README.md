# settlegrid-brewerydb

BreweryDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-brewerydb)

Open brewery database with locations, types, and contact information.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_breweries(query)` | Search breweries by name | 1¢ |
| `get_brewery(brewery_id)` | Get brewery details by ID | 1¢ |
| `list_by_city(city)` | List breweries in a specific city | 1¢ |

## Parameters

### search_breweries
- `query` (string, required)

### get_brewery
- `brewery_id` (string, required)

### list_by_city
- `city` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Open Brewery DB
- **Base URL**: https://www.openbrewerydb.org
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://www.openbrewerydb.org/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-brewerydb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-brewerydb
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
