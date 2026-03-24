# settlegrid-canada-open

Canada Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-canada-open)

Search Canadian government open datasets.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, rows)` | Search Canadian open data portal by keyword | 1¢ |
| `get_dataset(id)` | Get metadata for a specific Canadian dataset by ID | 1¢ |

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

- **Provider**: Government of Canada
- **Base URL**: https://open.canada.ca
- **Auth**: None required
- **Rate Limits**: No published limit (no key)
- **Docs**: https://open.canada.ca/data/en/dataset

## Deploy

### Docker

```bash
docker build -t settlegrid-canada-open .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-canada-open
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
