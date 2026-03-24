# settlegrid-data-center

Data Center Locations MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-data-center)

Global data center locations, specifications, and statistics from public datasets.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datacenters(country?, city?)` | Search data centers by location | 1¢ |
| `get_datacenter(id)` | Get data center details by ID | 1¢ |
| `get_stats(country?)` | Get data center statistics by country | 1¢ |

## Parameters

### search_datacenters
- `country` (string) — Country name or ISO code
- `city` (string) — City name

### get_datacenter
- `id` (string, required) — Data center ID

### get_stats
- `country` (string) — Country name or ISO code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DataCenterMap API — it is completely free.

## Upstream API

- **Provider**: DataCenterMap
- **Base URL**: https://api.datacentermap.com
- **Auth**: None required
- **Docs**: https://www.datacentermap.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-data-center .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-data-center
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
