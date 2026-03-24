# settlegrid-paleoclimate

Paleoclimate Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-paleoclimate)

Access historical climate data via NOAA Paleoclimatology API. Search datasets, get dataset details, and list data types.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, type?)` | Search paleoclimate datasets | 1¢ |
| `get_dataset(id)` | Get dataset details by ID | 1¢ |
| `list_data_types()` | List available paleoclimate data types | 1¢ |

## Parameters

### search_datasets
- `query` (string, required) — Search query (e.g. "ice core", "tree ring")
- `type` (string) — Data type (e.g. "ice core", "coral", "tree ring")

### get_dataset
- `id` (string, required) — Dataset ID

### list_data_types

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NOAA Paleo API API — it is completely free.

## Upstream API

- **Provider**: NOAA Paleo API
- **Base URL**: https://www.ncei.noaa.gov/access/paleo-search/api/v1
- **Auth**: None required
- **Docs**: https://www.ncei.noaa.gov/access/paleo-search/api

## Deploy

### Docker

```bash
docker build -t settlegrid-paleoclimate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-paleoclimate
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
