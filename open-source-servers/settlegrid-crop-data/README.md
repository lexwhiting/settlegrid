# settlegrid-crop-data

Global Crop Production Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-crop-data)

Access global crop production, yield, and area harvested data from FAOSTAT. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_production(crop, country?, year?)` | Get crop production data | 2¢ |
| `list_crops()` | List available crop types | 1¢ |
| `list_countries()` | List available countries | 1¢ |

## Parameters

### get_production
- `crop` (string, required) — Crop name (e.g. Wheat, Rice, Maize)
- `country` (string) — Country name or ISO3 code
- `year` (number) — Year to query (e.g. 2022)

### list_crops

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FAOSTAT API — it is completely free.

## Upstream API

- **Provider**: FAOSTAT
- **Base URL**: https://www.fao.org/faostat/api/v1
- **Auth**: None required
- **Docs**: https://www.fao.org/faostat/en/#data

## Deploy

### Docker

```bash
docker build -t settlegrid-crop-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-crop-data
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
