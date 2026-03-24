# settlegrid-cell-tower

Cell Tower Locations MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cell-tower)

Look up cell tower locations and coverage data using public cell tower databases. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_tower(mcc, mnc, lac, cellid)` | Get cell tower location by identifiers | 1¢ |
| `search_area(lat, lon, radius?)` | Search cell towers in an area | 2¢ |
| `get_stats(country?)` | Get cell tower statistics | 1¢ |

## Parameters

### get_tower
- `mcc` (number, required) — Mobile Country Code
- `mnc` (number, required) — Mobile Network Code
- `lac` (number, required) — Location Area Code
- `cellid` (number, required) — Cell ID

### search_area
- `lat` (number, required) — Center latitude
- `lon` (number, required) — Center longitude
- `radius` (number) — Search radius in km (default: 5)

### get_stats
- `country` (string) — Country code (e.g., US, DE) to filter stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenCelliD API — it is completely free.

## Upstream API

- **Provider**: OpenCelliD
- **Base URL**: https://opencellid.org
- **Auth**: None required
- **Docs**: https://wiki.opencellid.org/wiki/API

## Deploy

### Docker

```bash
docker build -t settlegrid-cell-tower .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cell-tower
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
