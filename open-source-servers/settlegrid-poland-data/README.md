# settlegrid-poland-data

Polish Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-poland-data)

Access Polish government open datasets from dane.gov.pl.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, limit?)` | Search Polish datasets | 1¢ |
| `get_dataset(id)` | Get dataset details | 1¢ |
| `list_categories()` | List dataset categories | 1¢ |

## Parameters

### search_datasets
- `query` (string, required) — Search query
- `limit` (number) — Max results

### get_dataset
- `id` (string, required) — Dataset ID

### list_categories

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream dane.gov.pl API — it is completely free.

## Upstream API

- **Provider**: dane.gov.pl
- **Base URL**: https://api.dane.gov.pl/1.4
- **Auth**: None required
- **Docs**: https://api.dane.gov.pl/

## Deploy

### Docker

```bash
docker build -t settlegrid-poland-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-poland-data
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
