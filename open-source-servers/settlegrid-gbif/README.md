# settlegrid-gbif

GBIF (Biodiversity) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gbif)

Global Biodiversity Information Facility with 2B+ species occurrences

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_species(q)` | Search for species by name | 1¢ |
| `get_occurrences(scientificName)` | Search species occurrence records | 1¢ |

## Parameters

### search_species
- `q` (string, required) — Species name
- `limit` (number, optional) — Results limit (default: 20)

### get_occurrences
- `scientificName` (string, required) — Scientific species name
- `limit` (number, optional) — Results limit (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GBIF (Biodiversity) API.

## Upstream API

- **Provider**: GBIF (Biodiversity)
- **Base URL**: https://api.gbif.org/v1
- **Auth**: None required
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
