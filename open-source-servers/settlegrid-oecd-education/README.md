# settlegrid-oecd-education

OECD Education Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-oecd-education)

Access OECD education statistics via the OECD SDMX API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_data(dataset, country?)` | Get education dataset | 2¢ |
| `search_datasets(query)` | Search OECD education datasets | 1¢ |
| `list_countries()` | List OECD member countries | 1¢ |

## Parameters

### get_data
- `dataset` (string, required) — OECD dataset ID (e.g. EDU_ENRL_AGE, EDU_FINANCE)
- `country` (string) — ISO3 country code (e.g. USA, FRA)

### search_datasets
- `query` (string, required) — Search term (e.g. "enrollment", "pisa")

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OECD SDMX API API — it is completely free.

## Upstream API

- **Provider**: OECD SDMX API
- **Base URL**: https://sdmx.oecd.org/public/rest
- **Auth**: None required
- **Docs**: https://data.oecd.org/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-oecd-education .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-oecd-education
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
