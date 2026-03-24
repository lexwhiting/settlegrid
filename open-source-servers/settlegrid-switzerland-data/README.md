# settlegrid-switzerland-data

Swiss Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-switzerland-data)

Access Swiss government open datasets from opendata.swiss via CKAN API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, limit?)` | Search Swiss Open Data datasets | 1¢ |
| `get_dataset(id)` | Get dataset details by ID | 1¢ |
| `list_organizations(limit?)` | List publishing organizations | 1¢ |

## Parameters

### search_datasets
- `query` (string, required) — Search query
- `limit` (number) — Max results to return

### get_dataset
- `id` (string, required) — Dataset identifier

### list_organizations
- `limit` (number) — Max results to return

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream opendata.swiss CKAN API — it is completely free.

## Upstream API

- **Provider**: opendata.swiss CKAN
- **Base URL**: https://ckan.opendata.swiss/api/3
- **Auth**: None required
- **Docs**: https://handbook.opendata.swiss/en/content/nutzen/api-nutzen.html

## Deploy

### Docker

```bash
docker build -t settlegrid-switzerland-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-switzerland-data
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
