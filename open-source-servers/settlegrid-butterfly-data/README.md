# settlegrid-butterfly-data

Butterfly Species Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-butterfly-data)

Access butterfly (Lepidoptera) species data via GBIF. Search butterfly species, get details, and find occurrence records.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_species(query, limit?)` | Search butterfly species | 1¢ |
| `get_species(key)` | Get species details by key | 1¢ |
| `get_occurrences(speciesKey, country?)` | Get occurrence records for a species | 2¢ |

## Parameters

### search_species
- `query` (string, required) — Butterfly name (e.g. "Monarch", "Papilio")
- `limit` (number) — Max results (default 10, max 50)

### get_species
- `key` (string, required) — GBIF species key (numeric)

### get_occurrences
- `speciesKey` (string, required) — GBIF species key
- `country` (string) — ISO country code (e.g. US, GB)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GBIF API (Lepidoptera) API — it is completely free.

## Upstream API

- **Provider**: GBIF API (Lepidoptera)
- **Base URL**: https://api.gbif.org/v1
- **Auth**: None required
- **Docs**: https://www.gbif.org/developer/summary

## Deploy

### Docker

```bash
docker build -t settlegrid-butterfly-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-butterfly-data
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
