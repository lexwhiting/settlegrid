# settlegrid-nasdaq-data

Nasdaq Data Link MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasdaq-data)

Financial, economic, and alternative datasets from Nasdaq (formerly Quandl)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NASDAQ_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_dataset(database_code, dataset_code)` | Get a dataset by code | 2¢ |
| `search_datasets(query)` | Search for datasets | 1¢ |

## Parameters

### get_dataset
- `database_code` (string, required) — Database code (e.g. WIKI, FRED)
- `dataset_code` (string, required) — Dataset code (e.g. AAPL, GDP)
- `limit` (number, optional) — Row limit (default: 100)

### search_datasets
- `query` (string, required) — Search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASDAQ_API_KEY` | Yes | Nasdaq Data Link API key from [https://data.nasdaq.com/sign-up](https://data.nasdaq.com/sign-up) |

## Upstream API

- **Provider**: Nasdaq Data Link
- **Base URL**: https://data.nasdaq.com/api/v3
- **Auth**: API key (query)
- **Docs**: https://docs.data.nasdaq.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-nasdaq-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NASDAQ_API_KEY=xxx -p 3000:3000 settlegrid-nasdaq-data
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
