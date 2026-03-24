# settlegrid-lake-data

Lake & Reservoir Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lake-data)

Access lake and reservoir water level data via USGS Water Services. Get levels, search reservoirs, and view statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_level(site)` | Get current water level for a site | 1¢ |
| `search_reservoirs(state)` | Search reservoir sites by state | 1¢ |
| `get_stats(site)` | Get water level statistics for a site | 2¢ |

## Parameters

### get_level
- `site` (string, required) — USGS site number (e.g. 09380000)

### search_reservoirs
- `state` (string, required) — Two-letter state code (e.g. AZ, CA)

### get_stats
- `site` (string, required) — USGS site number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USGS Water Services (Reservoirs) API — it is completely free.

## Upstream API

- **Provider**: USGS Water Services (Reservoirs)
- **Base URL**: https://waterservices.usgs.gov/nwis
- **Auth**: None required
- **Docs**: https://waterservices.usgs.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-lake-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lake-data
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
