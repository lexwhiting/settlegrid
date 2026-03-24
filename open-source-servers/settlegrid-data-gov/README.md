# settlegrid-data-gov

Data.gov MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-data-gov)

Search and access US government open datasets.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, rows)` | Search data.gov datasets by keyword | 1¢ |
| `get_dataset(id)` | Get metadata for a specific dataset by ID | 1¢ |

## Parameters

### search_datasets
- `query` (string, required)
- `rows` (number, optional)

### get_dataset
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: US Government
- **Base URL**: https://data.gov
- **Auth**: None required
- **Rate Limits**: No published limit (no key)
- **Docs**: https://catalog.data.gov/api/3

## Deploy

### Docker

```bash
docker build -t settlegrid-data-gov .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-data-gov
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
