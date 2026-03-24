# settlegrid-healthdata-gov

HealthData.gov MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-healthdata-gov)

US federal health datasets from HealthData.gov CKAN catalog.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search US health datasets by keyword | 1¢ |
| `get_dataset(dataset_id)` | Get dataset details by ID | 1¢ |

## Parameters

### search_datasets
- `query` (string, required)

### get_dataset
- `dataset_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: HealthData.gov
- **Base URL**: https://healthdata.gov/api/3
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://healthdata.gov

## Deploy

### Docker

```bash
docker build -t settlegrid-healthdata-gov .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-healthdata-gov
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
