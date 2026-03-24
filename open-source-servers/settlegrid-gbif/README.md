# settlegrid-gbif

GBIF MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gbif)

Query the Global Biodiversity Information Facility for species occurrence data with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_species(query, limit)` | Search for species by name | 1¢ |
| `get_occurrences(taxon_key, limit)` | Get species occurrences by taxon key | 1¢ |

## Parameters

### search_species
- `query` (string, required) — Species name or common name
- `limit` (number, optional) — Max results (1-20, default 10)

### get_occurrences
- `taxon_key` (number, required) — GBIF taxon key
- `limit` (number, optional) — Max results (1-20, default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: GBIF
- **Base URL**: https://api.gbif.org/v1
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.gbif.org/developer/summary

## Deploy

### Docker

```bash
docker build -t settlegrid-gbif .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gbif
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
