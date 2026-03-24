# settlegrid-soil-data

Soil Composition Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-soil-data)

Access soil property data via ISRIC SoilGrids REST API. Get soil properties, list available properties, and get classification.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_soil(lat, lon, property?)` | Get soil properties at a location | 2¢ |
| `list_properties()` | List available soil properties | 1¢ |
| `get_classification(lat, lon)` | Get soil classification at a location | 2¢ |

## Parameters

### get_soil
- `lat` (number, required) — Latitude (-90 to 90)
- `lon` (number, required) — Longitude (-180 to 180)
- `property` (string) — Soil property (e.g. "clay", "sand", "phh2o", "soc")

### list_properties

### get_classification
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SoilGrids REST API API — it is completely free.

## Upstream API

- **Provider**: SoilGrids REST API
- **Base URL**: https://rest.isric.org/soilgrids/v2.0
- **Auth**: None required
- **Docs**: https://rest.isric.org/soilgrids/v2.0/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-soil-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-soil-data
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
