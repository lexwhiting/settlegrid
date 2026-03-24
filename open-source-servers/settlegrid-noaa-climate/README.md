# settlegrid-noaa-climate

NOAA Climate Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-noaa-climate)

Historical climate datasets, normals, and extremes from NOAA NCDC

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NOAA_CDO_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_datasets()` | List available climate datasets | 1¢ |
| `get_data(datasetid, startdate, enddate)` | Get climate data observations | 2¢ |

## Parameters

### get_datasets

### get_data
- `datasetid` (string, required) — Dataset ID (e.g. GHCND)
- `startdate` (string, required) — Start date YYYY-MM-DD
- `enddate` (string, required) — End date YYYY-MM-DD
- `locationid` (string, optional) — Location ID (e.g. FIPS:06)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NOAA_CDO_TOKEN` | Yes | NOAA Climate Data API key from [https://www.ncdc.noaa.gov/cdo-web/token](https://www.ncdc.noaa.gov/cdo-web/token) |

## Upstream API

- **Provider**: NOAA Climate Data
- **Base URL**: https://www.ncdc.noaa.gov/cdo-web/api/v2
- **Auth**: API key (header)
- **Docs**: https://www.ncdc.noaa.gov/cdo-web/webservices/v2

## Deploy

### Docker

```bash
docker build -t settlegrid-noaa-climate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NOAA_CDO_TOKEN=xxx -p 3000:3000 settlegrid-noaa-climate
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
