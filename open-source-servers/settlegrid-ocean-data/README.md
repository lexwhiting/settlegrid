# settlegrid-ocean-data

ERDDAP Ocean Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ocean-data)

Ocean and coastal data from NOAA CoastWatch ERDDAP.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search ocean datasets by keyword | 1¢ |
| `get_dataset_info(dataset_id)` | Get metadata for a specific dataset | 1¢ |

## Parameters

### search_datasets
- `query` (string, required)

### get_dataset_info
- `dataset_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NOAA CoastWatch
- **Base URL**: https://coastwatch.pfeg.noaa.gov/erddap
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://coastwatch.pfeg.noaa.gov/erddap/information.html

## Deploy

### Docker

```bash
docker build -t settlegrid-ocean-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ocean-data
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
