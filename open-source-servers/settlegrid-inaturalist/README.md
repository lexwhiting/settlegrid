# settlegrid-inaturalist

iNaturalist MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-inaturalist)

Citizen science biodiversity observations and species identification

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_observations()` | Search biodiversity observations | 1¢ |
| `search_taxa(q)` | Search taxonomic names | 1¢ |

## Parameters

### search_observations
- `q` (string, optional) — Search query
- `taxon_name` (string, optional) — Species or taxon name
- `per_page` (number, optional) — Results per page (default: 20)

### search_taxa
- `q` (string, required) — Taxon name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream iNaturalist API.

## Upstream API

- **Provider**: iNaturalist
- **Base URL**: https://api.inaturalist.org/v1
- **Auth**: None required
- **Docs**: https://api.inaturalist.org/v1/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-inaturalist .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-inaturalist
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
