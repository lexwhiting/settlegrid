# settlegrid-hong-kong-data

Hong Kong Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hong-kong-data)

Access Hong Kong government open datasets from DATA.GOV.HK.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search HK datasets | 1¢ |
| `get_dataset(id)` | Get dataset details | 1¢ |
| `list_categories()` | List data categories | 1¢ |

## Parameters

### search_datasets
- `query` (string, required) — Search query

### get_dataset
- `id` (string, required) — Dataset ID

### list_categories

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DATA.GOV.HK API — it is completely free.

## Upstream API

- **Provider**: DATA.GOV.HK
- **Base URL**: https://data.gov.hk/en/api
- **Auth**: None required
- **Docs**: https://data.gov.hk/en/

## Deploy

### Docker

```bash
docker build -t settlegrid-hong-kong-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hong-kong-data
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
