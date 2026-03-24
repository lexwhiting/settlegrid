# settlegrid-plant-data

Plant Biology Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-plant-data)

Access plant species data via GBIF (Global Biodiversity Information Facility). Search plants, get species details, and list families.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_plants(query, limit?)` | Search plant species | 1¢ |
| `get_species(id)` | Get species details by key | 1¢ |
| `list_families()` | List plant families | 1¢ |

## Parameters

### search_plants
- `query` (string, required) — Plant name or keyword (e.g. "Rosa", "Quercus alba")
- `limit` (number) — Max results (default 10, max 50)

### get_species
- `id` (string, required) — GBIF species key (numeric ID)

### list_families

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GBIF API API — it is completely free.

## Upstream API

- **Provider**: GBIF API
- **Base URL**: https://api.gbif.org/v1
- **Auth**: None required
- **Docs**: https://www.gbif.org/developer/summary

## Deploy

### Docker

```bash
docker build -t settlegrid-plant-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-plant-data
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
