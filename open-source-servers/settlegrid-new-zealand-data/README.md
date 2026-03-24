# settlegrid-new-zealand-data

New Zealand Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-new-zealand-data)

Access New Zealand government open datasets from catalogue.data.govt.nz via CKAN API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, limit?)` | Search New Zealand Open Data datasets | 1¢ |
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

No API key needed for the upstream data.govt.nz CKAN API — it is completely free.

## Upstream API

- **Provider**: data.govt.nz CKAN
- **Base URL**: https://catalogue.data.govt.nz/api/3
- **Auth**: None required
- **Docs**: https://catalogue.data.govt.nz/

## Deploy

### Docker

```bash
docker build -t settlegrid-new-zealand-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-new-zealand-data
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
