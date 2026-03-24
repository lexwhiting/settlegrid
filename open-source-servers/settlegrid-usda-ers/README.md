# settlegrid-usda-ers

USDA Economic Research Service MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usda-ers)

Access USDA Economic Research Service datasets and food data. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search ERS datasets | 1¢ |
| `get_data(dataset, indicator?)` | Get data for a specific dataset | 2¢ |
| `list_topics()` | List available research topics | 1¢ |

## Parameters

### search_datasets
- `query` (string, required) — Search term for dataset discovery

### get_data
- `dataset` (string, required) — Dataset identifier or name
- `indicator` (string) — Specific indicator within the dataset

### list_topics

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USDA FoodData Central API — it is completely free.

## Upstream API

- **Provider**: USDA FoodData Central
- **Base URL**: https://api.nal.usda.gov/fdc/v1
- **Auth**: None required
- **Docs**: https://fdc.nal.usda.gov/api-guide.html

## Deploy

### Docker

```bash
docker build -t settlegrid-usda-ers .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usda-ers
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
