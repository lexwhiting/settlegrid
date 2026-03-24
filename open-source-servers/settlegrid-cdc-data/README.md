# settlegrid-cdc-data

CDC Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cdc-data)

US CDC health statistics and surveillance data via SODA API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search CDC datasets by keyword | 1¢ |
| `query_dataset(dataset_id, query)` | Query a specific CDC dataset | 1¢ |

## Parameters

### search_datasets
- `query` (string, required)

### query_dataset
- `dataset_id` (string, required)
- `query` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: CDC / Socrata
- **Base URL**: https://data.cdc.gov
- **Auth**: None required
- **Rate Limits**: ~1000 req/hr unauth
- **Docs**: https://dev.socrata.com/foundry/data.cdc.gov

## Deploy

### Docker

```bash
docker build -t settlegrid-cdc-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cdc-data
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
