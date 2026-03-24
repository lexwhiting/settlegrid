# settlegrid-soil-survey

USDA Soil Survey MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-soil-survey)

Query the USDA Soil Data Access service for soil types, properties, and map units. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_soil_type(lat, lon)` | Get soil type at coordinates | 2¢ |
| `get_properties(mukey)` | Get soil properties by map unit key | 2¢ |
| `search_mapunits(state, county?)` | Search map units by location | 2¢ |

## Parameters

### get_soil_type
- `lat` (number, required) — Latitude (decimal degrees)
- `lon` (number, required) — Longitude (decimal degrees)

### get_properties
- `mukey` (string, required) — Map unit key (MUKEY) identifier

### search_mapunits
- `state` (string, required) — US state name or abbreviation
- `county` (string) — County name within the state

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USDA Soil Data Access API — it is completely free.

## Upstream API

- **Provider**: USDA Soil Data Access
- **Base URL**: https://sdmdataaccess.sc.egov.usda.gov
- **Auth**: None required
- **Docs**: https://sdmdataaccess.sc.egov.usda.gov/WebServiceHelp.aspx

## Deploy

### Docker

```bash
docker build -t settlegrid-soil-survey .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-soil-survey
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
