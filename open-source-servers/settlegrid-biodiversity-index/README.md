# settlegrid-biodiversity-index

Biodiversity Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-biodiversity-index)

Biodiversity metrics, species counts, and occurrence data from GBIF.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_species_count(country)` | Species count by country | 1¢ |
| `search_species(query)` | Search species | 1¢ |
| `get_occurrence_data(species_key)` | Get occurrence data | 1¢ |

## Parameters

### get_species_count
- `country` (string, required) — ISO alpha-2 code
### search_species
- `query` (string, required) — Species name
- `limit` (number, optional) — Results (default 20, max 50)
### get_occurrence_data
- `species_key` (string, required) — GBIF species key
- `limit` (number, optional) — Results (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: GBIF (Global Biodiversity Information Facility)
- **Base URL**: https://api.gbif.org/v1
- **Auth**: None required
- **Docs**: https://www.gbif.org/developer/summary

## Deploy

### Docker
```bash
docker build -t settlegrid-biodiversity-index .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-biodiversity-index
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
