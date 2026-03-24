# settlegrid-river-data

River Flow & Level Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-river-data)

Access river flow and water level data via USGS Water Services. Get real-time streamflow, search monitoring sites, and view statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flow(site, period?)` | Get current streamflow for a site | 1¢ |
| `search_sites(state, type?)` | Search monitoring sites by state | 1¢ |
| `get_stats(site)` | Get daily statistics for a site | 2¢ |

## Parameters

### get_flow
- `site` (string, required) — USGS site number (e.g. 01646500)
- `period` (string) — Data period (e.g. P7D for 7 days, default P1D)

### search_sites
- `state` (string, required) — Two-letter state code (e.g. VA, CO)
- `type` (string) — Site type (e.g. ST for stream, default ST)

### get_stats
- `site` (string, required) — USGS site number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USGS Water Services API — it is completely free.

## Upstream API

- **Provider**: USGS Water Services
- **Base URL**: https://waterservices.usgs.gov/nwis
- **Auth**: None required
- **Docs**: https://waterservices.usgs.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-river-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-river-data
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
