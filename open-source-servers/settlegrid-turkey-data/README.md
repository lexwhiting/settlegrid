# settlegrid-turkey-data

Turkish Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-turkey-data)

Access Turkish economic and demographic data via World Bank API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search indicators | 1¢ |
| `list_categories()` | List indicator topics | 1¢ |
| `get_indicator(id)` | Get indicator data | 1¢ |

## Parameters

### search_datasets
- `query` (string, required) — Search term

### list_categories

### get_indicator
- `id` (string, required) — Indicator code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API (TUR) API — it is completely free.

## Upstream API

- **Provider**: World Bank API (TUR)
- **Base URL**: https://api.worldbank.org/v2/country/TUR
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api

## Deploy

### Docker

```bash
docker build -t settlegrid-turkey-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-turkey-data
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
