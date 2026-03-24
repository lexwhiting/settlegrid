# settlegrid-glacier-data

Glacier Monitoring (NCEI) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-glacier-data)

Global glacier monitoring data from NOAA NCEI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query)` | Search glacier and ice datasets | 1¢ |
| `get_stations(locationid)` | Get monitoring stations by location | 1¢ |

## Parameters

### search_datasets
- `query` (string, optional)

### get_stations
- `locationid` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NOAA NCEI
- **Base URL**: https://www.ncei.noaa.gov
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.ncei.noaa.gov/access

## Deploy

### Docker

```bash
docker build -t settlegrid-glacier-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-glacier-data
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
