# settlegrid-usda-nass

USDA NASS Crop Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usda-nass)

Access USDA National Agricultural Statistics Service QuickStats data for crop production, acreage, yield, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_stats(commodity, year?, state?)` | Get crop statistics by commodity | 2¢ |
| `list_commodities()` | List available commodities | 1¢ |
| `search_data(query)` | Search NASS data with free-text query | 2¢ |

## Parameters

### get_stats
- `commodity` (string, required) — Commodity name (e.g. CORN, WHEAT, SOYBEANS)
- `year` (number) — Year to filter (e.g. 2023)
- `state` (string) — US state name or abbreviation

### list_commodities

### search_data
- `query` (string, required) — Free-text search term for data lookup

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASS_API_KEY` | Yes | USDA NASS QuickStats API key from [https://quickstats.nass.usda.gov/api](https://quickstats.nass.usda.gov/api) |

## Upstream API

- **Provider**: USDA NASS QuickStats
- **Base URL**: https://quickstats.nass.usda.gov/api
- **Auth**: API key required
- **Docs**: https://quickstats.nass.usda.gov/api

## Deploy

### Docker

```bash
docker build -t settlegrid-usda-nass .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usda-nass
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
